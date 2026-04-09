/** DDL applied on startup; PKs use AUTOINCREMENT for stable ids. */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS activity (
  ac_id INTEGER PRIMARY KEY AUTOINCREMENT,
  pl_notes TEXT NOT NULL DEFAULT '',
  ac_created_datetime TEXT NOT NULL,
  ac_updated_datetime TEXT NOT NULL,
  ac_calendar_day TEXT
);

CREATE TABLE IF NOT EXISTS tag (
  tg_id INTEGER PRIMARY KEY AUTOINCREMENT,
  vt_name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS activity_tag (
  ac_id INTEGER NOT NULL REFERENCES activity (ac_id) ON DELETE CASCADE,
  tg_id INTEGER NOT NULL REFERENCES tag (tg_id) ON DELETE CASCADE,
  PRIMARY KEY (ac_id, tg_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_created ON activity (ac_created_datetime);
CREATE INDEX IF NOT EXISTS idx_activity_calendar_day ON activity (ac_calendar_day);
CREATE INDEX IF NOT EXISTS idx_tag_name ON tag (vt_name);
`;
