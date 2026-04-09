import express from "express";
import path from "node:path";
import type { ActivityService } from "./services/activityService";
import type { TagService } from "./services/tagService";
import { createRoutes } from "./routes";
import { errorHandler } from "./middleware/errorHandler";

export function createApp(activities: ActivityService, tags: TagService): express.Application {
  const app = express();
  app.use(express.json());

  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));

  app.use(createRoutes(activities, tags));

  app.use(errorHandler);
  return app;
}
