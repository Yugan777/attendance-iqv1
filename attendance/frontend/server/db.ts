import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

const { Pool } = pg;

const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "SUPABASE_DB_URL or DATABASE_URL must be set.",
  );
}

// Strip sslmode from URL — we control SSL entirely via the ssl object below.
// Mixing ?sslmode=require in the URL with ssl:{rejectUnauthorized:false} can
// cause "self-signed certificate in certificate chain" errors on Vercel.
const cleanUrl = databaseUrl
  .replace(/[?&]sslmode=[^&]*/g, "")   // remove sslmode param
  .replace(/\?$/, "")                   // clean up trailing ?
  .replace(/&$/, "");                   // clean up trailing &

export const pool = new Pool({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false },
  max: 3, // keep pool small for serverless (Vercel spins up new instances)
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});
export const db = drizzle(pool, { schema });
