import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMusicGenerationSchema, insertImageGenerationSchema } from "@shared/schema";
import { generateMusic, checkGenerationStatus, downloadAudio } from "./services/suno";
import { generateImage, enhanceMusicPrompt } from "./services/openai";
import { pool } from "./db";
import { metrics } from "./metrics";
import billingRoutes from "./billing";

export async function registerRoutes(app: Express): Promise<Server> {
  // Billing routes (MoneyDevKit integration)
  app.use("/api/billing", billingRoutes);
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
  
  // Music Generation Routes
  app.post("/api/music/generate", async (req, res) => {
    try {
      const validatedData = insertMusicGenerationSchema.parse(req.body);
      
      // Enhance the prompt using OpenAI
      const enhancedPrompt = await enhanceMusicPrompt(validatedData.prompt);
      
      // Create database record
      const musicGeneration = await storage.createMusicGeneration({
        ...validatedData,
        prompt: enhancedPrompt,
        userId: undefined, // For now, no user system
      });

      // Start Suno generation
      const sunoResult = await generateMusic({
        prompt: enhancedPrompt,
        style: validatedData.style || undefined,
        title: validatedData.title || undefined,
        customMode: validatedData.customMode,
        instrumental: validatedData.instrumental || false,
        model: validatedData.model as any,
        negativeTags: validatedData.negativeTags,
        vocalGender: validatedData.vocalGender,
        styleWeight: validatedData.styleWeight,
        weirdnessConstraint: validatedData.weirdnessConstraint,
      });

      // Update with task ID
      const updated = await storage.updateMusicGeneration(musicGeneration.id, {
        taskId: sunoResult.taskId,
        status: "processing",
        progress: 5,
        statusDetail: "processing",
      });

      res.json(updated);
    } catch (error) {
      console.error("Music generation error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to generate music" 
      });
    }
  });

  app.get("/api/music/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const musicGeneration = await storage.getMusicGeneration(id);
      
      if (!musicGeneration) {
        return res.status(404).json({ message: "Music generation not found" });
      }

      if (musicGeneration.taskId && musicGeneration.status !== "completed") {
        // Check status with Suno
        const sunoStatus = await checkGenerationStatus(musicGeneration.taskId);
        
        if (sunoStatus.status === "completed") {
          // Update the record
          const updated = await storage.updateMusicGeneration(id, {
            status: "completed",
            audioUrl: sunoStatus.audioUrl,
            imageUrl: sunoStatus.imageUrl,
            duration: sunoStatus.duration,
            metadata: sunoStatus.metadata,
            completedAt: new Date(),
            progress: 100,
            statusDetail: "completed",
          });
          res.json(updated);
        } else {
          // Update status
          const next = Math.min((musicGeneration.progress || 0) + (sunoStatus.status === "processing" ? 5 : 2), 95);
          const detail = sunoStatus.status === "processing" ? "rendering audio" : "queued";
          const updated = await storage.updateMusicGeneration(id, {
            status: sunoStatus.status,
            progress: next,
            statusDetail: detail,
          });
          res.json(updated);
        }
      } else {
        res.json(musicGeneration);
      }
    } catch (error) {
      console.error("Status check error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to check status" 
      });
    }
  });

  app.get("/api/music/:id/events", async (req: Request, res: Response) => {
    const { id } = req.params;

    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    (res as any).flushHeaders?.();

    const send = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let closed = false;
    req.on("close", () => {
      closed = true;
      clearInterval(interval);
    });

    try {
      const mg = await storage.getMusicGeneration(id);
      if (!mg) {
        send("error", { message: "Music generation not found" });
        return res.end();
      }
      send("status", { id: mg.id, status: mg.status });
    } catch (e: any) {
      send("error", { message: e?.message || "Initialization error" });
    }

    const interval = setInterval(async () => {
      if (closed) return;
      try {
        const music = await storage.getMusicGeneration(id);
        if (!music) {
          send("error", { message: "Music generation not found" });
          clearInterval(interval);
          return res.end();
        }

        if (music.taskId && music.status !== "completed" && music.status !== "failed") {
          const sunoStatus = await checkGenerationStatus(music.taskId);
          let updated = music;

          if (sunoStatus.status === "completed") {
            updated = (await storage.updateMusicGeneration(id, {
              status: "completed",
              audioUrl: sunoStatus.audioUrl,
              imageUrl: sunoStatus.imageUrl,
              duration: sunoStatus.duration,
              metadata: sunoStatus.metadata,
              completedAt: new Date(),
              progress: 100,
              statusDetail: "completed",
            }))!;
            send("status", updated);
            clearInterval(interval);
            return res.end();
          } else {
            const next = Math.min((music.progress || 0) + (sunoStatus.status === "processing" ? 5 : 2), 95);
            const detail = sunoStatus.status === "processing" ? "rendering audio" : "queued";
            updated = (await storage.updateMusicGeneration(id, {
              status: sunoStatus.status,
              progress: next,
              statusDetail: detail,
            }))!;
            send("status", updated);
          }
        } else {
          send("ping", { t: Date.now() });
          if (music.status === "completed" || music.status === "failed") {
            clearInterval(interval);
            return res.end();
          }
        }
      } catch (err: any) {
        send("error", { message: err?.message || "Polling error" });
      }
    }, 2000);
  });

  app.get("/api/music/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      const musicGeneration = await storage.getMusicGeneration(id);
      
      if (!musicGeneration || !musicGeneration.audioUrl) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      const audioBuffer = await downloadAudio(musicGeneration.audioUrl);
      
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="${musicGeneration.title || 'generated-music'}.mp3"`,
        'Content-Length': audioBuffer.length,
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      
      res.send(audioBuffer);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to download audio" 
      });
    }
  });

  // Image Generation Routes
  app.post("/api/images/generate", async (req, res) => {
    try {
      const validatedData = insertImageGenerationSchema.parse(req.body);
      
      // Create database record
      const imageGeneration = await storage.createImageGeneration({
        ...validatedData,
        userId: undefined, // For now, no user system
      });

      // Get music context if linked to a music generation
      let musicContext = "";
      if (validatedData.musicGenerationId) {
        const musicGen = await storage.getMusicGeneration(validatedData.musicGenerationId);
        if (musicGen) {
          musicContext = `${musicGen.prompt} - Style: ${musicGen.style || 'Unknown'}`;
        }
      }

      // Generate image with OpenAI
      const openaiResult = await generateImage({
        prompt: validatedData.prompt,
        musicContext,
      });

      // Update with results
      const updated = await storage.updateImageGeneration(imageGeneration.id, {
        status: "completed",
        imageUrl: openaiResult.url,
        completedAt: new Date(),
      });

      res.json(updated);
    } catch (error) {
      console.error("Image generation error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to generate image" 
      });
    }
  });

  app.get("/api/images/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      const imageGeneration = await storage.getImageGeneration(id);
      
      if (!imageGeneration || !imageGeneration.imageUrl) {
        return res.status(404).json({ message: "Image file not found" });
      }

      // Proxy the image download
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(imageGeneration.imageUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const buffer = await response.buffer();
      
      res.set({
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${imageGeneration.title || 'generated-image'}.png"`,
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      
      res.send(buffer);
    } catch (error) {
      console.error("Image download error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to download image" 
      });
    }
  });

  // History Routes
  app.get("/api/generations/music", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const generations = await storage.getUserMusicGenerations(undefined, limit);
      res.json(generations);
    } catch (error) {
      console.error("Fetch music generations error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch music generations" 
      });
    }
  });

  app.get("/api/generations/images", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const generations = await storage.getUserImageGenerations(undefined, limit);
      res.json(generations);
    } catch (error) {
      console.error("Fetch image generations error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch image generations" 
      });
    }
  });

  app.get("/api/generations", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const musicGenerations = await storage.getUserMusicGenerations(undefined, limit);
      const imageGenerations = await storage.getUserImageGenerations(undefined, limit);
      
      // Combine and sort by creation date
      const allGenerations = [
        ...musicGenerations.map(g => ({ ...g, type: 'music' })),
        ...imageGenerations.map(g => ({ ...g, type: 'image' }))
      ].sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      
      res.json(allGenerations.slice(0, limit));
    } catch (error) {
      console.error("Fetch generations error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch generations" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
