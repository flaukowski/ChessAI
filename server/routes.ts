import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { pool } from "./db";
import { metrics } from "./metrics";
import authRoutes from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes (Space Child Auth integration)
  app.use("/api/space-child-auth", authRoutes);
  
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.get("/metrics", (_req: Request, res: Response) => {
    res.json(metrics.snapshot());
  });

  app.get("/ready", async (_req: Request, res: Response) => {
    try {
      if (pool) {
        await (pool as any).query("SELECT 1");
        res.json({ ready: true });
      } else {
        if ((process.env.NODE_ENV || app.get("env")) === "development") {
          res.json({ ready: true, mode: "in-memory" });
        } else {
          throw new Error("DB not configured");
        }
      }
    } catch (err: any) {
      res.status(503).json({ ready: false, message: err?.message || "DB not ready" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
