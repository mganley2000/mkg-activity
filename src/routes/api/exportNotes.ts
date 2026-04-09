import { Router, type NextFunction, type Request, type Response } from "express";
import PDFDocument from "pdfkit";
import { z } from "zod";
import {
  dayKeyLocal,
  inclusiveLocalDaySpan,
  MAX_CUSTOM_RANGE_INCLUSIVE_DAYS,
  recentDayKeys,
} from "../../lib/dates";
import type { ActivityService } from "../../services/activityService";
import { httpError } from "../../middleware/errorHandler";

const exportQuery = z.object({
  days: z.coerce.number().int().min(1).max(366).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const DASH_LINE = "-".repeat(30);

type ExportRow = { pl_notes: string; ac_created_datetime: string; ac_calendar_day: string | null };

function formatCreatedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { dateStyle: "full", timeStyle: "medium" });
}

/** Calendar day key for grouping (falls back to local date from created time). */
function calendarDayKey(row: ExportRow): string {
  if (row.ac_calendar_day) return row.ac_calendar_day;
  return dayKeyLocal(new Date(row.ac_created_datetime));
}

/** Human-readable label for a YYYY-MM-DD calendar day. */
function formatCalendarDayLabel(dateKey: string): string {
  const [ys, ms, ds] = dateKey.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return dateKey;
  const longDate = dt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `${longDate} (${dateKey})`;
}

function writeNotesExportPdf(res: Response, rows: ExportRow[], filename: string): void {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 72, size: "LETTER" });
  const textWidth = 468;

  doc.pipe(res);

  if (rows.length === 0) {
    doc.font("Helvetica").fontSize(11).text("No notes in this date range.", { width: textWidth });
    doc.end();
    return;
  }

  let prevDay: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const dayKey = calendarDayKey(row);
    if (dayKey !== prevDay) {
      if (prevDay !== null) doc.moveDown(1.15);
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(`Calendar Day: ${formatCalendarDayLabel(dayKey)}`, { width: textWidth });
      doc.moveDown(0.45);
      prevDay = dayKey;
    }

    const heading = `Activity Created on: ${formatCreatedDate(row.ac_created_datetime)}`;
    doc.font("Helvetica-Bold").fontSize(11).text(heading, { width: textWidth });
    doc.moveDown(0.35);
    doc.font("Helvetica").fontSize(10).text(DASH_LINE, { width: textWidth });
    doc.moveDown(0.35);
    const body = row.pl_notes.trim() === "" ? "—" : row.pl_notes;
    doc.font("Helvetica").fontSize(10).text(body, { width: textWidth });

    if (i < rows.length - 1) {
      const nextSameDay = calendarDayKey(rows[i + 1]!) === dayKey;
      doc.moveDown(nextSameDay ? 1.1 : 0.05);
    }
  }

  doc.end();
}

export function createExportNotesRouter(activities: ActivityService): Router {
  const r = Router();

  r.get("/export/notes", (req: Request, res: Response, next: NextFunction): void => {
    try {
      const q = exportQuery.parse(req.query);
      let minKey: string;
      let maxKey: string;

      let filename: string;
      if (q.from && q.to) {
        if (q.from > q.to) {
          throw httpError(400, "`from` must be <= `to`");
        }
        if (inclusiveLocalDaySpan(q.from, q.to) > MAX_CUSTOM_RANGE_INCLUSIVE_DAYS) {
          throw httpError(400, "Range cannot exceed 2 years");
        }
        minKey = q.from;
        maxKey = q.to;
        filename = `activity-notes-${minKey}-to-${maxKey}.pdf`;
      } else if (q.from || q.to) {
        throw httpError(400, "Provide both `from` and `to`, or use `days`");
      } else {
        const rollingDays = q.days ?? 30;
        const dayKeys = recentDayKeys(new Date(), rollingDays);
        const sorted = [...dayKeys].sort();
        minKey = sorted[0]!;
        maxKey = sorted[sorted.length - 1]!;
        filename = `activity-notes-last-${rollingDays}d.pdf`;
      }

      const rows = activities.listNotesForExportRange(minKey, maxKey);

      writeNotesExportPdf(res, rows, filename);
    } catch (e) {
      next(e);
    }
  });

  return r;
}
