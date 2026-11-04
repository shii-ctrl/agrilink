import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const databaseUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Set DATABASE_URL before running migrations.");

const parsedDatabaseUrl = new URL(databaseUrl);
const databaseRequiresSsl =
  process.env.DATABASE_SSL === "required" ||
  parsedDatabaseUrl.searchParams.get("ssl-mode")?.toLowerCase() === "required";
// ssl-mode is a Layerbase URL hint, not a mysql2 connection option.
parsedDatabaseUrl.searchParams.delete("ssl-mode");

async function connectWithRetry() {
  const maximumAttempts = 6;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      return await mysql.createConnection({
        uri: parsedDatabaseUrl.toString(),
        multipleStatements: true,
        // A free Layerbase database may need time to wake from hibernation.
        connectTimeout: 60_000,
        ...(databaseRequiresSsl ? { ssl: { rejectUnauthorized: true } } : {}),
      });
    } catch (error) {
      if (error?.code !== "ER_CON_COUNT_ERROR" || attempt === maximumAttempts) throw error;
      const retryDelayMs = attempt * 5_000;
      console.warn(
        `Database connection limit reached. Retrying migration in ${retryDelayMs / 1_000}s (${attempt}/${maximumAttempts}).`,
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  throw new Error("Could not establish a database connection for migrations.");
}

const connection = await connectWithRetry();
const legacySchemaOnlyMigrations = new Set([
  "0001_operational_tables_and_demo_seed.sql",
  "0002_production_records.sql",
]);

function schemaOnlySql(file, sql) {
  // 0001 and 0002 were released with demo records. Their source and checksums
  // must remain unchanged for databases that already applied them. On a fresh
  // database we apply only their DDL, then 0004 adds the required reference data.
  if (file === "0001_operational_tables_and_demo_seed.sql") {
    const seedStart = sql.indexOf("-- Roles and accounts.");
    if (seedStart < 0) throw new Error(`Could not locate the legacy seed section in ${file}.`);
    return sql.slice(0, seedStart);
  }
  if (file === "0002_production_records.sql") {
    const seedStart = sql.indexOf("INSERT IGNORE INTO production_records");
    if (seedStart < 0) throw new Error(`Could not locate the legacy seed section in ${file}.`);
    return sql.slice(0, seedStart);
  }
  return sql;
}

async function ensureInventoryFarmerForeignKey() {
  // MariaDB accepts IF NOT EXISTS for several ALTER TABLE operations, but not
  // for ADD CONSTRAINT. Check metadata instead, so a partially applied 0006
  // migration can be resumed safely without changing its published checksum.
  const [existing] = await connection.execute(
    `SELECT CONSTRAINT_NAME
       FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'inventory'
        AND CONSTRAINT_NAME = 'fk_inventory_farmer'`,
  );
  if (existing.length) return;
  await connection.execute(
    "ALTER TABLE inventory ADD CONSTRAINT fk_inventory_farmer FOREIGN KEY (farmer_id) REFERENCES users(id)",
  );
}

async function prepareCatalogNameIntegrityMigration(sql) {
  const productNameIndex = /ALTER TABLE products ADD UNIQUE KEY products_name_unique \(name\);\s*/i;
  if (!productNameIndex.test(sql)) {
    throw new Error(
      "Could not locate the products name index in 0007_catalog_and_guidance_integrity.sql.",
    );
  }
  const [existingIndex] = await connection.execute(
    `SELECT INDEX_NAME
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'products'
        AND INDEX_NAME = 'products_name_unique'`,
  );
  if (existingIndex.length) return sql.replace(productNameIndex, "");

  // Keep all historical products and their connected stock/orders. The original
  // migration requires a unique catalog name, so retain the earliest record and
  // add a stable legacy suffix to every later duplicate before adding the index.
  const [duplicateNames] = await connection.execute(
    `SELECT name
       FROM products
      GROUP BY name
     HAVING COUNT(*) > 1`,
  );
  let renamedCount = 0;
  for (const duplicate of duplicateNames) {
    const [products] = await connection.execute(
      "SELECT id, name FROM products WHERE name = ? ORDER BY created_at ASC, id ASC",
      [duplicate.name],
    );
    for (const product of products.slice(1)) {
      const suffix = ` [legacy ${product.id}]`;
      const uniqueName = `${product.name.slice(0, 160 - suffix.length)}${suffix}`;
      await connection.execute("UPDATE products SET name = ? WHERE id = ?", [
        uniqueName,
        product.id,
      ]);
      renamedCount += 1;
    }
  }
  if (renamedCount) {
    console.log(`Renamed ${renamedCount} duplicate legacy catalog product name(s) before 0007.`);
  }
  return sql;
}

async function prepareDailyCashClosingMigration(sql) {
  const tables = [
    {
      name: "daily_cash_closings",
      columns: [
        "id",
        "business_date",
        "opening_cash",
        "gross_sales",
        "pickup_collections",
        "cod_collections",
        "pending_cod",
        "delivery_fees",
        "refunds",
        "farmer_payable",
        "farmer_payouts",
        "service_fee_income",
        "ipon_contributions",
        "ipon_releases",
        "expected_cash",
        "actual_cash",
        "variance",
        "notes",
        "closed_by_id",
        "closed_at",
        "created_at",
      ],
      indexes: ["PRIMARY", "daily_cash_closings_date_unique", "daily_cash_closings_closed_idx"],
    },
    {
      name: "daily_cash_adjustments",
      columns: ["id", "closing_id", "amount", "reason", "recorded_by_id", "created_at"],
      indexes: ["PRIMARY", "daily_cash_adjustments_closing_idx"],
    },
  ];

  let executableSql = sql;
  for (const table of tables) {
    const [existingColumns] = await connection.execute(
      `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?`,
      [table.name],
    );
    if (!existingColumns.length) continue;

    const presentColumns = new Set(existingColumns.map((column) => column.COLUMN_NAME));
    const missingColumns = table.columns.filter((column) => !presentColumns.has(column));
    const [existingIndexes] = await connection.execute(
      `SELECT DISTINCT INDEX_NAME
         FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?`,
      [table.name],
    );
    const presentIndexes = new Set(existingIndexes.map((index) => index.INDEX_NAME));
    const missingIndexes = table.indexes.filter((index) => !presentIndexes.has(index));
    if (missingColumns.length || missingIndexes.length) {
      throw new Error(
        `Existing ${table.name} table does not match migration 0041. Missing columns: ${missingColumns.join(", ") || "none"}; missing indexes: ${missingIndexes.join(", ") || "none"}.`,
      );
    }

    const escapedName = table.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const createTableStatement = new RegExp(
      "CREATE TABLE `" + escapedName + "` \\([\\s\\S]*?\\);\\s*(?:--> statement-breakpoint\\s*)?",
      "i",
    );
    if (!createTableStatement.test(executableSql)) {
      throw new Error(`Could not locate the ${table.name} statement in migration 0041.`);
    }
    executableSql = executableSql.replace(createTableStatement, "");
    console.log(`Keeping existing verified table ${table.name} from migration 0041.`);
  }
  return executableSql;
}

async function applyMigration(file, sql) {
  const inventoryFarmerConstraint =
    /ALTER TABLE inventory ADD CONSTRAINT IF NOT EXISTS fk_inventory_farmer FOREIGN KEY \(farmer_id\) REFERENCES users\(id\);\s*/i;
  const needsInventoryFarmerConstraint = file === "0006_inventory_farmer_traceability.sql";
  if (needsInventoryFarmerConstraint && !inventoryFarmerConstraint.test(sql)) {
    throw new Error(`Could not locate the inventory Farmer foreign key in ${file}.`);
  }
  // MySQL DDL is not transactional. If a previous local migration was interrupted,
  // tables and indexes may exist even though the migration was never recorded.
  // Retry safely after omitting only the already-created index that caused the error.
  let executableSql = needsInventoryFarmerConstraint
    ? sql.replace(inventoryFarmerConstraint, "")
    : sql;
  if (file === "0007_catalog_and_guidance_integrity.sql") {
    executableSql = await prepareCatalogNameIntegrityMigration(executableSql);
  }
  if (file === "0041_daily_cash_closing.sql") {
    executableSql = await prepareDailyCashClosingMigration(executableSql);
  }
  while (true) {
    try {
      if (executableSql.trim()) await connection.query(executableSql);
      if (needsInventoryFarmerConstraint) await ensureInventoryFarmerForeignKey();
      return;
    } catch (error) {
      if (error?.code !== "ER_DUP_KEYNAME" || typeof error?.sqlMessage !== "string") throw error;

      const indexName = error.sqlMessage.match(/Duplicate key name '([^']+)'/)?.[1];
      if (!indexName) throw error;

      const escapedName = indexName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const indexStatement = new RegExp(
        `CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+\\\`${escapedName}\\\`|CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+${escapedName}`,
        "i",
      );
      const statementStart = executableSql.search(indexStatement);
      const statementEnd = statementStart < 0 ? -1 : executableSql.indexOf(";", statementStart);
      if (statementStart < 0 || statementEnd < 0) throw error;

      executableSql = `${executableSql.slice(0, statementStart)}${executableSql.slice(statementEnd + 1)}`;
      console.log(`Keeping existing index ${indexName} from an interrupted migration.`);
    }
  }
}

try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS _agrilink_migrations (
      id VARCHAR(100) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS _agrilink_migration_modes (
      migration_id VARCHAR(100) PRIMARY KEY,
      application_mode VARCHAR(32) NOT NULL,
      recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_migration_mode_migration
        FOREIGN KEY (migration_id) REFERENCES _agrilink_migrations(id)
    )
  `);
  await connection.execute(
    "ALTER TABLE _agrilink_migration_modes MODIFY application_mode VARCHAR(32) NOT NULL",
  );
  const migrationDir = join(process.cwd(), "drizzle");
  const files = (await readdir(migrationDir)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
  for (const file of files) {
    const sourceSql = await readFile(join(migrationDir, file), "utf8");
    const checksum = createHash("sha256").update(sourceSql).digest("hex");
    const [applied] = await connection.execute(
      "SELECT checksum FROM _agrilink_migrations WHERE id = ?",
      [file],
    );
    if (applied.length) {
      if (applied[0].checksum !== checksum) {
        throw new Error(
          `Migration ${file} was changed after it was applied. Create a new migration instead.`,
        );
      }
      if (legacySchemaOnlyMigrations.has(file)) {
        await connection.execute(
          "INSERT IGNORE INTO _agrilink_migration_modes (migration_id, application_mode) VALUES (?, 'unknown')",
          [file],
        );
      } else {
        await connection.execute(
          "INSERT IGNORE INTO _agrilink_migration_modes (migration_id, application_mode) VALUES (?, 'standard')",
          [file],
        );
      }
      continue;
    }
    await connection.beginTransaction();
    try {
      await applyMigration(file, schemaOnlySql(file, sourceSql));
      await connection.execute("INSERT INTO _agrilink_migrations (id, checksum) VALUES (?, ?)", [
        file,
        checksum,
      ]);
      await connection.execute(
        "INSERT INTO _agrilink_migration_modes (migration_id, application_mode) VALUES (?, ?)",
        [file, legacySchemaOnlyMigrations.has(file) ? "schema_only" : "standard"],
      );
      await connection.commit();
      console.log(`Applied ${file}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
} finally {
  await connection.end();
}
