import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("migration verification refuses to run without explicit disposable test settings", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-fresh-migrations.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      TEST_DATABASE_ADMIN_URL: "",
      TEST_DATABASE_PREFIX: "",
      TEST_DATABASE_ENVIRONMENT: "",
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TEST_DATABASE_ADMIN_URL, TEST_DATABASE_PREFIX/);
});

test("development seed rejects an unsafe target before opening a database connection", () => {
  const result = spawnSync(process.execPath, ["scripts/seed-development.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "development",
      ALLOW_DEVELOPMENT_SEED: "YES",
      DEV_SEED_PASSWORD: "development-test-password",
      SEED_DATABASE_URL: "mysql://test_user:test_password@production.example/agrilink_production",
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /only accepts a loopback SEED_DATABASE_URL/);
});

test("migration verifier rejects a non-loopback test server before opening a database connection", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-fresh-migrations.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      TEST_DATABASE_ADMIN_URL: "mysql://test_user:test_password@production.example/mysql",
      TEST_DATABASE_PREFIX: "agrilink_test_",
      TEST_DATABASE_ENVIRONMENT: "disposable",
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must use a loopback host/);
});

test("migration verifier rejects a local test target when the configured application database is production", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-fresh-migrations.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: "mysql://root:@127.0.0.1:3306/agrilink_production",
      TEST_DATABASE_ADMIN_URL: "mysql://test_user:test_password@127.0.0.1:3306/mysql",
      TEST_DATABASE_PREFIX: "agrilink_test_",
      TEST_DATABASE_ENVIRONMENT: "disposable",
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /configured production application server/);
});

test("migration runner resumes MariaDB inventory traceability without changing published SQL", async () => {
  const [runner, migration] = await Promise.all([
    readFile("scripts/migrate.mjs", "utf8"),
    readFile("drizzle/0006_inventory_farmer_traceability.sql", "utf8"),
  ]);

  assert.match(runner, /ensureInventoryFarmerForeignKey/);
  assert.match(runner, /information_schema\.TABLE_CONSTRAINTS/);
  assert.match(runner, /Could not locate the inventory Farmer foreign key/);
  assert.match(migration, /ADD CONSTRAINT IF NOT EXISTS fk_inventory_farmer/);
});
