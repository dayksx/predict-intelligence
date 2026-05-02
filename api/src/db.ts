import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";

const DB_FILE = process.env.DB_FILE ?? resolve("data/store.db");

// Ensure data directory exists before opening the database
mkdirSync(dirname(DB_FILE), { recursive: true });

const db = new Database(DB_FILE);

// WAL mode for concurrent reads alongside writes
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
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
`);

export default db;
