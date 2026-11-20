import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, readdir, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import test from "node:test";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as orm from "drizzle-orm";
import ts from "typescript";

// Explicit opt-in, loopback-only integration test. Never uses DATABASE_URL.
const adminUrl = process.env.STOCK_TEST_DATABASE_ADMIN_URL;
test(
  "confirmation allocates stock atomically and legacy holds migrate safely",
  { skip: !adminUrl },
  async () => {
    const target = new URL(adminUrl);
    assert.ok(["127.0.0.1", "localhost", "::1"].includes(target.hostname));
    assert.equal(target.pathname, "/mysql");
    const database = "agrilink_stock_test_" + randomUUID().replaceAll("-", "");
    const scratch = await mkdtemp(join(tmpdir(), "agrilink-stock-migrations-"));
    const admin = await mysql.createConnection(target.toString());
    let pool;
    let created = false;
    try {
      await admin.query("CREATE DATABASE `" + database + "`");
      created = true;
      target.pathname = "/" + database;
      await mkdir(join(scratch, "drizzle"));
      // Include the latest order schema, including account-free walk-in orders.
      for (const file of await readdir("drizzle")) {
        if (/^\d+_.+\.sql$/.test(file)) {
          await copyFile(join("drizzle", file), join(scratch, "drizzle", file));
        }
      }
      const migration = spawnSync(process.execPath, [resolve("scripts/migrate.mjs")], {
        cwd: scratch,
        env: { ...process.env, MIGRATION_DATABASE_URL: target.toString(), DATABASE_SSL: "" },
        encoding: "utf8",
      });
      assert.equal(migration.status, 0, migration.stderr);
      pool = mysql.createPool({
        uri: target.toString(),
        connectionLimit: 5,
        multipleStatements: true,
      });
      const require = createRequire(import.meta.url);
      function evaluate(source, dependencies = {}) {
        const exports = {};
        const compiled = ts.transpileModule(source, {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText;
        runInNewContext(compiled, {
          exports,
          require: (name) => dependencies[name] ?? require(name),
          Date,
          Intl,
          Map,
          Set,
          crypto: { randomUUID },
          console,
        });
        return exports;
      }
      const schema = evaluate(await readFile("src/db/schema.ts", "utf8"));
      const db = drizzle(pool, { schema, mode: "default" });
      const source = await readFile(
        "src/services/marketplace/marketplace-server-functions.ts",
        "utf8",
      );
      const slice = (first, last) =>
        source.slice(source.indexOf(first), source.indexOf(last, source.indexOf(first)));
      let actor = { id: "buyer", roles: ["Buyer"], displayName: "Buyer" };
      const code = [
        "const marketplaceQualityOrder = ['Good','Semi','Reject'];",
        "function marketplaceQualityRank(value) { return marketplaceQualityOrder.indexOf(value); }",
        "const moneyValue = (value) => Number(value.toFixed(2));",
        "const FARMER_SERVICE_FEE_PER_KILOGRAM = 1.25; const FARMER_IPON_PER_KILOGRAM = 0.5;",
        slice("async function createFarmerEarningsForSale(", "function marketplaceQualityRank("),
        slice("function asProduct(", "function listingUnitPrice("),
        slice("function listingUnitPrice(", "async function fetchMarketerListings"),
        slice("async function buyerCartRows(", "export const placeBuyerOrder"),
        slice("export const placeBuyerOrder", "export const getBuyerDeliveryFee"),
        slice("export const getDatabaseOrders", "export const getManagementProductWorkspace"),
        slice("export const getOrderDetails", "export const getDatabaseOrders"),
        slice("export const confirmDatabaseOrder", "export const recordDatabasePayment"),
        source.slice(source.indexOf("export const recordDatabasePayment")),
        slice("export const updateOrderFulfillment", "export const submitDeliveryProof"),
      ].join("\n");
      const validator = {
        validator() {
          return this;
        },
        handler(fn) {
          return fn;
        },
      };
      const context = {
        ...orm,
        createServerFn: () => ({ ...validator }),
        cartItemInput: {},
        setCartItemInput: {},
        checkoutInput: {},
        workflowActionInput: {},
        releaseOrderInput: {},
        walkInOrderInput: {},
        paymentInput: {},
        fulfillmentStatusInput: {},
        orderNumberInput: {},
        requiresWholeSellingQuantity: (unit) => unit !== "kg",
        sellingUnitLabel: (unit) => unit,
      };
      const compiled = ts.transpileModule(code + "\nexport { fetchListings };", {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText;
      const handlers = {};
      runInNewContext(compiled, {
        ...context,
        exports: handlers,
        Date,
        Intl,
        Map,
        Set,
        crypto: { randomUUID },
        require(name) {
          if (name === "@/db/schema") return schema;
          if (name === "@/db/client.server") return { db };
          if (name.includes("auth-server"))
            return {
              requireRole: async (role) => {
                assert.ok(actor.roles.includes(role));
                return actor;
              },
              requireUser: async () => actor,
              requireAnyRole: async (roles) => {
                assert.ok(roles.some((role) => actor.roles.includes(role)));
                return actor;
              },
              writeAuditLog: async () => {},
            };
          if (name.includes("notification-server"))
            return { notifyUser: async () => {}, notifyRole: async () => {} };
          throw new Error("Unexpected dependency " + name);
        },
      });
      await pool.query(
        "INSERT INTO users (id,username,password_hash,display_name) VALUES ('buyer','buyer','test','Buyer'),('marketer','marketer','test','Marketer')",
      );
      const [[quality]] = await pool.query("SELECT id FROM classifications WHERE name='Good'");
      await pool.query(
        "INSERT INTO products (id,name,crop_type) VALUES ('product','Test produce','Vegetable')",
      );
      await pool.query(
        "INSERT INTO inventory (id,product_id,classification_id,quantity_kg,reserved_kg,received_at) VALUES ('stock','product',?,10,0,NOW())",
        [quality.id],
      );
      await pool.query(
        "INSERT INTO marketplace_listings (id,inventory_id,product_id,classification_id,price_per_kg,retail_price_per_kg,price_configured,status) VALUES ('listing','stock','product',?,10,10,1,'published')",
        [quality.id],
      );
      async function stock() {
        const [[row]] = await pool.query(
          "SELECT quantity_kg,reserved_kg FROM inventory WHERE id='stock'",
        );
        return [Number(row.quantity_kg), Number(row.reserved_kg)];
      }
      async function place(quantity = 6) {
        actor = { id: "buyer", roles: ["Buyer"], displayName: "Buyer" };
        await handlers.addBuyerCartItem({ data: { listingId: "listing", quantityKg: quantity } });
        assert.deepEqual(await stock(), [10, 0], "cart must not hold stock");
        return handlers.placeBuyerOrder({
          data: {
            items: [{ listingId: "listing", quantityKg: quantity, expectedUnitPrice: 10 }],
            fulfillment: "pickup",
            contact: "09123456789",
            pickupNote: "Pickup",
          },
        });
      }
      const first = await place();
      const second = await place();
      assert.deepEqual(await stock(), [10, 0], "Pending orders must not hold stock");
      actor = { id: "marketer", roles: ["Marketer"], displayName: "Marketer" };
      const results = await Promise.allSettled([
        handlers.confirmDatabaseOrder({ data: { orderNumber: first.orderNumber } }),
        handlers.confirmDatabaseOrder({ data: { orderNumber: second.orderNumber } }),
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.deepEqual(await stock(), [10, 6], "only one competing confirmation can allocate six");
      const [[confirmed]] = await pool.query(
        "SELECT order_number FROM orders WHERE status='confirmed'",
      );
      await assert.rejects(
        handlers.confirmDatabaseOrder({ data: { orderNumber: confirmed.order_number } }),
      );
      assert.deepEqual(await stock(), [10, 6], "retry must not allocate twice");
      const [[pending]] = await pool.query(
        "SELECT order_number FROM orders WHERE status='pending'",
      );
      await handlers.releaseDatabaseOrder({
        data: { orderNumber: pending.order_number, outcome: "rejected" },
      });
      assert.deepEqual(
        await stock(),
        [10, 6],
        "rejecting Pending must not release another order's allocation",
      );
      await handlers.releaseDatabaseOrder({
        data: { orderNumber: confirmed.order_number, outcome: "cancelled" },
      });
      assert.deepEqual(await stock(), [10, 0]);

      // A later insufficient line must roll back allocations for earlier lines.
      const [[semi]] = await pool.query("SELECT id FROM classifications WHERE name='Semi'");
      await pool.query(
        "INSERT INTO inventory (id,product_id,classification_id,quantity_kg,reserved_kg,received_at) VALUES ('short-stock','product',?,1,0,NOW())",
        [semi.id],
      );
      await pool.query(
        "INSERT INTO marketplace_listings (id,inventory_id,product_id,classification_id,price_per_kg,price_configured,status) VALUES ('short-listing','short-stock','product',?,10,1,'published')",
        [semi.id],
      );
      await pool.query(
        "INSERT INTO orders (id,order_number,buyer_id,status,contact,pickup_note,total_amount) VALUES ('multi','MULTI','buyer','pending','test','Pickup',80)",
      );
      await pool.query(
        "INSERT INTO order_items (id,order_id,listing_id,quantity_kg,price_per_kg) VALUES ('multi-one','multi','listing',6,10),('multi-two','multi','short-listing',2,10)",
      );
      await assert.rejects(handlers.confirmDatabaseOrder({ data: { orderNumber: "MULTI" } }));
      assert.deepEqual(await stock(), [10, 0], "a partial allocation must roll back");
      const [[multi]] = await pool.query("SELECT status FROM orders WHERE id='multi'");
      assert.equal(multi.status, "pending");
      await handlers.releaseDatabaseOrder({ data: { orderNumber: "MULTI", outcome: "rejected" } });
      await pool.query("UPDATE inventory SET quantity_kg=0 WHERE id='short-stock'");

      const full = await place(10);
      actor = { id: "marketer", roles: ["Marketer"] };
      await handlers.confirmDatabaseOrder({ data: { orderNumber: full.orderNumber } });
      assert.equal((await handlers.fetchListings()).length, 0, "zero stock must be hidden");
      await pool.query("UPDATE orders SET fulfillment_status='picked_up' WHERE id=?", [full.id]);
      await handlers.markDatabaseOrderSold({ data: { orderNumber: full.orderNumber } });
      assert.deepEqual(
        await stock(),
        [0, 0],
        "Sold consumes the allocation without reducing availability twice",
      );
      await pool.query("UPDATE inventory SET quantity_kg=10 WHERE id='stock'");
      assert.equal(
        (await handlers.fetchListings()).length,
        1,
        "restock automatically restores published listing",
      );

      // Simulate old Pending and cart allocations, then run the upgrade twice.
      const legacy = await place(2);
      await pool.query(
        "INSERT INTO orders (id,order_number,buyer_id,status,contact,pickup_note,total_amount) VALUES ('old-confirmed','OLD-CONFIRMED','buyer','confirmed','test','Pickup',40),('old-no-ledger','OLD-NO-LEDGER','buyer','pending','test','Pickup',10)",
      );
      await pool.query(
        "INSERT INTO order_items (id,order_id,listing_id,quantity_kg,price_per_kg) VALUES ('old-line','old-no-ledger','listing',1,10)",
      );
      await pool.query(
        "INSERT INTO inventory_movements (id,inventory_id,movement_type,reserved_change_kg,reference_type,reference_id) VALUES (UUID(),'stock','reservation',4,'order','old-confirmed')",
      );
      await pool.query("UPDATE inventory SET reserved_kg=10 WHERE id='stock'");
      await pool.query(
        "INSERT INTO inventory_movements (id,inventory_id,movement_type,reserved_change_kg,reference_type,reference_id) VALUES (UUID(),'stock','reservation',2,'order',?),(UUID(),'stock','reservation',3,'cart','old-cart')",
        [legacy.id],
      );
      const upgrade = await readFile("drizzle/0045_confirmation_stock_allocation.sql", "utf8");
      const connection = await pool.getConnection();
      try {
        // Reproduce the hosted deployment's retained temporary-table names.
        await connection.query("CREATE TEMPORARY TABLE confirmation_stock_releases (marker INT)");
        await connection.query("INSERT INTO confirmation_stock_releases VALUES (17)");
        await connection.query("CREATE TEMPORARY TABLE confirmation_stock_check (marker INT)");
        const runner = await readFile("scripts/migrate.mjs", "utf8");
        const start = runner.indexOf("async function applyConfirmationStockMigration(");
        const end = runner.indexOf("\ntry {\n  await connection.execute", start);
        const apply = runInNewContext(runner.slice(start, end) + "\napplyMigration", {
          connection,
          console,
        });
        for (let attempt = 0; attempt < 2; attempt++) {
          await connection.beginTransaction();
          await apply("0045_confirmation_stock_allocation.sql", upgrade);
          await connection.commit();
          assert.deepEqual(
            await stock(),
            [10, 4],
            "upgrade safely releases old holds and can be retried",
          );
        }
        const [[retained]] = await connection.query(
          "SELECT marker FROM confirmation_stock_releases",
        );
        assert.equal(
          retained.marker,
          17,
          "upgrade must not reuse or alter retained temporary tables",
        );
        // Historical holds may still be in the ledger after their actual stock
        // was released. Retire that history without taking Confirmed allocations.
        await connection.query(
          "INSERT INTO inventory_movements (id,inventory_id,movement_type,reserved_change_kg,reference_type,reference_id) VALUES (UUID(),'stock','reservation',20,'cart','stale-cart')",
        );
        for (let attempt = 0; attempt < 2; attempt++) {
          await connection.beginTransaction();
          await apply("0045_confirmation_stock_allocation.sql", upgrade);
          await connection.commit();
          assert.deepEqual(await stock(), [10, 4], "stale history must not reduce Confirmed stock");
        }
        const [[stale]] = await connection.query(
          "SELECT SUM(reserved_change_kg) AS remaining FROM inventory_movements WHERE reference_type='cart' AND reference_id='stale-cart'",
        );
        assert.equal(Number(stale.remaining), 0, "stale reservations are retired once");

        await connection.query(
          "INSERT INTO inventory_movements (id,inventory_id,movement_type,reserved_change_kg,reference_type,reference_id) VALUES ('other-hold','stock','reservation',2,'manual_hold','protected-hold'),(UUID(),'stock','reservation',1,'cart','another-stale-cart')",
        );
        await connection.query("UPDATE inventory SET reserved_kg=6 WHERE id='stock'");
        await connection.beginTransaction();
        await apply("0045_confirmation_stock_allocation.sql", upgrade);
        await connection.commit();
        assert.deepEqual(await stock(), [10, 6], "other saved holds must also remain protected");
        // Remove only the additional test fixture before the existing assertions.
        await connection.query("DELETE FROM inventory_movements WHERE id='other-hold'");
        await connection.query("UPDATE inventory SET reserved_kg=4 WHERE id='stock'");
        await connection.query(
          "INSERT INTO orders (id,order_number,buyer_id,status,contact,pickup_note,total_amount) VALUES ('legacy-confirmed-no-ledger','LEGACY-CONFIRMED-NO-LEDGER','buyer','confirmed','test','Pickup',20)",
        );
        await connection.query(
          "INSERT INTO order_items (id,order_id,listing_id,quantity_kg,price_per_kg) VALUES ('legacy-confirmed-line','legacy-confirmed-no-ledger','listing',2,10)",
        );
        await connection.query(
          "INSERT INTO inventory_movements (id,inventory_id,movement_type,reserved_change_kg,reference_type,reference_id) VALUES (UUID(),'stock','reservation',1,'cart','stale-legacy-cart')",
        );
        await connection.query("UPDATE inventory SET reserved_kg=6 WHERE id='stock'");
        await connection.beginTransaction();
        await apply("0045_confirmation_stock_allocation.sql", upgrade);
        await connection.commit();
        assert.deepEqual(
          await stock(),
          [10, 6],
          "legacy Confirmed orders without ledger entries keep their holds",
        );
        await connection.query("DELETE FROM order_items WHERE id='legacy-confirmed-line'");
        await connection.query("DELETE FROM orders WHERE id='legacy-confirmed-no-ledger'");
        await connection.query("UPDATE inventory SET reserved_kg=4 WHERE id='stock'");
        await connection.query(
          "INSERT INTO inventory_movements (id,inventory_id,movement_type,reserved_change_kg,reference_type,reference_id) VALUES ('invalid-cart','stock','reservation',1,'cart','invalid-cart')",
        );
        await connection.query("UPDATE inventory SET reserved_kg=3 WHERE id='stock'");
        await connection.beginTransaction();
        await assert.rejects(
          apply("0045_confirmation_stock_allocation.sql", upgrade),
          /cannot protect existing allocations/,
        );
        await connection.rollback();
        assert.deepEqual(
          await stock(),
          [10, 3],
          "inconsistent Confirmed stock must not be rewritten",
        );
        await connection.query("DELETE FROM inventory_movements WHERE id='invalid-cart'");
        await connection.query("UPDATE inventory SET reserved_kg=4 WHERE id='stock'");
      } finally {
        connection.release();
      }
      actor = { id: "marketer", roles: ["Marketer"] };
      await handlers.confirmDatabaseOrder({ data: { orderNumber: legacy.orderNumber } });
      assert.deepEqual(
        await stock(),
        [10, 6],
        "migrated Pending order allocates only once on confirmation",
      );
      const orderRecords = await handlers.getDatabaseOrders();
      const migratedRecord = orderRecords.find((order) => order.id === legacy.orderNumber);
      assert.equal(migratedRecord.items[0].availableKg, 4);
      assert.equal(
        migratedRecord.allocations.reduce((total, item) => total + item.quantityKg, 0),
        2,
      );
      const soldRecord = orderRecords.find((order) => order.id === full.orderNumber);
      assert.equal(
        soldRecord.allocations.reduce((total, item) => total + item.quantityKg, 0),
        10,
      );
      await handlers.releaseDatabaseOrder({
        data: { orderNumber: "OLD-CONFIRMED", outcome: "cancelled" },
      });
      assert.deepEqual(
        await stock(),
        [10, 2],
        "pre-existing Confirmed allocation remains cancellable",
      );
      await handlers.releaseDatabaseOrder({
        data: { orderNumber: "OLD-NO-LEDGER", outcome: "rejected" },
      });
      assert.deepEqual(
        await stock(),
        [10, 2],
        "legacy Pending rejection does not release a different order",
      );

      // Account-free walk-ins use the same protected allocation and settlement pipeline.
      const inputSchema = evaluate(
        await readFile("src/features/marketplace/walk-in-order.ts", "utf8"),
      ).walkInOrderInput;
      const productId = randomUUID();
      const listingId = randomUUID();
      const farmers = [randomUUID(), randomUUID()];
      const receiving = [randomUUID(), randomUUID()];
      const batches = [randomUUID(), randomUUID()];
      for (let i = 0; i < 2; i++) {
        await pool.query(
          "INSERT INTO users (id,username,password_hash,display_name) VALUES (?,?,'test',?)",
          [farmers[i], `farmer-${i}`, `Farmer ${i + 1}`],
        );
      }
      await pool.query(
        "INSERT INTO users (id,username,password_hash,display_name) VALUES ('accounting','accounting','test','Accounting')",
      );
      await pool.query(
        "INSERT INTO products (id,name,crop_type) VALUES (?,'Walk-in produce','Vegetable')",
        [productId],
      );
      for (let i = 0; i < 2; i++) {
        await pool.query(
          "INSERT INTO receiving_records (id,farmer_id,recorded_by_id,product_id,total_kg,received_at) VALUES (?,?,'marketer',?,?,?)",
          [receiving[i], farmers[i], productId, i === 0 ? 3 : 7, `2026-01-0${i + 1} 10:00:00`],
        );
        await pool.query(
          "INSERT INTO inventory (id,product_id,classification_id,farmer_id,receiving_id,quantity_kg,reserved_kg,received_at) VALUES (?,?,?,?,?,?,0,?)",
          [
            batches[i],
            productId,
            quality.id,
            farmers[i],
            receiving[i],
            i === 0 ? 3 : 7,
            `2026-01-0${i + 1} 10:00:00`,
          ],
        );
      }
      await pool.query(
        "INSERT INTO marketplace_listings (id,inventory_id,product_id,classification_id,price_per_kg,retail_price_per_kg,price_configured,status) VALUES (?,?,?,?,10,10,1,'published')",
        [listingId, batches[0], productId, quality.id],
      );
      const walkData = (quantity = 5) => ({
        requestId: randomUUID(),
        buyerName: "Walk-in customer",
        contact: "",
        items: [{ listingId, quantityKg: quantity, expectedUnitPrice: 10 }],
      });
      for (const bad of [
        { ...walkData(), buyerName: " " },
        { ...walkData(), items: [] },
        { ...walkData(), items: [{ listingId, quantityKg: -1, expectedUnitPrice: 10 }] },
        { ...walkData(), items: [{ listingId, quantityKg: 0.001, expectedUnitPrice: 10 }] },
        { ...walkData(), items: [...walkData().items, ...walkData().items] },
      ])
        assert.equal(inputSchema.safeParse(bad).success, false);
      const balances = async () => {
        const [rows] = await pool.query(
          "SELECT quantity_kg,reserved_kg FROM inventory WHERE product_id=? ORDER BY received_at",
          [productId],
        );
        return rows.map((row) => [Number(row.quantity_kg), Number(row.reserved_kg)]);
      };
      actor = { id: "buyer", roles: ["Buyer"] };
      await assert.rejects(handlers.createWalkInOrder({ data: walkData() }));
      actor = { id: "accounting", roles: ["Accounting"] };
      await assert.rejects(handlers.createWalkInOrder({ data: walkData() }));
      actor = { id: "marketer", roles: ["Marketer"] };
      const invalidPrice = walkData();
      invalidPrice.items[0].expectedUnitPrice = 1;
      await assert.rejects(handlers.createWalkInOrder({ data: invalidPrice }), /price changed/);
      const tooMuch = walkData(11);
      await assert.rejects(handlers.createWalkInOrder({ data: tooMuch }), /currently available/);
      const partial = walkData();
      partial.items.push({ listingId: "short-listing", quantityKg: 2, expectedUnitPrice: 10 });
      await assert.rejects(handlers.createWalkInOrder({ data: partial }), /currently available/);
      const [[noPartial]] = await pool.query(
        "SELECT COUNT(*) AS total FROM orders WHERE source='walk_in'",
      );
      assert.equal(noPartial.total, 0, "failed confirmations create no partial order");
      assert.deepEqual(await balances(), [
        [3, 0],
        [7, 0],
      ]);
      const cancelData = walkData();
      const cancelledWalk = await handlers.createWalkInOrder({ data: cancelData });
      assert.deepEqual(
        await balances(),
        [
          [3, 3],
          [7, 2],
        ],
        "oldest farmer batches allocated first",
      );
      await handlers.createWalkInOrder({ data: cancelData });
      assert.deepEqual(
        await balances(),
        [
          [3, 3],
          [7, 2],
        ],
        "retry cannot allocate again",
      );
      await handlers.releaseDatabaseOrder({
        data: { orderNumber: cancelledWalk.orderNumber, outcome: "cancelled" },
      });
      assert.deepEqual(
        await balances(),
        [
          [3, 0],
          [7, 0],
        ],
        "cancellation restores both farmers' stock",
      );

      // An online confirmation and walk-in confirmation cannot oversell shared inventory.
      const competitor = randomUUID();
      await pool.query(
        "INSERT INTO orders (id,order_number,buyer_id,status,contact,pickup_note,total_amount) VALUES (?,'WALK-COMPETITOR','buyer','pending','','Pickup',60)",
        [competitor],
      );
      await pool.query(
        "INSERT INTO order_items (id,order_id,listing_id,quantity_kg,price_per_kg) VALUES (?,?,?,6,10)",
        [randomUUID(), competitor, listingId],
      );
      const competingWalkData = walkData(6);
      const competing = await Promise.allSettled([
        handlers.createWalkInOrder({ data: competingWalkData }),
        handlers.confirmDatabaseOrder({ data: { orderNumber: "WALK-COMPETITOR" } }),
      ]);
      assert.equal(competing.filter((result) => result.status === "fulfilled").length, 1);
      const [winners] = await pool.query(
        "SELECT order_number FROM orders WHERE status='confirmed' AND (id=? OR id=?)",
        [competitor, competingWalkData.requestId],
      );
      for (const winner of winners)
        await handlers.releaseDatabaseOrder({
          data: { orderNumber: winner.order_number, outcome: "cancelled" },
        });
      assert.deepEqual(await balances(), [
        [3, 0],
        [7, 0],
      ]);

      const saleData = walkData();
      const sale = await handlers.createWalkInOrder({ data: saleData });
      const record = (await handlers.getDatabaseOrders()).find(
        (order) => order.id === sale.orderNumber,
      );
      assert.equal(record.buyer, "Walk-in customer");
      assert.equal(record.source, "walk_in");
      assert.equal(record.paymentStatus, "Unpaid");
      assert.equal(record.amount, 50);
      assert.equal(record.allocations.length, 2);
      const [[noAccount]] = await pool.query(
        "SELECT buyer_id,created_by_id FROM orders WHERE id=?",
        [saleData.requestId],
      );
      assert.equal(noAccount.buyer_id, null);
      assert.equal(noAccount.created_by_id, "marketer");
      const details = await handlers.getOrderDetails({ data: { orderNumber: sale.orderNumber } });
      assert.equal(details.source, "walk_in");
      assert.equal(details.buyer, "Walk-in customer");
      actor = { id: "buyer", roles: ["Buyer"] };
      await assert.rejects(
        handlers.getOrderDetails({ data: { orderNumber: sale.orderNumber } }),
        /permission/,
      );
      actor = { id: "marketer", roles: ["Marketer"] };
      await assert.rejects(
        handlers.markDatabaseOrderSold({ data: { orderNumber: sale.orderNumber } }),
        /Picked up/,
      );
      for (const status of ["preparing", "ready_for_pickup", "picked_up"]) {
        await handlers.updateOrderFulfillment({ data: { orderNumber: sale.orderNumber, status } });
      }
      await handlers.markDatabaseOrderSold({ data: { orderNumber: sale.orderNumber } });
      await assert.rejects(
        handlers.markDatabaseOrderSold({ data: { orderNumber: sale.orderNumber } }),
      );
      assert.deepEqual(
        await balances(),
        [
          [0, 0],
          [5, 0],
        ],
        "Sold consumes stock only once",
      );
      const [earnings] = await pool.query(
        "SELECT farmer_id,receiving_id,quantity,gross_amount,net_amount,status FROM farmer_earnings WHERE order_id=? ORDER BY quantity DESC",
        [saleData.requestId],
      );
      assert.equal(earnings.length, 2, "each original farmer receives an earnings record");
      assert.equal(earnings[0].farmer_id, farmers[0]);
      assert.equal(earnings[0].receiving_id, receiving[0]);
      assert.equal(Number(earnings[0].quantity), 3);
      assert.equal(Number(earnings[0].gross_amount), 30);
      assert.equal(Number(earnings[0].net_amount), 24.75);
      assert.equal(earnings[1].farmer_id, farmers[1]);
      assert.equal(Number(earnings[1].net_amount), 16.5);
      assert.ok(earnings.every((row) => row.status === "pending_payment"));
      await assert.rejects(
        handlers.recordDatabasePayment({ data: { orderNumber: sale.orderNumber, method: "cash" } }),
      );
      actor = { id: "accounting", roles: ["Accounting"] };
      await handlers.recordDatabasePayment({
        data: { orderNumber: sale.orderNumber, method: "cash" },
      });
      await assert.rejects(
        handlers.recordDatabasePayment({ data: { orderNumber: sale.orderNumber, method: "cash" } }),
      );
      const [available] = await pool.query("SELECT status FROM farmer_earnings WHERE order_id=?", [
        saleData.requestId,
      ]);
      assert.ok(
        available.every((row) => row.status === "available"),
        "payment makes both farmers eligible for payout",
      );
      const paid = (await handlers.getDatabaseOrders()).find(
        (order) => order.id === sale.orderNumber,
      );
      assert.equal(paid.status, "Sold");
      assert.equal(paid.paymentStatus, "Paid");
      assert.ok(paid.paymentId);
      assert.equal(paid.source, "walk_in");
    } finally {
      await pool?.end();
      if (created) await admin.query("DROP DATABASE `" + database + "`");
      await admin.end();
      await rm(scratch, { recursive: true, force: true });
    }
  },
);
