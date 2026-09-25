import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const demo = {
  users: ["001", "002", "003", "004", "005", "006"].map(
    (number) => `00000000-0000-4000-8000-000000000${number}`,
  ),
  products: ["001", "002", "003", "004"].map(
    (number) => `10000000-0000-4000-8000-000000000${number}`,
  ),
  receiving: ["001", "002"].map((number) => `20000000-0000-4000-8000-000000000${number}`),
  receivingClassifications: ["001", "002", "003", "004", "005", "006"].map(
    (number) => `21000000-0000-4000-8000-000000000${number}`,
  ),
  production: ["001", "002"].map((number) => `20500000-0000-4000-8000-000000000${number}`),
  inventory: ["001", "002", "003", "004", "005", "006", "007", "008"].map(
    (number) => `30000000-0000-4000-8000-000000000${number}`,
  ),
  listings: ["001", "002", "003", "004", "005", "006", "007"].map(
    (number) => `40000000-0000-4000-8000-000000000${number}`,
  ),
  orders: ["001", "002"].map((number) => `50000000-0000-4000-8000-000000000${number}`),
  orderItems: ["001", "002"].map((number) => `51000000-0000-4000-8000-000000000${number}`),
  orderHistory: ["001", "002", "003", "004"].map(
    (number) => `52000000-0000-4000-8000-000000000${number}`,
  ),
  payments: ["60000000-0000-4000-8000-000000000001"],
  movements: ["001", "002", "003"].map((number) => `61000000-0000-4000-8000-000000000${number}`),
  dailyPrices: Array.from(
    { length: 15 },
    (_, index) => `70000000-0000-4000-8000-000000000${String(index + 1).padStart(3, "0")}`,
  ),
  community: ["001", "002", "003"].map((number) => `80000000-0000-4000-8000-000000000${number}`),
  guidance: ["81000000-0000-4000-8000-000000000001"],
  notifications: ["001", "002", "003"].map(
    (number) => `82000000-0000-4000-8000-000000000${number}`,
  ),
  audit: ["001", "002"].map((number) => `83000000-0000-4000-8000-000000000${number}`),
};

const databaseUrl = process.env.LEGACY_DEMO_CLEANUP_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Set LEGACY_DEMO_CLEANUP_DATABASE_URL to run a read-only cleanup report.");
}
const target = new URL(databaseUrl);
const targetName = target.pathname.slice(1);
if (!targetName || process.env.LEGACY_DEMO_CLEANUP_TARGET !== targetName) {
  throw new Error("Set LEGACY_DEMO_CLEANUP_TARGET to the exact target database name.");
}

const connection = await mysql.createConnection(databaseUrl);
const countByIds = async (table, column, ids) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS total FROM \`${table}\` WHERE \`${column}\` IN (?)`,
    [ids],
  );
  return Number(row.total);
};

const expectedRows = [
  ["audit_logs", "id", demo.audit],
  ["notifications", "id", demo.notifications],
  ["guidance_messages", "id", demo.guidance],
  ["community_messages", "id", demo.community],
  ["daily_prices", "id", demo.dailyPrices],
  ["inventory_movements", "id", demo.movements],
  ["order_status_history", "id", demo.orderHistory],
  ["payments", "id", demo.payments],
  ["order_items", "id", demo.orderItems],
  ["orders", "id", demo.orders],
  ["marketplace_listings", "id", demo.listings],
  ["inventory", "id", demo.inventory],
  ["receiving_classifications", "id", demo.receivingClassifications],
  ["receiving_records", "id", demo.receiving],
  ["production_records", "id", demo.production],
  ["user_roles", "user_id", demo.users],
  ["users", "id", demo.users],
  ["products", "id", demo.products],
];

const dependencyChecks = [
  ["orders by demo buyer", "orders", "buyer_id", demo.users, demo.orders],
  ["payments recorded by demo user", "payments", "recorded_by_id", demo.users, demo.payments],
  [
    "daily prices created by demo user",
    "daily_prices",
    "created_by_id",
    demo.users,
    demo.dailyPrices,
  ],
  ["notifications for demo user", "notifications", "user_id", demo.users, demo.notifications],
  [
    "community messages by demo user",
    "community_messages",
    "author_id",
    demo.users,
    demo.community,
  ],
  ["audit records by demo user", "audit_logs", "actor_id", demo.users, demo.audit],
  [
    "receiving records referencing demo user",
    "receiving_records",
    "farmer_id",
    demo.users,
    demo.receiving,
  ],
  [
    "receiving records recorded by demo user",
    "receiving_records",
    "recorded_by_id",
    demo.users,
    demo.receiving,
  ],
  [
    "production records referencing demo user",
    "production_records",
    "farmer_id",
    demo.users,
    demo.production,
  ],
  [
    "production records recorded by demo user",
    "production_records",
    "recorded_by_id",
    demo.users,
    demo.production,
  ],
  [
    "order status changes by demo user",
    "order_status_history",
    "changed_by_id",
    demo.users,
    demo.orderHistory,
  ],
  [
    "stock movements by demo user",
    "inventory_movements",
    "recorded_by_id",
    demo.users,
    demo.movements,
  ],
  [
    "stock movements modifying demo stock",
    "inventory_movements",
    "inventory_id",
    demo.inventory,
    demo.movements,
  ],
  [
    "listings using demo stock",
    "marketplace_listings",
    "inventory_id",
    demo.inventory,
    demo.listings,
  ],
  ["order items using demo listing", "order_items", "listing_id", demo.listings, demo.orderItems],
  ["daily prices for demo listing", "daily_prices", "listing_id", demo.listings, demo.dailyPrices],
];

try {
  const expected = await Promise.all(
    expectedRows.map(async ([table, column, ids]) => ({
      table,
      total: await countByIds(table, column, ids),
    })),
  );
  const dependencies = [];
  for (const [label, table, column, references, knownIds] of dependencyChecks) {
    const [[row]] = await connection.query(
      `SELECT COUNT(*) AS total FROM \`${table}\` WHERE \`${column}\` IN (?) AND id NOT IN (?)`,
      [references, knownIds],
    );
    if (Number(row.total) > 0) dependencies.push({ label, total: Number(row.total) });
  }
  const [[roleAssignments]] = await connection.query(
    "SELECT COUNT(*) AS total FROM user_roles WHERE user_id IN (?)",
    [demo.users],
  );
  if (Number(roleAssignments.total) !== 6) {
    dependencies.push({
      label: "unexpected role assignments for demo accounts",
      total: Number(roleAssignments.total),
    });
  }
  const [[guidanceDependencies]] = await connection.query(
    "SELECT COUNT(*) AS total FROM guidance_messages WHERE id NOT IN (?) AND (farmer_id IN (?) OR consultant_id IN (?) OR author_id IN (?))",
    [demo.guidance, demo.users, demo.users, demo.users],
  );
  if (Number(guidanceDependencies.total) > 0) {
    dependencies.push({
      label: "guidance referencing demo users",
      total: Number(guidanceDependencies.total),
    });
  }

  console.table(expected);
  console.log(`Cleanup target: ${targetName}`);
  if (dependencies.length) {
    console.table(dependencies);
    throw new Error(
      "Refusing cleanup: real records reference or modify legacy demo accounts or stock.",
    );
  }
  console.log("No real dependencies were found. This was a dry-run; no records were changed.");

  if (process.env.LEGACY_DEMO_CLEANUP_EXECUTE !== "YES") process.exit(0);
  const backupReference = process.env.LEGACY_DEMO_BACKUP_REFERENCE;
  if (process.env.LEGACY_DEMO_CLEANUP_APPROVED !== "YES" || !backupReference) {
    throw new Error(
      "Deletion requires LEGACY_DEMO_CLEANUP_APPROVED=YES and a verified LEGACY_DEMO_BACKUP_REFERENCE.",
    );
  }

  await connection.beginTransaction();
  try {
    for (const [table, column, ids] of expectedRows) {
      await connection.query(`DELETE FROM \`${table}\` WHERE \`${column}\` IN (?)`, [ids]);
    }
    await connection.commit();
    console.log(`Deleted only documented legacy demo rows. Backup reference: ${backupReference}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  }
} finally {
  await connection.end();
}
