import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    if (req.path.startsWith("/api")) {
      res.status(400).json({ error: "Validation failed", details: err.flatten() });
      return;
    }
    res.status(400).type("text/plain").send("Validation failed");
    return;
  }

  const message = err instanceof Error ? err.message : "Internal Server Error";
  const status = typeof (err as { status?: number }).status === "number" ? (err as { status: number }).status : 500;

  if (req.path.startsWith("/api")) {
    res.status(status).json({ error: message });
    return;
  }

  res.status(status).type("text/plain").send(message);
}

export function httpError(status: number, message: string): Error & { status: number } {
  const e = new Error(message) as Error & { status: number };
  e.status = status;
  return e;
}
