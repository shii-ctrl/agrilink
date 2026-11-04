import { config } from "dotenv";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";

import * as schema from "@/db/schema";

// XAMPP does not inject environment variables into Vite automatically. This only
// runs on the local application server; .env.local is ignored by Git.
config({ path: ".env.local" });

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is missing. Configure it as a server-side environment variable before starting AgriLink.",
  );
}

// Local XAMPP typically does not use TLS, while managed MySQL providers do.
// Keep TLS opt-in so a local installation still works, but do not disable
// certificate verification for a hosted database.
function normalizeDatabaseUrl(url: string): { uri: string; requiresSsl: boolean } {
  const environmentRequiresSsl = process.env["DATABASE_SSL"] === "required";
  try {
    const parsedUrl = new URL(url);
    const urlRequiresSsl = parsedUrl.searchParams.get("ssl-mode")?.toLowerCase() === "required";
    // ssl-mode is a Layerbase URL hint, not a mysql2 connection option.
    parsedUrl.searchParams.delete("ssl-mode");
    return { uri: parsedUrl.toString(), requiresSsl: environmentRequiresSsl || urlRequiresSsl };
  } catch {
    return { uri: url, requiresSsl: environmentRequiresSsl };
  }
}

const connection = normalizeDatabaseUrl(databaseUrl);
const pool = createPool({
  uri: connection.uri,
  ...(connection.requiresSsl ? { ssl: { rejectUnauthorized: true } } : {}),
  // Serverless instances must not each reserve mysql2's default pool of ten
  // connections. One queued connection is sufficient for this transactional app
  // and prevents a few warm instances from exhausting the managed database.
  connectionLimit: 1,
  maxIdle: 1,
  idleTimeout: 10_000,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: false,
  // Layerbase free databases can take roughly 20 seconds to wake.
  connectTimeout: 60_000,
});

export const db = drizzle(pool, { schema, mode: "default" });
