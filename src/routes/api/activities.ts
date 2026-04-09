import { Router } from "express";
import { z } from "zod";
import type { ActivityService } from "../../services/activityService";
import type { TagService } from "../../services/tagService";
import { httpError } from "../../middleware/errorHandler";

const createBody = z.object({
  pl_notes: z.string().default(""),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const patchBody = z.object({
  pl_notes: z.string(),
});

const tagLinkBody = z
  .object({
    tg_id: z.number().int().positive().optional(),
    vt_name: z.string().optional(),
  })
  .refine((b) => b.tg_id !== undefined || (b.vt_name !== undefined && b.vt_name.trim() !== ""), {
    message: "Provide `tg_id` or `vt_name`",
  });

export function createActivitiesRouter(activities: ActivityService, tags: TagService): Router {
  const r = Router();

  r.get("/activities/:id", (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) throw httpError(400, "Invalid id");
      const row = activities.getById(id);
      if (!row) throw httpError(404, "Activity not found");
      res.json({
        id: row.ac_id,
        pl_notes: row.pl_notes,
        ac_created_datetime: row.ac_created_datetime,
        ac_updated_datetime: row.ac_updated_datetime,
        tags: row.tags.map((t) => ({ tg_id: t.tg_id, vt_name: t.vt_name })),
      });
    } catch (e) {
      next(e);
    }
  });

  r.post("/activities", (req, res, next) => {
    try {
      const body = createBody.parse(req.body);
      const row = activities.create(body.pl_notes, body.day);
      res.status(201).json({
        id: row.ac_id,
        pl_notes: row.pl_notes,
        ac_created_datetime: row.ac_created_datetime,
        ac_updated_datetime: row.ac_updated_datetime,
        tags: row.tags.map((t) => ({ tg_id: t.tg_id, vt_name: t.vt_name })),
      });
    } catch (e) {
      next(e);
    }
  });

  r.patch("/activities/:id", (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) throw httpError(400, "Invalid id");
      const body = patchBody.parse(req.body);
      const row = activities.update(id, body.pl_notes);
      if (!row) throw httpError(404, "Activity not found");
      res.json({
        id: row.ac_id,
        pl_notes: row.pl_notes,
        ac_created_datetime: row.ac_created_datetime,
        ac_updated_datetime: row.ac_updated_datetime,
        tags: row.tags.map((t) => ({ tg_id: t.tg_id, vt_name: t.vt_name })),
      });
    } catch (e) {
      next(e);
    }
  });

  r.post("/activities/:id/tags", (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) throw httpError(400, "Invalid id");
      const body = tagLinkBody.parse(req.body);
      let tg_id: number;
      if (body.tg_id !== undefined) {
        tg_id = body.tg_id;
      } else {
        const created = tags.createOrGet(body.vt_name!);
        tg_id = created.tg_id;
      }
      activities.linkTag(id, tg_id);
      const row = activities.getById(id);
      if (!row) throw httpError(404, "Activity not found");
      res.status(201).json({
        id: row.ac_id,
        tags: row.tags.map((t) => ({ tg_id: t.tg_id, vt_name: t.vt_name })),
      });
    } catch (e) {
      next(e);
    }
  });

  r.delete("/activities/:id/tags/:tgId", (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const tgId = Number(req.params.tgId);
      if (!Number.isInteger(id) || !Number.isInteger(tgId)) throw httpError(400, "Invalid id");
      const ok = activities.unlinkTag(id, tgId);
      if (!ok) throw httpError(404, "Link not found");
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  return r;
}
