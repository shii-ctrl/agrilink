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

test("catalog integrity recovery preserves duplicate legacy products before adding a unique name index", async () => {
  const runner = await readFile("scripts/migrate.mjs", "utf8");

  assert.match(runner, /prepareCatalogNameIntegrityMigration/);
  assert.match(runner, /TABLE_NAME = 'products'/);
  assert.match(runner, /HAVING COUNT\(\*\) > 1/);
  assert.match(runner, /\[legacy \$\{product\.id\}\]/);
  assert.match(runner, /ORDER BY created_at ASC, id ASC/);
});

test("Vercel applies checked migrations before building production code", async () => {
  const config = JSON.parse(await readFile("vercel.json", "utf8"));
  assert.equal(config.buildCommand, "npm run db:migrate && npm run build");
});

test("retired profile-photo visibility choices normalize to Everyone", async () => {
  const migration = await readFile("drizzle/0026_simplify_profile_photo_privacy.sql", "utf8");
  assert.match(migration, /NOT IN \('everyone', 'hidden'\)/);
});

test("permanent catalog migration preserves carts, orders, stock, and historical snapshots", async () => {
  const migration = await readFile("drizzle/0027_permanent_product_catalog.sql", "utf8");

  assert.match(migration, /listings_product_classification_unique/);
  assert.match(migration, /canonical_marketplace_listings/);
  assert.match(migration, /inventory_product_classification_lot_idx/);
  assert.match(migration, /receiving_id VARCHAR\(36\)/);
  assert.match(migration, /received_at DATETIME/);
  assert.match(migration, /canonical_cart_items/);
  assert.match(migration, /movement\.reference_id = canonical\.keeper_id/);
  assert.match(migration, /SUM\(quantity_kg\)/);
  assert.match(migration, /classification\.name IN \('Good', 'Semi'\)/);
  assert.match(migration, /price_configured BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(migration, /ADD COLUMN product_name VARCHAR\(160\)/);
  assert.match(migration, /classification_name VARCHAR\(20\)/);
  assert.match(migration, /image_url MEDIUMTEXT/);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE TABLE/);
});

test("Reject marketplace migration prepares hidden offers without changing stock or history", async () => {
  const migration = await readFile("drizzle/0028_publishable_reject_offers.sql", "utf8");

  assert.match(migration, /classification\.name = 'Reject'/);
  assert.match(migration, /FALSE/);
  assert.match(migration, /'draft'/);
  assert.match(migration, /existing\.id IS NULL/);
  assert.doesNotMatch(migration, /UPDATE inventory|DELETE|DROP TABLE|TRUNCATE TABLE/);
});
