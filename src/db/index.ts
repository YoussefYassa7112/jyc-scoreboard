import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

let _db: ReturnType<typeof createDb> | null = null;
let cabinColumnReady: Promise<void> | null = null;

export function getDb() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

/** Adds cabin_id on first use so existing Neon DBs pick it up without a manual migrate. */
export function ensureCabinColumn() {
  if (!cabinColumnReady) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      cabinColumnReady = Promise.resolve();
      return cabinColumnReady;
    }
    const sql = neon(url);
    cabinColumnReady = sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS cabin_id integer`
      .then(() => undefined)
      .catch((error) => {
        console.error("ensure cabin_id failed", error);
        cabinColumnReady = null;
      });
  }
  return cabinColumnReady ?? Promise.resolve();
}
