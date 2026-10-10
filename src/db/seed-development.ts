import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";

config({ path: ".env.local" });

if (process.env["NODE_ENV"] === "production") {
  throw new Error("Development data must never be seeded in production.");
}

const password = process.env["DEV_SEED_PASSWORD"];
if (!password || password.length < 8) {
  throw new Error(
    "Set a development-only DEV_SEED_PASSWORD of at least 8 characters in .env.local.",
  );
}

const { db } = await import("@/db/client.server");
const { roles, users } = await import("@/db/schema");

const demoUsernames = [
  "management.demo",
  "marketer.demo",
  "accounting.demo",
  "buyer.demo",
  "farmer.demo",
  "consultant.demo",
];

const passwordHash = await bcrypt.hash(password, 12);
const existing = await db
  .select({ id: users.id })
  .from(users)
  .where(inArray(users.username, demoUsernames));
if (existing.length !== demoUsernames.length) {
  throw new Error(
    "Expected local development accounts were not found. Run the initial schema seed first.",
  );
}

await db.update(users).set({ passwordHash }).where(inArray(users.username, demoUsernames));
await db.update(roles).set({ name: "Farm Consultant" }).where(eq(roles.name, "Consultant"));
console.log(`Updated ${existing.length} local development account passwords.`);
