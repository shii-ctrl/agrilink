import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const databaseUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Set DATABASE_URL before running migrations.");

const connection = await mysql.createConnection({
  uri: databaseUrl,
  multipleStatements: true,
  ...(process.env.DATABASE_SSL === "required" ? { ssl: { rejectUnauthorized: true } } : {}),
});
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

async function applyMigration(sql) {
  // MySQL DDL is not transactional. If a previous local migration was interrupted,
  // tables and indexes may exist even though the migration was never recorded.
  // Retry safely after omitting only the already-created index that caused the error.
  let executableSql = sql;
  while (true) {
    try {
      await connection.query(executableSql);
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
      await applyMigration(schemaOnlySql(file, sourceSql));
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
