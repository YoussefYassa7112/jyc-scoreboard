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
let messagesTableReady: Promise<void> | null = null;

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

/**
 * Creates camp_messages on first use, the same way cabin_id is added above.
 * The drizzle migration in this repo is already behind the schema, so a table
 * that only appears after a manual `db:push` would break the moment this ships.
 */
export function ensureMessagesTable() {
  if (!messagesTableReady) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      messagesTableReady = Promise.resolve();
      return messagesTableReady;
    }
    const sql = neon(url);
    messagesTableReady = sql`
      CREATE TABLE IF NOT EXISTS camp_messages (
        id serial PRIMARY KEY,
        body text NOT NULL,
        pinned integer NOT NULL DEFAULT 0,
        created_at timestamp with time zone NOT NULL DEFAULT now()
      )
    `
      .then(() => undefined)
      .catch((error) => {
        console.error("ensure camp_messages failed", error);
        messagesTableReady = null;
      });
  }
  return messagesTableReady ?? Promise.resolve();
}
