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

test("daily cash closing migration safely resumes after verified tables already exist", async () => {
  const runner = await readFile("scripts/migrate.mjs", "utf8");

  assert.match(runner, /prepareDailyCashClosingMigration/);
  assert.match(runner, /information_schema\.COLUMNS/);
  assert.match(runner, /information_schema\.STATISTICS/);
  assert.match(runner, /Existing \$\{table\.name\} table does not match migration 0041/);
  assert.match(runner, /Keeping existing verified table \$\{table\.name\}/);
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

test("quality-image migration preserves the catalog photo as every offer fallback", async () => {
  const migration = await readFile("drizzle/0029_listing_quality_images.sql", "utf8");

  assert.match(migration, /ADD COLUMN image_url MEDIUMTEXT NULL/);
  assert.match(migration, /SET listing\.image_url = product\.image_url/);
  assert.doesNotMatch(migration, /DELETE|DROP TABLE|TRUNCATE TABLE/);
});

test("selling-unit migration defaults Egg and Itlog products to trays and preserves order history", async () => {
  const migration = await readFile("drizzle/0030_product_selling_units.sql", "utf8");

  assert.match(migration, /ADD COLUMN IF NOT EXISTS selling_unit ENUM\('kg', 'tray'\)/);
  assert.match(migration, /\(egg\|itlog\)/);
  assert.match(migration, /ALTER TABLE order_items/);
  assert.match(migration, /SET item\.selling_unit = product\.selling_unit/);
  assert.doesNotMatch(migration, /DELETE|DROP TABLE|TRUNCATE TABLE/);
});

test("expanded selling units preserve existing product and order selections", async () => {
  const migration = await readFile("drizzle/0031_expand_product_selling_units.sql", "utf8");

  assert.match(migration, /ENUM\('kg', 'piece', 'bundle', 'pack', 'tray', 'sack'\)/);
  assert.match(migration, /ALTER TABLE products/);
  assert.match(migration, /ALTER TABLE order_items/);
  assert.doesNotMatch(migration, /DELETE|DROP TABLE|TRUNCATE TABLE/);
});

test("Community post categories preserve existing posts as general discussions", async () => {
  const migration = await readFile("drizzle/0032_community_post_categories.sql", "utf8");

  assert.match(migration, /ALTER TABLE community_messages/);
  assert.match(migration, /ADD COLUMN category ENUM/);
  assert.match(migration, /DEFAULT 'general_discussion'/);
  assert.match(migration, /community_messages_category_created_idx/);
  assert.doesNotMatch(migration, /DELETE|DROP TABLE|TRUNCATE TABLE/);
});

test("pinned Community announcements preserve all existing post history", async () => {
  const migration = await readFile("drizzle/0033_pinned_community_announcements.sql", "utf8");

  assert.match(migration, /ALTER TABLE community_messages/);
  assert.match(migration, /ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(migration, /ADD COLUMN pinned_at DATETIME NULL/);
  assert.match(migration, /ADD COLUMN pinned_by_id VARCHAR\(36\) NULL/);
  assert.match(migration, /community_messages_pinned_created_idx/);
  assert.doesNotMatch(migration, /DELETE|DROP TABLE|TRUNCATE TABLE/);
});

test("Community engagement migration preserves posts while adding media and moderation records", async () => {
  const migration = await readFile("drizzle/0034_community_engagement_and_moderation.sql", "utf8");

  assert.match(migration, /ADD COLUMN question_status ENUM\('open', 'answered', 'resolved'\)/);
  assert.match(migration, /CREATE TABLE community_attachments/);
  assert.match(migration, /image_url MEDIUMTEXT NOT NULL/);
  assert.match(migration, /CREATE TABLE community_bookmarks/);
  assert.match(migration, /CREATE TABLE community_reports/);
  assert.match(migration, /community_reports_message_reporter_unique/);
  assert.doesNotMatch(migration, /DELETE|DROP TABLE|TRUNCATE TABLE/);
});

test("Farmer settlement migration starts with new sales and preserves existing orders", async () => {
  const migration = await readFile("drizzle/0039_farmer_earnings_and_ipon.sql", "utf8");

  assert.match(migration, /farmer_settlement_eligible BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(migration, /ALTER COLUMN farmer_settlement_eligible SET DEFAULT TRUE/);
  assert.match(migration, /CREATE TABLE farmer_earnings/);
  assert.match(migration, /CREATE TABLE farmer_payouts/);
  assert.match(migration, /CREATE TABLE farmer_ipon_releases/);
  assert.match(migration, /method ENUM\('cash'\)/);
  assert.doesNotMatch(migration, /UPDATE orders SET farmer_settlement_eligible = TRUE/);
  assert.doesNotMatch(migration, /DELETE|DROP TABLE|TRUNCATE TABLE/);
});
