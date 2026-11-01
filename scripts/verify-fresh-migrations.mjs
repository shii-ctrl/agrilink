import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const applicationDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseAdminUrl = process.env.TEST_DATABASE_ADMIN_URL;
const prefix = process.env.TEST_DATABASE_PREFIX;
const testEnvironment = process.env.TEST_DATABASE_ENVIRONMENT;
if (!applicationDatabaseUrl)
  throw new Error("DATABASE_URL is required to verify the test database is isolated.");
if (!testDatabaseAdminUrl || !prefix || testEnvironment !== "disposable") {
  throw new Error(
    "Set TEST_DATABASE_ADMIN_URL, TEST_DATABASE_PREFIX, and TEST_DATABASE_ENVIRONMENT=disposable for isolated migration tests.",
  );
}
const appUrl = new URL(applicationDatabaseUrl);
const adminUrl = new URL(testDatabaseAdminUrl);
if (!/^[A-Za-z][A-Za-z0-9_]{2,40}$/.test(prefix)) {
  throw new Error("TEST_DATABASE_PREFIX may contain only letters, numbers, and underscores.");
}
if (!prefix.toLowerCase().includes("test")) {
  throw new Error("TEST_DATABASE_PREFIX must include 'test' to identify disposable databases.");
}
if (!["127.0.0.1", "localhost", "::1"].includes(adminUrl.hostname)) {
  throw new Error("TEST_DATABASE_ADMIN_URL must use a loopback host, never a production server.");
}
if (!adminUrl.username || !["mysql", "information_schema"].includes(adminUrl.pathname.slice(1))) {
  throw new Error(
    "TEST_DATABASE_ADMIN_URL must use an explicit admin credential and the mysql or information_schema database.",
  );
}
const applicationDatabaseName = appUrl.pathname.slice(1);
if (
  /(prod|production)/i.test(applicationDatabaseName) &&
  appUrl.hostname === adminUrl.hostname &&
  appUrl.port === adminUrl.port
) {
  throw new Error(
    "Refusing to create test databases on the configured production application server.",
  );
}

const database = `${prefix}${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
if (database.length > 64) throw new Error("TEST_DATABASE_PREFIX is too long.");
if (applicationDatabaseName === database) {
  throw new Error("The generated test database must be different from the application database.");
}

const testUrl = new URL(adminUrl);
testUrl.pathname = `/${database}`;
let createdByThisRun = false;
const admin = await mysql.createConnection(adminUrl.toString());

function run(command, env) {
  const result = spawnSync(process.execPath, command, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) throw new Error(`Verification command failed: ${command.join(" ")}`);
}

try {
  const [existing] = await admin.query("SHOW DATABASES LIKE ?", [database]);
  if (existing.length) throw new Error("Refusing to use a pre-existing test database.");

  await admin.query(
    `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  createdByThisRun = true;
  run(["scripts/migrate.mjs"], { MIGRATION_DATABASE_URL: testUrl.toString() });

  const db = await mysql.createConnection(testUrl.toString());
  try {
    const [[tables]] = await db.query(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ?",
      [database],
    );
    const [[retiredRoles]] = await db.query(
      "SELECT COUNT(*) AS total FROM roles WHERE name IN ('Farm Consultant', 'Consultant')",
    );
    const [[classifications]] = await db.query("SELECT COUNT(*) AS total FROM classifications");
    const [[users]] = await db.query("SELECT COUNT(*) AS total FROM users");
    const [[products]] = await db.query("SELECT COUNT(*) AS total FROM products");
    const [[orders]] = await db.query("SELECT COUNT(*) AS total FROM orders");
    const [[payments]] = await db.query("SELECT COUNT(*) AS total FROM payments");
    const [[receiving]] = await db.query("SELECT COUNT(*) AS total FROM receiving_records");
    const [[productionRecordsTable]] = await db.query(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'production_records'",
    );
    const [legacyModes] = await db.query(
      "SELECT migration_id, application_mode FROM _agrilink_migration_modes WHERE migration_id IN (?, ?) ORDER BY migration_id",
      ["0001_operational_tables_and_demo_seed.sql", "0002_production_records.sql"],
    );
    if (
      tables.total < 20 ||
      retiredRoles.total !== 0 ||
      classifications.total !== 3 ||
      users.total !== 0 ||
      products.total !== 0 ||
      orders.total !== 0 ||
      payments.total !== 0 ||
      receiving.total !== 0 ||
      productionRecordsTable.total !== 0 ||
      legacyModes.length !== 2 ||
      legacyModes.some((mode) => mode.application_mode !== "schema_only")
    ) {
      throw new Error("Fresh production migration includes unexpected schema or demo data.");
    }
  } finally {
    await db.end();
  }

  run(["scripts/seed-development.mjs"], {
    SEED_DATABASE_URL: testUrl.toString(),
    ALLOW_DEVELOPMENT_SEED: "YES",
    NODE_ENV: "development",
    DEV_SEED_PASSWORD: "development-test-password",
  });

  const seededDb = await mysql.createConnection(testUrl.toString());
  try {
    const [[users]] = await seededDb.query("SELECT COUNT(*) AS total FROM users");
    const [[products]] = await seededDb.query("SELECT COUNT(*) AS total FROM products");
    const [[orders]] = await seededDb.query("SELECT COUNT(*) AS total FROM orders");
    const [[payments]] = await seededDb.query("SELECT COUNT(*) AS total FROM payments");
    const [[receiving]] = await seededDb.query("SELECT COUNT(*) AS total FROM receiving_records");
    if (
      users.total !== 5 ||
      products.total !== 4 ||
      orders.total !== 2 ||
      payments.total !== 1 ||
      receiving.total !== 2
    ) {
      throw new Error("Development seed did not create the expected demonstration records.");
    }
    console.log("Fresh production migration and explicit development seed verification passed.");
  } finally {
    await seededDb.end();
  }
} finally {
  if (createdByThisRun) await admin.query(`DROP DATABASE \`${database}\``);
  await admin.end();
}
