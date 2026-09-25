import { config } from "dotenv";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";

import * as schema from "@/db/schema";

// XAMPP does not inject environment variables into Vite automatically. This only
// runs on the local application server; .env.local is ignored by Git.
config({ path: ".env.local" });

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing. Add it to .env.local before starting AgriLink.");
}

const pool = createPool(databaseUrl);

export const db = drizzle(pool, { schema, mode: "default" });
