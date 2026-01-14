import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  password: text("password").notNull(),
});

export const musicGenerations = pgTable("music_generations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  title: text("title"),
  prompt: text("prompt").notNull(),
  style: text("style"),
  model: text("model").notNull().default("V5"),
  instrumental: boolean("instrumental").default(false),
  duration: integer("duration"), // in seconds
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  progress: integer("progress").notNull().default(0),
  statusDetail: text("status_detail"),
  audioUrl: text("audio_url"),
  imageUrl: text("image_url"),
  taskId: text("task_id"),
  metadata: jsonb("metadata"), // extra data like BPM, key, etc.
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const imageGenerations = pgTable("image_generations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  title: text("title"),
  prompt: text("prompt").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  imageUrl: text("image_url"),
  musicGenerationId: varchar("music_generation_id").references(() => musicGenerations.id),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  password: true,
});

export const insertMusicGenerationSchema = createInsertSchema(musicGenerations).omit({
  id: true,
  userId: true,
  status: true,
  progress: true,
  statusDetail: true,
  audioUrl: true,
  imageUrl: true,
  taskId: true,
  createdAt: true,
  completedAt: true,
}).extend({
  customMode: z.boolean().optional(),
  negativeTags: z.string().optional(),
  vocalGender: z.enum(["m", "f"]).optional(),
  styleWeight: z.number().min(0).max(1).optional(),
  weirdnessConstraint: z.number().min(0).max(1).optional(),
});

export const insertImageGenerationSchema = createInsertSchema(imageGenerations).omit({
  id: true,
  userId: true,
  status: true,
  imageUrl: true,
  createdAt: true,
  completedAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type MusicGeneration = typeof musicGenerations.$inferSelect;
export type InsertMusicGeneration = z.infer<typeof insertMusicGenerationSchema>;
export type ImageGeneration = typeof imageGenerations.$inferSelect;
export type InsertImageGeneration = z.infer<typeof insertImageGenerationSchema>;
