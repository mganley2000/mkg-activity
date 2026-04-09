import type Database from "better-sqlite3";
import type { TagRow } from "../types";

export function createTagService(db: Database.Database) {
  const searchStmt = db.prepare<[string], TagRow>(
    `SELECT tg_id, vt_name FROM tag WHERE vt_name LIKE ? ESCAPE '\\' ORDER BY vt_name LIMIT 50`
  );

  const insertStmt = db.prepare<[string], unknown>(`INSERT INTO tag (vt_name) VALUES (?)`);

  const getByIdStmt = db.prepare<[number], TagRow>(`SELECT tg_id, vt_name FROM tag WHERE tg_id = ?`);

  const getByNameStmt = db.prepare<[string], TagRow>(
    `SELECT tg_id, vt_name FROM tag WHERE vt_name = ? COLLATE NOCASE`
  );

  function escapeLike(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  }

  return {
    searchByPrefix(q: string): TagRow[] {
      const trimmed = q.trim();
      if (!trimmed) return [];
      const pattern = `${escapeLike(trimmed)}%`;
      return searchStmt.all(pattern);
    },

    getById(id: number): TagRow | undefined {
      return getByIdStmt.get(id);
    },

    /** Create tag if name is new; return row (existing or new). */
    createOrGet(vt_name: string): TagRow {
      const name = vt_name.trim();
      if (!name) {
        throw new Error("Tag name is required");
      }
      const existing = getByNameStmt.get(name);
      if (existing) return existing;
      const info = insertStmt.run(name) as import("better-sqlite3").RunResult;
      return { tg_id: Number(info.lastInsertRowid), vt_name: name };
    },
  };
}

export type TagService = ReturnType<typeof createTagService>;
