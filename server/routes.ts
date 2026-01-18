import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { pool } from "./db";
import { metrics } from "./metrics";
import authRoutes from "./auth";
import presetsRoutes from "./presets";
import recordingsRoutes from "./recordings";
import supportRoutes from "./support";
import express from "express";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded recordings
  app.use("/uploads/recordings", express.static(path.join(process.cwd(), "uploads", "recordings")));

  // Auth routes (Space Child Auth integration)
  app.use("/api/space-child-auth", authRoutes);

  // API v1 routes
  app.use("/api/v1/presets", presetsRoutes);
  app.use("/api/v1/recordings", recordingsRoutes);
  app.use("/api/v1/support", supportRoutes);
  
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
