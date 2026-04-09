import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config";
import { dayKeyLocal } from "../lib/dates";
import { SCHEMA_SQL } from "./schema";

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function tableHasColumn(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

/** Add ac_calendar_day for DBs created before that column existed; backfill from created time. */
function migrateActivityCalendarDay(db: Database.Database): void {
  if (!tableHasColumn(db, "activity", "ac_calendar_day")) {
    db.exec(`ALTER TABLE activity ADD COLUMN ac_calendar_day TEXT`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_calendar_day ON activity (ac_calendar_day)`);
  }
  const missing = db
    .prepare(`SELECT ac_id, ac_created_datetime FROM activity WHERE ac_calendar_day IS NULL`)
    .all() as { ac_id: number; ac_created_datetime: string }[];
  const upd = db.prepare<[string, number], unknown>(`UPDATE activity SET ac_calendar_day = ? WHERE ac_id = ?`);
  for (const row of missing) {
    const key = dayKeyLocal(new Date(row.ac_created_datetime));
    upd.run(key, row.ac_id);
  }
}

export function openDatabase(): Database.Database {
  ensureParentDir(config.dbPath);
  const db = new Database(config.dbPath);
  db.pragma("foreign_keys = ON");
  if (config.sqliteWal) {
    db.pragma("journal_mode = WAL");
  }
  db.exec(SCHEMA_SQL);
  migrateActivityCalendarDay(db);
  return db;
}

export type { Database };
