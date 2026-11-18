import assert from "node:assert/strict";
import { randomUUID, webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, readdir, copyFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import test from "node:test";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import bcrypt from "bcryptjs";
import ts from "typescript";

const adminUrl = process.env.FARMER_TEST_DATABASE_ADMIN_URL;
test(
  "Farmer applications require Management approval and preserve existing accounts",
  { skip: !adminUrl },
  async () => {
    const target = new URL(adminUrl);
    assert.ok(["127.0.0.1", "localhost", "::1"].includes(target.hostname));
    assert.equal(target.pathname, "/mysql");
    const database = "agrilink_farmer_test_" + randomUUID().replaceAll("-", "");
    const scratch = await mkdtemp(join(tmpdir(), "agrilink-farmer-migrations-"));
    const admin = await mysql.createConnection(target.toString());
    let pool;
    let created = false;
    try {
      await admin.query("CREATE DATABASE `" + database + "`");
      created = true;
      target.pathname = "/" + database;
      await mkdir(join(scratch, "drizzle"));
      for (const file of await readdir("drizzle")) {
        if (/^\d+_.+\.sql$/.test(file) && Number(file.slice(0, 4)) <= 45) {
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
      const modules = new Map();
      const cookies = new Map();
      let db;
      function load(name) {
        if (name === "bcryptjs") return { ...bcrypt, default: bcrypt };
        if (name === "@/db/client.server") return { db };
        if (name === "@tanstack/react-start/server")
          return {
            getCookie: (key) => cookies.get(key),
            setCookie: (key, value) => cookies.set(key, value),
            deleteCookie: (key) => cookies.delete(key),
            getRequestIP: () => "127.0.0.1",
          };
        if (name === "@tanstack/react-start")
          return {
            createServerFn() {
              let validator;
              return {
                validator(value) {
                  validator = value;
                  return this;
                },
                handler(fn) {
                  return (input = {}) =>
                    fn({ data: validator ? validator.parse(input.data) : input.data });
                },
              };
            },
          };
        if (!name.startsWith("@/")) return require(name);
        if (modules.has(name)) return modules.get(name);
        const exports = {};
        modules.set(name, exports);
        const code = ts.transpileModule(
          readFileSync(resolve("src", name.slice(2) + ".ts"), "utf8"),
          {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
          },
        ).outputText;
        runInNewContext(code, {
          exports,
          require: load,
          Date,
          Map,
          Set,
          Buffer,
          TextEncoder,
          Uint8Array,
          crypto: webcrypto,
          btoa,
          process: { env: { NODE_ENV: "test" } },
          console,
        });
        return exports;
      }
      const schema = load("@/db/schema");
      db = drizzle(pool, { schema, mode: "default" });
      const password = "Farmer-test-password-2026";
      const managerId = randomUUID(),
        existingId = randomUUID(),
        inactiveId = randomUUID();
      const passwordHash = await bcrypt.hash(password, 12);
      await db.insert(schema.users).values([
        { id: managerId, username: "manager", displayName: "Manager", passwordHash, active: true },
        {
          id: existingId,
          username: "existing.farmer",
          displayName: "Existing Farmer",
          passwordHash,
          active: true,
        },
        {
          id: inactiveId,
          username: "inactive.farmer",
          displayName: "Inactive Farmer",
          passwordHash,
          active: false,
        },
      ]);
      const [roleRows] = await pool.query("SELECT id,name FROM roles");
      const roleId = (name) => roleRows.find((role) => role.name === name).id;
      await db.insert(schema.userRoles).values([
        { userId: managerId, roleId: roleId("Management") },
        { userId: existingId, roleId: roleId("Farmer") },
        { userId: inactiveId, roleId: roleId("Farmer") },
      ]);
      const upgrade = await readFile("drizzle/0046_farmer_applications.sql", "utf8");
      await pool.query(upgrade);
      await pool.query(upgrade);
      const [legacy] = await pool.query(
        "SELECT u.id,u.active,a.status FROM users u JOIN farmer_applications a ON a.user_id=u.id",
      );
      assert.equal(legacy.length, 2);
      assert.ok(legacy.every((row) => row.status === "approved"));
      assert.equal(legacy.find((row) => row.id === existingId).active, 1);
      assert.equal(legacy.find((row) => row.id === inactiveId).active, 0);

      const auth = load("@/services/auth/auth-server");
      const login = load("@/services/auth/auth-functions");
      const applications = load("@/services/auth/farmer-application-server-functions");
      const adminFunctions = load("@/services/auth/admin-server-functions");
      async function register(username, extra = {}) {
        return applications.registerFarmer({
          data: {
            username,
            password,
            name: "Test Farmer",
            contact: "09123456789",
            farmingLocation: "Barangay Test, Lucban, Quezon",
            ...extra,
          },
        });
      }
      const result = await register("new.farmer", {
        role: "Management",
        active: true,
        status: "approved",
      });
      assert.equal(result.status, "pending");
      assert.equal(Object.keys(result).sort().join(","), "status,username");
      assert.equal(cookies.size, 0, "registration must not create a session");
      const applicant = await auth.findUserByIdentifier("new.farmer");
      assert.equal(applicant.active, false);
      assert.notEqual(applicant.passwordHash, password);
      const [beforeApproval] = await pool.query("SELECT * FROM user_roles WHERE user_id=?", [
        applicant.id,
      ]);
      assert.equal(beforeApproval.length, 0, "pending applicant must have no Farmer role");
      await assert.rejects(register("new.farmer"), /username is already in use/);
      await assert.rejects(
        login.loginUser({ data: { identifier: "new.farmer", password } }),
        /Farmer application pending/,
      );
      await assert.rejects(
        login.loginUser({ data: { identifier: "new.farmer", password: "wrong-password" } }),
        /Invalid username/,
      );
      assert.equal(cookies.size, 0);
      await assert.rejects(applications.getFarmerApplications(), /Authentication required/);

      // Even an accidentally activated account/session cannot bypass application review.
      await pool.query("UPDATE users SET active=1 WHERE id=?", [applicant.id]);
      await auth.createSession(applicant.id);
      assert.equal(await auth.getCurrentUser(), null);
      await assert.rejects(auth.requireRole("Farmer"), /Authentication required/);
      await pool.query("UPDATE users SET active=0 WHERE id=?", [applicant.id]);

      await auth.createSession(existingId);
      assert.ok((await auth.requireRole("Farmer")).roles.includes("Farmer"));
      await assert.rejects(applications.getFarmerApplications(), /permission/);
      await assert.rejects(
        applications.reviewFarmerApplication({
          data: { userId: applicant.id, decision: "approved" },
        }),
        /permission/,
      );
      await auth.createSession(managerId);
      const reviews = await Promise.allSettled([
        applications.reviewFarmerApplication({
          data: { userId: applicant.id, decision: "approved" },
        }),
        applications.reviewFarmerApplication({
          data: { userId: applicant.id, decision: "approved" },
        }),
      ]);
      assert.equal(reviews.filter((review) => review.status === "fulfilled").length, 1);
      const [approvedRoles] = await pool.query("SELECT * FROM user_roles WHERE user_id=?", [
        applicant.id,
      ]);
      assert.equal(approvedRoles.length, 1);
      assert.equal(approvedRoles[0].role_id, roleId("Farmer"));
      const approved = await login.loginUser({ data: { identifier: "NEW.FARMER", password } });
      assert.ok(approved.roles.includes("Farmer"));
      assert.equal((await auth.requireRole("Farmer")).id, applicant.id);
      await assert.rejects(
        login.loginUser({ data: { identifier: "inactive.farmer", password } }),
        /Invalid username/,
      );

      await auth.createSession(managerId);
      assert.throws(() =>
        adminFunctions.createManagementUser({
          data: {
            name: "Bypass Farmer",
            contact: "09123456789",
            email: "bypass@example.com",
            password,
            role: "Farmer",
            active: true,
          },
        }),
      );
      await register("rejected.farmer");
      const rejected = await auth.findUserByIdentifier("rejected.farmer");
      assert.throws(() =>
        applications.reviewFarmerApplication({
          data: { userId: rejected.id, decision: "rejected", reason: "" },
        }),
      );
      await applications.reviewFarmerApplication({
        data: {
          userId: rejected.id,
          decision: "rejected",
          reason: "Please confirm your farming location with Management.",
        },
      });
      cookies.clear();
      await assert.rejects(
        login.loginUser({ data: { identifier: "rejected.farmer", password } }),
        /Farmer application rejected: Please confirm/,
      );
      assert.equal(cookies.size, 0);
      await auth.createSession(managerId);
      const listed = await applications.getFarmerApplications();
      assert.equal(listed.filter((application) => application.status === "approved").length, 3);
      assert.equal(listed.filter((application) => application.status === "rejected").length, 1);
      assert.ok(listed.every((application) => !("passwordHash" in application)));
    } finally {
      await pool?.end();
      if (created) await admin.query("DROP DATABASE `" + database + "`");
      await admin.end();
      await rm(scratch, { recursive: true, force: true });
    }
  },
);
