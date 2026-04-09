import { Router } from "express";
import type { ActivityService } from "../services/activityService";
import type { TagService } from "../services/tagService";
import { createApiRouter } from "./api";
import { createPagesRouter } from "./pages";

export function createRoutes(activities: ActivityService, tags: TagService): Router {
  const root = Router();
  root.use(createPagesRouter());
  root.use("/api", createApiRouter(activities, tags));
  return root;
}
