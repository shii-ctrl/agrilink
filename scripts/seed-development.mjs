import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { createPool } from "mysql2/promise";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

config({ path: ".env.local" });

const password = process.env.DEV_SEED_PASSWORD;
const databaseUrl = process.env.SEED_DATABASE_URL;
if (process.env.NODE_ENV !== "development") {
  throw new Error("Development seed requires NODE_ENV=development.");
}
if (process.env.ALLOW_DEVELOPMENT_SEED !== "YES") {
  throw new Error("Set ALLOW_DEVELOPMENT_SEED=YES to explicitly seed a development database.");
}
if (!databaseUrl || !password || password.length < 12) {
  throw new Error(
    "Set explicit SEED_DATABASE_URL and a 12+ character DEV_SEED_PASSWORD before seeding.",
  );
}
const target = new URL(databaseUrl);
const databaseName = target.pathname.slice(1);
const isLoopback = ["127.0.0.1", "localhost", "::1"].includes(target.hostname);
if (!isLoopback || !/(?:^|[_-])(local|dev|test)(?:[_-]|$)/i.test(databaseName)) {
  throw new Error(
    "Development seed only accepts a loopback SEED_DATABASE_URL whose database name contains local, dev, or test.",
  );
}

const usernames = [
  "management.demo",
  "marketer.demo",
  "accounting.demo",
  "buyer.demo",
  "farmer.demo",
  "consultant.demo",
];
const pool = createPool({ uri: databaseUrl, multipleStatements: true });
try {
  const operationalMigration = await readFile(
    join(process.cwd(), "drizzle", "0001_operational_tables_and_demo_seed.sql"),
    "utf8",
  );
  const productionMigration = await readFile(
    join(process.cwd(), "drizzle", "0002_production_records.sql"),
    "utf8",
  );
  const operationalSeedStart = operationalMigration.indexOf("-- Roles and accounts.");
  const productionSeedStart = productionMigration.indexOf("INSERT IGNORE INTO production_records");
  if (operationalSeedStart < 0 || productionSeedStart < 0) {
    throw new Error("The legacy demo seed data could not be located.");
  }

  const [[migrationTable]] = await pool.query(
    "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '_agrilink_migrations'",
  );
  if (migrationTable.total !== 1) {
    throw new Error("Run npm run db:migrate before using the development seed command.");
  }

  await pool.query(operationalMigration.slice(operationalSeedStart));
  await pool.query(productionMigration.slice(productionSeedStart));
  await pool.query("UPDATE users SET password_hash = ? WHERE username IN (?)", [
    await bcrypt.hash(password, 12),
    usernames,
  ]);
  await pool.query("UPDATE roles SET name = 'Farm Consultant' WHERE name = 'Consultant'");
  console.log(`Seeded ${usernames.length} development accounts and demonstration records.`);
} finally {
  await pool.end();
}
