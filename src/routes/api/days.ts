import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { ActivityService } from "../../services/activityService";
import { httpError } from "../../middleware/errorHandler";

const daysQuery = z.object({
  days: z.coerce.number().int().min(1).max(366).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export function createDaysRouter(activities: ActivityService): Router {
  const r = Router();

  function handler(req: Request, res: Response, next: NextFunction): void {
    try {
      const q = daysQuery.parse(req.query);
      if (q.from && q.to) {
        if (q.from > q.to) {
          throw httpError(400, "`from` must be <= `to`");
        }
        const buckets = activities.getCalendarRange(q.from, q.to);
        res.json({ days: buckets });
        return;
      }
      if (q.from || q.to) {
        throw httpError(400, "Provide both `from` and `to`, or use `days`");
      }
      const n = q.days ?? 30;
      const buckets = activities.getCalendarDays(n);
      res.json({ days: buckets });
    } catch (e) {
      next(e);
    }
  }

  r.get("/days", handler);
  r.get("/calendar", handler);

  return r;
}
