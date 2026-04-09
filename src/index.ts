import { createServer } from "node:http";
import { config } from "./config";
import { openDatabase } from "./db";
import { createActivityService } from "./services/activityService";
import { createTagService } from "./services/tagService";
import { createApp } from "./app";

const db = openDatabase();
const tags = createTagService(db);
const activities = createActivityService(db, tags);
const app = createApp(activities, tags);

const server = createServer(app);
server.listen(config.port, () => {
  console.log(`Listening on http://localhost:${config.port}`);
});
