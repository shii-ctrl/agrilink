import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { runWithStartContext } from "@tanstack/start-storage-context";

// Real production HTTP server + real cookies, authorization and SQL. Explicitly
// opt in to a disposable LOOPBACK database; never fall back to DATABASE_URL.
const adminUrl = process.env.ALL_ROLES_TEST_DATABASE_ADMIN_URL;
test(
  "all roles: authenticated HTTP workflows on an isolated production server",
  {
    skip: !adminUrl,
    timeout: 240_000,
  },
  async (t) => {
    const target = new URL(adminUrl);
    assert.ok(["127.0.0.1", "localhost", "::1"].includes(target.hostname));
    assert.equal(target.pathname, "/mysql");
    const database = "agrilink_roles_test_" + randomUUID().replaceAll("-", "");
    const admin = await mysql.createConnection(target.toString());
    let pool,
      server,
      created = false;
    let serverOutput = "";
    const port = "4187",
      base = `http://127.0.0.1:${port}`;
    const password = "Roles-e2e-private-fixture-2026!";
    try {
      await admin.query(
        "CREATE DATABASE `" + database + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      );
      created = true;
      target.pathname = "/" + database;
      const env = {
        ...process.env,
        DATABASE_URL: target.toString(),
        MIGRATION_DATABASE_URL: target.toString(),
        DATABASE_SSL: "",
      };
      const migrate = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
        env,
        encoding: "utf8",
      });
      assert.equal(migrate.status, 0, migrate.stderr);
      pool = mysql.createPool({ uri: target.toString(), connectionLimit: 3 });
      const roleNames = ["Management", "Marketer", "Accounting", "Farmer", "Buyer", "Rider"];
      const actors = {};
      const hash = await bcrypt.hash(password, 12);
      const [roleRows] = await pool.query("SELECT id,name FROM roles");
      for (const role of roleNames) {
        const id = randomUUID(),
          username = "e2e." + role.toLowerCase();
        await pool.query(
          "INSERT INTO users (id,username,password_hash,display_name,active) VALUES (?,?,?,?,1)",
          [id, username, hash, `${role} E2E`],
        );
        const roleId = roleRows.find((entry) => entry.name === role)?.id;
        assert.ok(roleId, `${role} reference role exists`);
        await pool.query("INSERT INTO user_roles (user_id,role_id) VALUES (?,?)", [id, roleId]);
        if (role === "Farmer")
          await pool.query(
            "INSERT INTO farmer_applications (user_id,farming_location,status) VALUES (?,'Test farm Quezon','approved')",
            [id],
          );
        actors[role] = { id, username, cookies: new Map() };
      }
      const registry = new Map(),
        methods = new Map();
      async function sourceFiles(dir) {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          const path = join(dir, entry.name);
          if (entry.isDirectory()) await sourceFiles(path);
          else if (entry.name.endsWith(".ts")) {
            const text = await readFile(path, "utf8");
            for (const match of text.matchAll(
              /export const (\w+) = createServerFn\(\{ method: "(GET|POST)" \}/g,
            ))
              methods.set(match[1], match[2]);
          }
        }
      }
      await sourceFiles("src/services");
      for (const file of await readdir(".output/server/_ssr")) {
        if (!file.endsWith(".mjs")) continue;
        const text = await readFile(join(".output/server/_ssr", file), "utf8");
        for (const match of text.matchAll(
          /createServerRpc\(\{\s*id: "([^"]+)",\s*name: "([^"]+)"/g,
        ))
          registry.set(match[2], match[1]);
      }
      const require = createRequire(import.meta.url);
      const clientRoot = dirname(require.resolve("@tanstack/start-client-core/package.json"));
      const { serverFnFetcher } = await import(
        pathToFileURL(join(clientRoot, "dist/esm/client-rpc/serverFnFetcher.js")).href
      );
      async function rpc(actor, name, data) {
        assert.ok(registry.has(name), `built RPC exists: ${name}`);
        const envelope = await runWithStartContext({ startOptions: {} }, () =>
          serverFnFetcher(
            `${base}/_serverFn/${registry.get(name)}`,
            [{ method: methods.get(name), data }],
            async (url, init) => {
              const headers = new Headers(init.headers);
              headers.set("origin", base);
              headers.set("sec-fetch-site", "same-origin");
              if (actor?.cookies.size)
                headers.set(
                  "cookie",
                  [...actor.cookies].map(([key, value]) => `${key}=${value}`).join("; "),
                );
              const response = await fetch(url, { ...init, headers, redirect: "manual" });
              for (const raw of response.headers.getSetCookie()) {
                const [pair] = raw.split(";"),
                  split = pair.indexOf("=");
                if (actor) actor.cookies.set(pair.slice(0, split), pair.slice(split + 1));
              }
              return response;
            },
          ),
        );
        if (envelope?.error) throw envelope.error;
        return envelope?.result;
      }
      server = spawn(process.execPath, [resolve(".output/server/index.mjs")], {
        env: {
          ...env,
          NODE_ENV: "production",
          NITRO_HOST: "127.0.0.1",
          HOST: "127.0.0.1",
          PORT: port,
          NITRO_PORT: port,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      server.stdout.on("data", (chunk) => {
        serverOutput += chunk;
      });
      server.stderr.on("data", (chunk) => {
        serverOutput += chunk;
      });
      let ready = false;
      for (let i = 0; i < 60; i++) {
        try {
          if ((await fetch(base)).ok) {
            ready = true;
            break;
          }
        } catch {
          /* server booting */
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      assert.ok(ready, `production server starts: ${serverOutput}`);
      async function step(name, fn) {
        let error;
        await t.test(name, async () => {
          try {
            await fn();
          } catch (failure) {
            error = failure;
            throw failure;
          }
        });
        if (error) throw error;
      }
      await step(
        "all six roles can log in, load their real session and reject invalid passwords",
        async () => {
          await assert.rejects(
            rpc({ cookies: new Map() }, "loginUser", {
              identifier: actors.Buyer.username,
              password: "incorrect",
            }),
          );
          for (const role of roleNames) {
            const user = await rpc(actors[role], "loginUser", {
              identifier: actors[role].username,
              password,
            });
            assert.ok(user.roles.includes(role), role);
            assert.equal(user.passwordHash, undefined);
            assert.equal((await rpc(actors[role], "getCurrentSessionUser")).id, actors[role].id);
          }
        },
      );
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const workspaceChecks = [];
      await step(
        "every role's workspace data loads and restricted workspaces reject other roles",
        async () => {
          const workspaces = [
            ["getManagementUsers", ["Management"]],
            ["getManagementAuditLogs", ["Management"]],
            ["getFarmerApplications", ["Management"]],
            ["getManagementProductWorkspace", ["Management"]],
            ["getManagementReceivingRecords", ["Management"]],
            ["getManagementDecisionSupport", ["Management"]],
            ["getManagementReport", ["Management"]],
            ["getManagementFeedbackSummary", ["Management"]],
            ["getManagementDashboard", ["Management"], { range: "all" }],
            ["getManagementFarmerSettlementSummary", ["Management"]],
            ["getMarketerDashboard", ["Marketer"]],
            ["getMarketerProductCatalog", ["Marketer"]],
            ["getCatalogProducts", ["Marketer"]],
            ["getMarketerMarketplaceListings", ["Marketer"]],
            ["getMarketerDailyPrices", ["Marketer"]],
            ["getReceivingWorkspace", ["Marketer"]],
            ["getPublishableInventory", ["Marketer"]],
            ["getMarketerDeliveryOperations", ["Marketer"]],
            ["getMarketerDeliverySettings", ["Marketer"]],
            ["getDatabaseOrders", ["Management", "Marketer", "Accounting"]],
            ["getFarmerReceivingRecords", ["Farmer"]],
            ["getFarmerProductStatuses", ["Farmer"]],
            ["getFarmerSettlementWorkspace", ["Farmer"]],
            ["getFarmerCropAiWorkspace", ["Farmer"]],
            ["getBuyerCart", ["Buyer"]],
            ["getBuyerOrders", ["Buyer"]],
            ["getBuyerDeliveryFee", ["Buyer"]],
            ["getMyDailyPriceAlerts", ["Buyer"]],
            ["getMyDeliveryDisputes", ["Buyer"]],
            ["getAccountingCodRemittances", ["Accounting"]],
            ["getAccountingFarmerSettlements", ["Accounting"]],
            ["getAccountingDeliveryRefunds", ["Accounting"]],
            ["getDailyCashClosingPreview", ["Accounting"], { date: today }],
            ["getDailyCashClosingHistory", ["Accounting", "Management"]],
            ["getRiderDeliveryStatus", ["Rider"]],
            ["getRiderCompletedDeliveries", ["Rider"]],
            ["getOperationalDeliveryDisputes", ["Marketer", "Rider"]],
          ];
          workspaceChecks.push(...workspaces);
          for (const [name, allowed, data] of workspaces) {
            for (const role of roleNames) {
              if (allowed.includes(role))
                assert.notEqual(await rpc(actors[role], name, data), undefined, `${role}: ${name}`);
              else
                await assert.rejects(
                  rpc(actors[role], name, data),
                  `${role} must not access ${name}`,
                );
            }
            await assert.rejects(rpc(null, name, data), `anonymous must not access ${name}`);
          }
          for (const role of roleNames) {
            await rpc(actors[role], "getWorkspaceSidebarBadges");
            await rpc(actors[role], "getCurrentNotifications");
            await rpc(actors[role], "getDirectMessageWorkspace");
          }
          for (const role of ["Management", "Marketer", "Farmer", "Accounting"])
            await rpc(actors[role], "getCommunityMessages", {});
        },
      );
      const marketer = actors.Marketer,
        manager = actors.Management,
        farmer = actors.Farmer,
        buyer = actors.Buyer,
        rider = actors.Rider,
        accountant = actors.Accounting;
      let productId, listingId, pickupOrder, deliveryOrder, walkInOrder;
      const receivingIds = [];
      await step(
        "Management staff creation and password reset revoke the old session",
        async () => {
          const data = {
            name: "Second Rider E2E",
            contact: "09123456789",
            email: "second.rider@example.test",
            password,
            role: "Rider",
            active: true,
          };
          await assert.rejects(rpc(marketer, "createManagementUser", data));
          const created = await rpc(manager, "createManagementUser", data);
          const staff = { id: created.id, cookies: new Map() };
          await rpc(staff, "loginUser", { identifier: data.email, password });
          const oldSession = { cookies: new Map(staff.cookies) };
          const resetPassword = "Reset-role-e2e-private-2026!";
          await rpc(manager, "resetManagedUserPassword", {
            userId: created.id,
            password: resetPassword,
          });
          assert.equal(await rpc(oldSession, "getCurrentSessionUser"), null);
          await assert.rejects(rpc(staff, "loginUser", { identifier: data.email, password }));
          await rpc(staff, "loginUser", { identifier: data.email, password: resetPassword });
          actors.SecondRider = staff;
        },
      );
      const stock = async () => {
        const [[row]] = await pool.query(
          "SELECT COALESCE(SUM(quantity_kg),0) physical,COALESCE(SUM(reserved_kg),0) reserved FROM inventory WHERE product_id=?",
          [productId],
        );
        const physical = Number(row.physical),
          reserved = Number(row.reserved);
        return { physical, reserved, available: Number((physical - reserved).toFixed(2)) };
      };
      const orderData = (quantity, fulfillment = "pickup") => ({
        contact: "09123456789",
        pickupNote: "Test pickup at PROCY",
        fulfillment,
        ...(fulfillment === "delivery"
          ? {
              recipientName: "Buyer E2E",
              deliveryAddress: "Test address Quezon",
              deliveryInstructions: "Isolated test only",
            }
          : {}),
        items: [{ listingId, quantityKg: quantity }],
      });
      async function place(quantity, fulfillment = "pickup") {
        await rpc(buyer, "addBuyerCartItem", { listingId, quantityKg: quantity });
        return rpc(buyer, "placeBuyerOrder", orderData(quantity, fulfillment));
      }
      async function prepare(order, method = "pickup") {
        for (const status of [
          "preparing",
          method === "delivery" ? "ready_for_dispatch" : "ready_for_pickup",
        ]) {
          await rpc(marketer, "updateOrderFulfillment", { orderNumber: order.orderNumber, status });
        }
      }
      await step(
        "Buyer registration and Farmer application → Management approval → Farmer login",
        async () => {
          const secondBuyer = { cookies: new Map() };
          const newBuyer = await rpc(secondBuyer, "registerBuyer", {
            username: "registered.buyer",
            password,
          });
          assert.deepEqual(newBuyer.roles, ["Buyer"]);
          assert.equal(newBuyer.passwordHash, undefined);
          secondBuyer.id = newBuyer.id;
          actors.RegisteredBuyer = secondBuyer;
          await assert.rejects(
            rpc({ cookies: new Map() }, "registerBuyer", {
              username: "buyer with spaces",
              password,
            }),
          );
          const applicant = { cookies: new Map() };
          await rpc(applicant, "registerFarmer", {
            username: "registered.farmer",
            password,
            name: "Registered Farmer",
            contact: "09123456789",
            farmingLocation: "Test barangay Quezon",
          });
          assert.equal(await rpc(applicant, "getCurrentSessionUser"), null);
          await assert.rejects(
            rpc(applicant, "loginUser", { identifier: "registered.farmer", password }),
            /pending/i,
          );
          const applications = await rpc(manager, "getFarmerApplications");
          const application = applications.find((row) => row.username === "registered.farmer");
          assert.equal(application.status, "pending");
          await assert.rejects(
            rpc(marketer, "reviewFarmerApplication", {
              userId: application.userId,
              decision: "approved",
            }),
          );
          await rpc(manager, "reviewFarmerApplication", {
            userId: application.userId,
            decision: "approved",
          });
          const approved = await rpc(applicant, "loginUser", {
            identifier: "registered.farmer",
            password,
          });
          assert.deepEqual(approved.roles, ["Farmer"]);
          applicant.id = approved.id;
          actors.RegisteredFarmer = applicant;
          await assert.rejects(
            rpc(manager, "reviewFarmerApplication", {
              userId: application.userId,
              decision: "approved",
            }),
          );
        },
      );
      await step(
        "Marketer catalog → Farmer receiving → classification → marketplace and daily prices",
        async () => {
          const product = {
            name: "E2E Quezon produce",
            cropType: "Lowland Crops",
            sellingUnit: "kg",
            description: "Isolated workflow test",
          };
          await assert.rejects(rpc(farmer, "createCatalogProduct", product));
          productId = (await rpc(marketer, "createCatalogProduct", product)).id;
          assert.equal(
            (await rpc(null, "getMarketplaceListings")).length,
            0,
            "unpriced product has no public display",
          );
          for (const [owner, qty] of [
            [farmer, 3],
            [actors.RegisteredFarmer, 20],
          ]) {
            // DATETIME stores seconds; make FIFO ownership deterministic.
            if (receivingIds.length) await new Promise((resolve) => setTimeout(resolve, 1100));
            const data = {
              id: randomUUID(),
              farmerId: owner.id,
              productId,
              totalKg: qty,
              goodKg: qty,
              semiKg: 0,
              rejectKg: 0,
            };
            receivingIds.push(data.id);
            await rpc(marketer, "recordReceivingDelivery", data);
            await rpc(marketer, "recordReceivingDelivery", data);
            assert.ok(
              (await rpc(owner, "getFarmerReceivingRecords")).some((row) => row.id === data.id),
            );
          }
          assert.deepEqual(
            await stock(),
            { physical: 23, reserved: 0, available: 23 },
            "receiving retry does not duplicate stock",
          );
          assert.ok(
            !(await rpc(farmer, "getFarmerReceivingRecords")).some(
              (row) => row.id === receivingIds[1],
            ),
            "Farmer sees only own receipts",
          );
          await assert.rejects(
            rpc(marketer, "recordReceivingDelivery", {
              id: randomUUID(),
              farmerId: farmer.id,
              productId,
              totalKg: 5,
              goodKg: 4,
              semiKg: 0,
              rejectKg: 0,
            }),
          );
          const [[offer]] = await pool.query(
            "SELECT l.id FROM marketplace_listings l JOIN classifications c ON c.id=l.classification_id WHERE l.product_id=? AND c.name='Good'",
            [productId],
          );
          listingId = offer.id;
          await rpc(marketer, "saveMarketplaceProductOffers", {
            productId,
            offers: [
              {
                listingId,
                retailPricePerKg: 10,
                bundlePricePerKg: 8,
                bundleMinimumKg: 10,
                visible: true,
              },
            ],
          });
          const catalog = await rpc(null, "getMarketplaceListings");
          assert.equal(catalog.find((row) => row.id === productId).quantityKg, 23);
          assert.ok((await rpc(null, "getPublicDailyPrices")).length);
          const fractions = await rpc(marketer, "createCatalogProduct", {
            ...product,
            name: "E2E fractional kilograms",
          });
          await rpc(marketer, "recordReceivingDelivery", {
            id: randomUUID(),
            farmerId: farmer.id,
            productId: fractions.id,
            totalKg: 1.15,
            goodKg: 1.15,
            semiKg: 0,
            rejectKg: 0,
          });
          const [[fractionStock]] = await pool.query(
            "SELECT id FROM inventory WHERE product_id=?",
            [fractions.id],
          );
          await rpc(marketer, "adjustCatalogStock", {
            inventoryId: fractionStock.id,
            adjustmentKg: 0.29,
            reason: "Fractional correction test",
          });
          await rpc(marketer, "adjustCatalogStock", {
            inventoryId: fractionStock.id,
            adjustmentKg: -0.29,
            reason: "Restore fractional test stock",
          });
          const [[fractionBalance]] = await pool.query(
            "SELECT quantity_kg FROM inventory WHERE id=?",
            [fractionStock.id],
          );
          assert.equal(Number(fractionBalance.quantity_kg), 1.15);
          await assert.rejects(
            rpc(marketer, "adjustCatalogStock", {
              inventoryId: fractionStock.id,
              adjustmentKg: 0.001,
              reason: "Invalid precision test",
            }),
          );
          const trays = await rpc(marketer, "createCatalogProduct", {
            ...product,
            name: "E2E eggs",
            sellingUnit: "tray",
          });
          await assert.rejects(
            rpc(marketer, "recordReceivingDelivery", {
              id: randomUUID(),
              farmerId: farmer.id,
              productId: trays.id,
              totalKg: 1.5,
              goodKg: 1.5,
              semiKg: 0,
              rejectKg: 0,
            }),
          );
          await rpc(marketer, "recordReceivingDelivery", {
            id: randomUUID(),
            farmerId: farmer.id,
            productId: trays.id,
            totalKg: 2,
            goodKg: 2,
            semiKg: 0,
            rejectKg: 0,
          });
        },
      );
      await step(
        "Buyer cart → Pending order → Marketer confirmation → pickup → Sold → Accounting payment",
        async () => {
          await rpc(buyer, "addBuyerCartItem", { listingId, quantityKg: 4 });
          assert.equal((await stock()).reserved, 0, "cart does not reserve");
          pickupOrder = await rpc(buyer, "placeBuyerOrder", orderData(4));
          assert.equal((await stock()).reserved, 0, "Pending does not reserve");
          await assert.rejects(
            rpc(buyer, "confirmDatabaseOrder", { orderNumber: pickupOrder.orderNumber }),
          );
          await assert.rejects(
            rpc(actors.RegisteredBuyer, "getOrderDetails", {
              orderNumber: pickupOrder.orderNumber,
            }),
          );
          await assert.rejects(
            rpc(accountant, "recordDatabasePayment", {
              orderNumber: pickupOrder.orderNumber,
              method: "cash",
            }),
          );
          await rpc(marketer, "confirmDatabaseOrder", { orderNumber: pickupOrder.orderNumber });
          assert.equal((await stock()).reserved, 4);
          await assert.rejects(
            rpc(marketer, "confirmDatabaseOrder", { orderNumber: pickupOrder.orderNumber }),
          );
          await assert.rejects(
            rpc(marketer, "markDatabaseOrderSold", { orderNumber: pickupOrder.orderNumber }),
          );
          await prepare(pickupOrder);
          await rpc(marketer, "updateOrderFulfillment", {
            orderNumber: pickupOrder.orderNumber,
            status: "picked_up",
          });
          await rpc(marketer, "markDatabaseOrderSold", { orderNumber: pickupOrder.orderNumber });
          assert.deepEqual(await stock(), { physical: 19, reserved: 0, available: 19 });
          await assert.rejects(
            rpc(marketer, "recordDatabasePayment", {
              orderNumber: pickupOrder.orderNumber,
              method: "cash",
            }),
          );
          const badge = await rpc(accountant, "getWorkspaceSidebarBadges");
          assert.equal(badge["/accounting/payments"], 1);
          await rpc(accountant, "recordDatabasePayment", {
            orderNumber: pickupOrder.orderNumber,
            method: "cash",
          });
          await assert.rejects(
            rpc(accountant, "recordDatabasePayment", {
              orderNumber: pickupOrder.orderNumber,
              method: "cash",
            }),
          );
          const paid = (await rpc(marketer, "getDatabaseOrders")).find(
            (row) => row.id === pickupOrder.orderNumber,
          );
          assert.equal(paid.paymentStatus, "Paid");
          assert.equal(paid.status, "Sold");
          assert.ok(paid.paymentId);
          assert.equal(paid.allocations.length, 2, "original farmer batches remain traceable");
          assert.equal(
            (await rpc(accountant, "getWorkspaceSidebarBadges"))["/accounting/payments"],
            0,
          );
          assert.equal((await rpc(farmer, "getFarmerSettlementWorkspace")).availableTotal, 24.75);
          assert.equal(
            (await rpc(actors.RegisteredFarmer, "getFarmerSettlementWorkspace")).availableTotal,
            8.25,
          );
        },
      );
      await step(
        "Buyer cancellations, Marketer rejections and expired carts keep stock unchanged",
        async () => {
          const before = await stock();
          const cancelled = await place(1);
          await assert.rejects(
            rpc(actors.RegisteredBuyer, "releaseDatabaseOrder", {
              orderNumber: cancelled.orderNumber,
              outcome: "cancelled",
            }),
          );
          await rpc(buyer, "releaseDatabaseOrder", {
            orderNumber: cancelled.orderNumber,
            outcome: "cancelled",
          });
          const rejected = await place(1);
          await rpc(marketer, "releaseDatabaseOrder", {
            orderNumber: rejected.orderNumber,
            outcome: "rejected",
          });
          assert.deepEqual(await stock(), before);
          await rpc(buyer, "addBuyerCartItem", { listingId, quantityKg: 1 });
          await pool.query(
            "UPDATE cart_items ci JOIN carts c ON c.id=ci.cart_id SET ci.reservation_expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE) WHERE c.buyer_id=?",
            [buyer.id],
          );
          await assert.rejects(rpc(buyer, "placeBuyerOrder", orderData(1)));
          assert.deepEqual(await stock(), before);
        },
      );
      await step(
        "Buyer delivery → Rider assignment/OTP → COD handoff → Accounting verification and close",
        async () => {
          await rpc(marketer, "updateMarketerDeliveryAvailability", { deliveryEnabled: false });
          await rpc(buyer, "addBuyerCartItem", { listingId, quantityKg: 3 });
          await assert.rejects(rpc(buyer, "placeBuyerOrder", orderData(3, "delivery")));
          await rpc(marketer, "updateMarketerDeliveryAvailability", { deliveryEnabled: true });
          await rpc(marketer, "updateMarketerDeliveryFee", { deliveryFee: 25 });
          deliveryOrder = await rpc(buyer, "placeBuyerOrder", orderData(3, "delivery"));
          assert.equal(deliveryOrder.totalAmount, 55, "server controls delivery fee");
          await rpc(marketer, "confirmDatabaseOrder", { orderNumber: deliveryOrder.orderNumber });
          await prepare(deliveryOrder, "delivery");
          await assert.rejects(
            rpc(buyer, "assignDeliveryRider", {
              orderNumber: deliveryOrder.orderNumber,
              riderId: rider.id,
            }),
          );
          await rpc(marketer, "assignDeliveryRider", {
            orderNumber: deliveryOrder.orderNumber,
            riderId: rider.id,
          });
          await rpc(buyer, "sendDirectMessage", {
            participantId: rider.id,
            message: "Test delivery coordination",
          });
          await rpc(rider, "sendDirectMessage", {
            participantId: buyer.id,
            message: "Test rider reply",
          });
          assert.ok(
            (await rpc(rider, "getRiderDeliveryStatus")).assignments.some(
              (row) => row.orderNumber === deliveryOrder.orderNumber,
            ),
          );
          assert.equal(
            (await rpc(actors.SecondRider, "getRiderDeliveryStatus")).assignments.length,
            0,
          );
          await assert.rejects(
            rpc(actors.SecondRider, "updateOrderFulfillment", {
              orderNumber: deliveryOrder.orderNumber,
              status: "out_for_delivery",
            }),
          );
          await rpc(rider, "updateOrderFulfillment", {
            orderNumber: deliveryOrder.orderNumber,
            status: "out_for_delivery",
          });
          const detail = await rpc(buyer, "getOrderDetails", {
            orderNumber: deliveryOrder.orderNumber,
          });
          const proof = {
            orderNumber: deliveryOrder.orderNumber,
            otp: detail.deliveryOtpCode,
            recipientName: "Buyer E2E",
          };
          assert.match(proof.otp, /^\d{6}$/);
          await assert.rejects(
            rpc(rider, "submitDeliveryProof", {
              ...proof,
              otp: proof.otp === "000000" ? "111111" : "000000",
            }),
          );
          await rpc(rider, "submitDeliveryProof", proof);
          await assert.rejects(
            rpc(rider, "sendDirectMessage", {
              participantId: buyer.id,
              message: "Delivery is already complete",
            }),
          );
          await assert.rejects(rpc(rider, "submitDeliveryProof", proof));
          await assert.rejects(
            rpc(rider, "markDatabaseOrderSold", { orderNumber: deliveryOrder.orderNumber }),
          );
          await rpc(marketer, "markDatabaseOrderSold", { orderNumber: deliveryOrder.orderNumber });
          await assert.rejects(
            rpc(accountant, "updateCodRemittance", {
              orderNumber: deliveryOrder.orderNumber,
              action: "close",
            }),
          );
          await rpc(rider, "updateCodRemittance", {
            orderNumber: deliveryOrder.orderNumber,
            action: "submit",
          });
          await rpc(accountant, "updateCodRemittance", {
            orderNumber: deliveryOrder.orderNumber,
            action: "verify",
          });
          await rpc(accountant, "updateCodRemittance", {
            orderNumber: deliveryOrder.orderNumber,
            action: "close",
          });
          assert.equal(
            (await rpc(buyer, "getBuyerOrders")).find(
              (row) => row.orderNumber === deliveryOrder.orderNumber,
            ).paymentStatus,
            "Paid",
          );
          assert.equal(
            (await rpc(accountant, "getWorkspaceSidebarBadges"))["/accounting/payments"],
            0,
          );
        },
      );
      await step(
        "Walk-in confirmation, retry, cancellation, no-stock display, payment and farmer attribution",
        async () => {
          const data = {
            requestId: randomUUID(),
            buyerName: "Walk-in test buyer",
            contact: "",
            items: [{ listingId, quantityKg: 2.5, expectedUnitPrice: 10 }],
          };
          await assert.rejects(rpc(buyer, "createWalkInOrder", data));
          walkInOrder = await rpc(marketer, "createWalkInOrder", data);
          await rpc(marketer, "createWalkInOrder", data);
          assert.equal((await stock()).reserved, 2.5);
          await prepare(walkInOrder);
          await rpc(marketer, "updateOrderFulfillment", {
            orderNumber: walkInOrder.orderNumber,
            status: "picked_up",
          });
          await rpc(marketer, "markDatabaseOrderSold", { orderNumber: walkInOrder.orderNumber });
          assert.equal(
            (await rpc(accountant, "getWorkspaceSidebarBadges"))["/accounting/payments"],
            1,
          );
          await rpc(accountant, "recordDatabasePayment", {
            orderNumber: walkInOrder.orderNumber,
            method: "cash",
          });
          const saved = (await rpc(marketer, "getDatabaseOrders")).find(
            (row) => row.id === walkInOrder.orderNumber,
          );
          assert.equal(saved.source, "walk_in");
          assert.equal(saved.buyer, "Walk-in test buyer");
          assert.equal(saved.paymentStatus, "Paid");
          const workspace = await rpc(actors.RegisteredFarmer, "getFarmerSettlementWorkspace");
          assert.ok(
            workspace.available.some((group) =>
              group.lines.some(
                (line) => line.orderNumber === walkInOrder.orderNumber && line.source === "walk_in",
              ),
            ),
          );
          const remaining = (await stock()).available;
          const drain = await rpc(marketer, "createWalkInOrder", {
            ...data,
            requestId: randomUUID(),
            items: [
              { listingId, quantityKg: remaining, expectedUnitPrice: remaining >= 10 ? 8 : 10 },
            ],
          });
          assert.ok(
            !(await rpc(null, "getMarketplaceListings")).some(
              (product) => product.id === productId,
            ),
          );
          await rpc(marketer, "releaseDatabaseOrder", {
            orderNumber: drain.orderNumber,
            outcome: "cancelled",
            reason: "Isolated cancellation test",
          });
          assert.equal((await stock()).available, remaining);
          assert.ok(
            (await rpc(null, "getMarketplaceListings")).some((product) => product.id === productId),
          );
        },
      );
      await step(
        "Delivered Buyer feedback, delivery dispute, Marketer review and Accounting refund",
        async () => {
          const feedback = await rpc(buyer, "getMyOrderFeedback", {
            orderNumber: deliveryOrder.orderNumber,
          });
          assert.equal(feedback.eligible, true);
          await rpc(buyer, "submitOrderFeedback", {
            orderNumber: deliveryOrder.orderNumber,
            serviceRating: 5,
            riderRating: 5,
            comment: "Isolated test feedback",
            itemRatings: feedback.items.map((item) => ({
              orderItemId: item.orderItemId,
              rating: 5,
            })),
          });
          assert.ok(
            (await rpc(buyer, "getMyOrderFeedback", { orderNumber: deliveryOrder.orderNumber }))
              .feedback,
          );
          const dispute = await rpc(buyer, "createDeliveryDispute", {
            orderNumber: deliveryOrder.orderNumber,
            category: "damaged_product",
            description: "Isolated test delivery concern",
            attachmentUrl: null,
          });
          await assert.rejects(
            rpc(actors.RegisteredBuyer, "respondToDeliveryDispute", {
              disputeId: dispute.id,
              message: "Not my order",
            }),
          );
          await rpc(rider, "respondToDeliveryDispute", {
            disputeId: dispute.id,
            message: "Test rider response",
          });
          await rpc(marketer, "reviewDeliveryDispute", {
            disputeId: dispute.id,
            status: "approved",
            resolution: "partial_refund",
            resolutionNote: "Approved test refund",
            refundAmount: 5,
          });
          await assert.rejects(
            rpc(marketer, "processDeliveryDisputeRefund", { disputeId: dispute.id }),
          );
          await rpc(accountant, "processDeliveryDisputeRefund", { disputeId: dispute.id });
          assert.equal(
            (await rpc(buyer, "getMyDeliveryDisputes")).find((row) => row.id === dispute.id).status,
            "resolved",
          );
        },
      );
      await step(
        "Farmer cash payout and daily closing reconcile through Accounting and Management",
        async () => {
          for (const owner of [farmer, actors.RegisteredFarmer]) {
            const before = await rpc(owner, "getFarmerSettlementWorkspace");
            for (const group of before.available) {
              await assert.rejects(
                rpc(marketer, "releaseFarmerCashPayout", {
                  farmerId: owner.id,
                  receivingId: group.receivingId,
                }),
              );
              await rpc(accountant, "releaseFarmerCashPayout", {
                farmerId: owner.id,
                receivingId: group.receivingId,
              });
              await assert.rejects(
                rpc(accountant, "releaseFarmerCashPayout", {
                  farmerId: owner.id,
                  receivingId: group.receivingId,
                }),
              );
            }
            const after = await rpc(owner, "getFarmerSettlementWorkspace");
            assert.equal(after.availableTotal, 0);
            assert.ok(after.payouts.length);
            assert.ok(after.iponBalance > 0);
          }
          const preview = await rpc(accountant, "getDailyCashClosingPreview", { date: today });
          assert.ok(preview.preview);
          await assert.rejects(
            rpc(marketer, "closeDailyCash", { date: today, openingCash: 0, actualCash: 0 }),
          );
          await rpc(accountant, "closeDailyCash", {
            date: today,
            openingCash: 0,
            actualCash: preview.preview.expectedCash,
            notes: "Isolated all-role test",
          });
          await assert.rejects(
            rpc(accountant, "closeDailyCash", { date: today, openingCash: 0, actualCash: 0 }),
          );
          assert.ok(
            (await rpc(manager, "getDailyCashClosingHistory")).some(
              (row) => row.businessDate === today,
            ),
          );
          assert.ok((await rpc(manager, "getManagementAuditLogs")).length);
        },
      );
      await step(
        "Community, question resolution, direct messages and notification ownership",
        async () => {
          const question = await rpc(farmer, "postCommunityMessage", {
            category: "question",
            message: "Isolated test farming question",
            attachments: [],
          });
          await rpc(marketer, "postCommunityComment", {
            messageId: question.id,
            message: "Isolated test reply",
          });
          await rpc(accountant, "setCommunityReaction", {
            messageId: question.id,
            reaction: "like",
          });
          await assert.rejects(
            rpc(farmer, "setCommunityQuestionStatus", {
              messageId: question.id,
              status: "resolved",
            }),
          );
          await rpc(manager, "setCommunityQuestionStatus", {
            messageId: question.id,
            status: "resolved",
          });
          await assert.rejects(
            rpc(marketer, "postCommunityComment", {
              messageId: question.id,
              message: "Late reply",
            }),
          );
          await assert.rejects(
            rpc(farmer, "sendDirectMessage", {
              participantId: marketer.id,
              message: "Cannot start this conversation",
            }),
          );
          await rpc(marketer, "sendDirectMessage", {
            participantId: farmer.id,
            message: "Test Marketer starts the conversation",
          });
          await rpc(farmer, "sendDirectMessage", {
            participantId: marketer.id,
            message: "Isolated private test message",
          });
          const conversation = await rpc(marketer, "getDirectConversation", {
            participantId: farmer.id,
          });
          assert.match(JSON.stringify(conversation), /Isolated private test message/);
          const inbox = await rpc(farmer, "getCurrentNotifications");
          assert.ok(inbox.length);
          await rpc(buyer, "markNotificationRead", { id: inbox[0].id });
          assert.equal(
            (await rpc(farmer, "getCurrentNotifications")).find((item) => item.id === inbox[0].id)
              .read,
            false,
          );
          await rpc(farmer, "markAllNotificationsRead");
          assert.ok((await rpc(farmer, "getCurrentNotifications")).every((item) => item.read));
        },
      );
      await step(
        "populated dashboards, reports and role pages still load after all saved workflows",
        async () => {
          for (const [name, allowed, data] of workspaceChecks)
            for (const role of allowed) await rpc(actors[role], name, data);
          for (const [role, path] of [
            ["Management", "/management"],
            ["Marketer", "/marketer/orders"],
            ["Accounting", "/accounting/payments"],
            ["Farmer", "/farmer/earnings"],
            ["Buyer", "/buyer/orders"],
            ["Rider", "/rider"],
          ]) {
            const response = await fetch(base + path, {
              headers: {
                cookie: [...actors[role].cookies]
                  .map(([key, value]) => `${key}=${value}`)
                  .join("; "),
              },
              redirect: "manual",
            });
            assert.equal(response.status, 200, `${role} page renders`);
            assert.doesNotMatch(
              await response.text(),
              /Unexpected Application Error|Internal Server Error/,
            );
          }
        },
      );
      await step(
        "Management deactivation revokes an existing session and blocks login until reactivated",
        async () => {
          await assert.rejects(
            rpc(manager, "setManagedUserActive", { userId: manager.id, active: false }),
          );
          await rpc(manager, "setManagedUserActive", { userId: buyer.id, active: false });
          assert.equal(await rpc(buyer, "getCurrentSessionUser"), null);
          await assert.rejects(rpc(buyer, "loginUser", { identifier: buyer.username, password }));
          await rpc(manager, "setManagedUserActive", { userId: buyer.id, active: true });
          await rpc(buyer, "loginUser", { identifier: buyer.username, password });
        },
      );
      await step("all roles can log out and their sessions stop working", async () => {
        for (const actor of Object.values(actors)) {
          const stolenCookie = { cookies: new Map(actor.cookies) };
          await rpc(actor, "logoutUser");
          assert.equal(await rpc(stolenCookie, "getCurrentSessionUser"), null);
        }
      });
    } finally {
      if (server && server.exitCode === null) {
        server.kill();
        await Promise.race([
          once(server, "exit"),
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
      }
      await pool?.end();
      if (created) await admin.query("DROP DATABASE `" + database + "`");
      await admin.end();
    }
  },
);
