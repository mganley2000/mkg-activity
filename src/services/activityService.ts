import type Database from "better-sqlite3";
import type { ActivityDetail, ActivityRow, ActivitySummary, DayBucket, TagRow } from "../types";
import { addLocalDays, dayKeyLocal, recentDayKeys } from "../lib/dates";
import type { TagService } from "./tagService";

function notesPreview(pl_notes: string, max = 120): string {
  const oneLine = pl_notes.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

export function createActivityService(db: Database.Database, tags: TagService) {
  const listByCalendarDayRange = db.prepare<[string, string], ActivityRow>(
    `SELECT ac_id, pl_notes, ac_created_datetime, ac_updated_datetime, ac_calendar_day
     FROM activity
     WHERE ac_calendar_day >= ? AND ac_calendar_day <= ?
     ORDER BY ac_updated_datetime DESC`
  );

  const getRow = db.prepare<[number], ActivityRow>(
    `SELECT ac_id, pl_notes, ac_created_datetime, ac_updated_datetime, ac_calendar_day FROM activity WHERE ac_id = ?`
  );

  const insert = db.prepare<[string, string, string, string], unknown>(
    `INSERT INTO activity (pl_notes, ac_created_datetime, ac_updated_datetime, ac_calendar_day) VALUES (?, ?, ?, ?)`
  );

  const update = db.prepare<[string, string, number], unknown>(
    `UPDATE activity SET pl_notes = ?, ac_updated_datetime = ? WHERE ac_id = ?`
  );

  const tagsForActivity = db.prepare<[number], TagRow>(
    `SELECT t.tg_id, t.vt_name
     FROM tag t
     INNER JOIN activity_tag at ON at.tg_id = t.tg_id
     WHERE at.ac_id = ?
     ORDER BY t.vt_name`
  );

  const linkTagStmt = db.prepare<[number, number], unknown>(
    `INSERT OR IGNORE INTO activity_tag (ac_id, tg_id) VALUES (?, ?)`
  );

  const unlinkTagStmt = db.prepare<[number, number], unknown>(
    `DELETE FROM activity_tag WHERE ac_id = ? AND tg_id = ?`
  );

  function getDetail(ac_id: number): ActivityDetail | undefined {
    const row = getRow.get(ac_id);
    if (!row) return undefined;
    const tagRows = tagsForActivity.all(ac_id);
    return { ...row, tags: tagRows };
  }

  return {
    getCalendarDays(days: number): DayBucket[] {
      const now = new Date();
      const dayKeys = recentDayKeys(now, days);
      const sortedKeys = [...dayKeys].sort();
      const minKey = sortedKeys[0]!;
      const maxKey = sortedKeys[sortedKeys.length - 1]!;
      const rows = listByCalendarDayRange.all(minKey, maxKey);

      const byDay = new Map<string, ActivitySummary[]>();
      for (const k of dayKeys) byDay.set(k, []);

      for (const row of rows) {
        const key = row.ac_calendar_day ?? dayKeyLocal(new Date(row.ac_created_datetime));
        const list = byDay.get(key);
        if (!list) continue;
        list.push({
          id: row.ac_id,
          notesPreview: notesPreview(row.pl_notes),
          createdAt: row.ac_created_datetime,
          updatedAt: row.ac_updated_datetime,
          tags: tagsForActivity.all(row.ac_id),
        });
      }

      return dayKeys.map((date) => ({
        date,
        activities: byDay.get(date) ?? [],
      }));
    },

    getCalendarRange(fromKey: string, toKey: string): DayBucket[] {
      const keys: string[] = [];
      let k = fromKey;
      while (true) {
        keys.push(k);
        if (k === toKey) break;
        k = addLocalDays(k, 1);
        if (keys.length > 400) break;
      }
      const sortedKeys = [...keys].sort();
      const minKey = sortedKeys[0]!;
      const maxKey = sortedKeys[sortedKeys.length - 1]!;
      const rows = listByCalendarDayRange.all(minKey, maxKey);
      const byDay = new Map<string, ActivitySummary[]>();
      for (const key of keys) byDay.set(key, []);
      for (const row of rows) {
        const key = row.ac_calendar_day ?? dayKeyLocal(new Date(row.ac_created_datetime));
        const list = byDay.get(key);
        if (!list) continue;
        list.push({
          id: row.ac_id,
          notesPreview: notesPreview(row.pl_notes),
          createdAt: row.ac_created_datetime,
          updatedAt: row.ac_updated_datetime,
          tags: tagsForActivity.all(row.ac_id),
        });
      }
      return keys.map((date) => ({
        date,
        activities: byDay.get(date) ?? [],
      }));
    },

    getById: getDetail,

    create(pl_notes: string, day?: string): ActivityDetail {
      const now = new Date().toISOString();
      const calendarDay = day ?? dayKeyLocal(new Date());
      const info = insert.run(pl_notes, now, now, calendarDay) as import("better-sqlite3").RunResult;
      const id = Number(info.lastInsertRowid);
      const row = getRow.get(id);
      if (!row) throw new Error("Failed to read new activity");
      return { ...row, tags: [] };
    },

    update(ac_id: number, pl_notes: string): ActivityDetail | undefined {
      const now = new Date().toISOString();
      const result = update.run(pl_notes, now, ac_id) as import("better-sqlite3").RunResult;
      if (result.changes === 0) return undefined;
      return getDetail(ac_id);
    },

    linkTag(ac_id: number, tg_id: number): void {
      const row = getRow.get(ac_id);
      if (!row) throw new Error("Activity not found");
      const tag = tags.getById(tg_id);
      if (!tag) throw new Error("Tag not found");
      linkTagStmt.run(ac_id, tg_id);
    },

    unlinkTag(ac_id: number, tg_id: number): boolean {
      const r = unlinkTagStmt.run(ac_id, tg_id) as import("better-sqlite3").RunResult;
      return r.changes > 0;
    },
  };
}

export type ActivityService = ReturnType<typeof createActivityService>;
