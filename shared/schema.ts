import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  password: text("password").notNull(),
  // ZKP commitment fields
  zkpPublicKey: text("zkp_public_key"), // Public key commitment for ZKP auth
  zkpSalt: text("zkp_salt"), // Salt used for key derivation
  // Account lockout fields
  failedLoginAttempts: text("failed_login_attempts").notNull().default("0"),
  lockedUntil: timestamp("locked_until"),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Email verification tokens
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Refresh tokens for JWT auth
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// ZKP authentication challenges (temporary, for login flow)
export const zkpChallenges = pgTable("zkp_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  sessionId: text("session_id").notNull().unique(),
  challenge: text("challenge").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Login attempt logs for security auditing
export const loginAttempts = pgTable("login_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  success: boolean("success").notNull(),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Audit logs for tracking all sensitive operations
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(), // e.g., 'user.login', 'preset.create', 'settings.update'
  resource: text("resource"), // e.g., 'preset', 'user', 'ai_settings'
  resourceId: varchar("resource_id"), // ID of the affected resource
  changes: jsonb("changes"), // JSON diff of changes made
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"), // Additional context
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// User presets for saving effect chains
export const userPresets = pgTable("user_presets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  effectChain: jsonb("effect_chain").notNull(), // Array of effect configurations
  tags: text("tags").array(), // Array of tags for categorization
  isPublic: boolean("is_public").notNull().default(false),
  shareToken: varchar("share_token").unique(), // For sharing presets
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// User AI settings for optional LLM integration (effect suggestions)
export const userAISettings = pgTable("user_ai_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  provider: text("provider").notNull().default("none"), // none, openai, anthropic, ollama, custom
  apiKey: text("api_key"), // encrypted in production
  baseUrl: text("base_url"), // for ollama/custom providers
  model: text("model"), // specific model to use
  settings: jsonb("settings"), // provider-specific settings
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  password: true,
});

export const insertAISettingsSchema = createInsertSchema(userAISettings).omit({
  id: true,
});

export const updateAISettingsSchema = z.object({
  provider: z.enum(["none", "openai", "anthropic", "ollama", "custom"]).optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional().or(z.literal("")),
  model: z.string().optional(),
  settings: z.record(z.any()).optional(),
});

// Zod schemas for presets
export const insertPresetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  effectChain: z.array(z.any()),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
});

export const updatePresetSchema = insertPresetSchema.partial();

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserAISettings = typeof userAISettings.$inferSelect;
export type InsertAISettings = z.infer<typeof insertAISettingsSchema>;
export type UpdateAISettings = z.infer<typeof updateAISettingsSchema>;
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type ZKPChallenge = typeof zkpChallenges.$inferSelect;
export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type UserPreset = typeof userPresets.$inferSelect;
export type InsertPreset = z.infer<typeof insertPresetSchema>;
export type UpdatePreset = z.infer<typeof updatePresetSchema>;
