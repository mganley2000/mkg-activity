import { Router } from "express";
import path from "node:path";
import { Eta } from "eta";

const viewsPath = path.join(__dirname, "..", "..", "views");
const eta = new Eta({ views: viewsPath, cache: false });

export function createPagesRouter(): Router {
  const r = Router();

  r.get("/", async (_req, res, next) => {
    try {
      const html = await eta.renderAsync("layouts/main", {
        title: "Activity Logging",
        bodyPartial: "/pages/home-content",
      });
      res.type("html").send(html);
    } catch (e) {
      next(e);
    }
  });

  return r;
}
