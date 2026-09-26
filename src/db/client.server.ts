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

// Local XAMPP typically does not use TLS, while managed MySQL providers do.
// Keep TLS opt-in so a local installation still works, but do not disable
// certificate verification for a hosted database.
function databaseRequiresSsl(url: string): boolean {
  if (process.env["DATABASE_SSL"] === "required") return true;
  try {
    return new URL(url).searchParams.get("ssl-mode")?.toLowerCase() === "required";
  } catch {
    return false;
  }
}

const pool =
  databaseRequiresSsl(databaseUrl)
    ? createPool({ uri: databaseUrl, ssl: { rejectUnauthorized: true } })
    : createPool(databaseUrl);

export const db = drizzle(pool, { schema, mode: "default" });
