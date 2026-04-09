import { Router } from "express";
import type { ActivityService } from "../../services/activityService";
import type { TagService } from "../../services/tagService";
import { createActivitiesRouter } from "./activities";
import { createDaysRouter } from "./days";
import { createTagsRouter } from "./tags";

export function createApiRouter(activities: ActivityService, tags: TagService): Router {
  const api = Router();
  api.use(createDaysRouter(activities));
  api.use(createActivitiesRouter(activities, tags));
  api.use(createTagsRouter(tags));
  return api;
}
