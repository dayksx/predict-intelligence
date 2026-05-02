import initSqlJs, { type Database } from "sql.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";

const DB_FILE = process.env.DB_FILE ?? resolve("data/store.db");

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS market_registry (
    market_id          TEXT PRIMARY KEY,
    title              TEXT NOT NULL,
    clob_yes_token_id  TEXT,
    clob_no_token_id   TEXT,
    neg_risk           INTEGER DEFAULT 0,
    resolution_date    TEXT,
    domain             TEXT,
    updated_at         TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profiles (
    ens_name    TEXT PRIMARY KEY,
    status      TEXT NOT NULL DEFAULT 'registered',
    data_json   TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ens_name    TEXT NOT NULL,
    run_id      TEXT,
    event       TEXT NOT NULL,
    data_json   TEXT,
    timestamp   TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_ens_event ON audit_log(ens_name, event);

  CREATE TABLE IF NOT EXISTS positions (
    position_id  TEXT PRIMARY KEY,
    ens_name     TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'open',
    data_json    TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_positions_ens_status ON positions(ens_name, status);
`;

let _db: Database | null = null;

/** Loads (or creates) the SQLite database. Call once at startup. */
export async function openDb(): Promise<Database> {
  if (_db) return _db;

  const SQL = await initSqlJs();
  mkdirSync(dirname(DB_FILE), { recursive: true });

  if (existsSync(DB_FILE)) {
    const data = readFileSync(DB_FILE);
    _db = new SQL.Database(data);
  } else {
    _db = new SQL.Database();
  }

  _db.run(SCHEMA);

  // Migration: add agent_id column if it doesn't exist yet (safe to run multiple times)
  try {
    _db.run("ALTER TABLE profiles ADD COLUMN agent_id TEXT");
  } catch {
    // Column already exists — ignore
  }

  persist(_db);

  return _db;
}

/** Returns the already-opened database (throws if openDb was not awaited first). */
export function getDb(): Database {
  if (!_db) throw new Error("Database not initialised — await openDb() first");
  return _db;
}

/** Writes the in-memory database back to disk. */
export function persist(db: Database): void {
  const data = db.export();
  writeFileSync(DB_FILE, Buffer.from(data));
}
