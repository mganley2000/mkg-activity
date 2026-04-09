import { Router } from "express";
import { z } from "zod";
import type { TagService } from "../../services/tagService";
import { httpError } from "../../middleware/errorHandler";

const createBody = z.object({
  vt_name: z.string().min(1),
});

export function createTagsRouter(tags: TagService): Router {
  const r = Router();

  r.get("/tags", (req, res, next) => {
    try {
      const q = z.string().optional().parse(req.query.q);
      const rows = tags.searchByPrefix(q ?? "");
      res.json({ tags: rows.map((t) => ({ tg_id: t.tg_id, vt_name: t.vt_name })) });
    } catch (e) {
      next(e);
    }
  });

  r.post("/tags", (req, res, next) => {
    try {
      const body = createBody.parse(req.body);
      const row = tags.createOrGet(body.vt_name);
      res.status(201).json({ tg_id: row.tg_id, vt_name: row.vt_name });
    } catch (e) {
      if (e instanceof Error && e.message === "Tag name is required") {
        next(httpError(400, e.message));
        return;
      }
      next(e);
    }
  });

  return r;
}
