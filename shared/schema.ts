import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, boolean, timestamp, integer, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export chat models for integration
export * from "./models/chat";

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

// User recordings for processed audio
export const recordings = pgTable("recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  duration: integer("duration").notNull(), // in seconds
  fileSize: integer("file_size").notNull(), // in bytes
  fileUrl: text("file_url").notNull(), // storage path/URL
  format: varchar("format", { length: 10 }).notNull().default("wav"), // wav, mp3, ogg
  sampleRate: integer("sample_rate").default(44100),
  channels: integer("channels").default(2),
  effectChain: jsonb("effect_chain"), // snapshot of effects used during recording
  settings: jsonb("settings"), // input/output gain, etc.
  isPublic: boolean("is_public").notNull().default(false),
  shareToken: varchar("share_token").unique(), // for sharing private recordings via link
  playCount: integer("play_count").default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Support tickets for user inquiries
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  email: text("email").notNull(),
  name: text("name"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 20 }).default("open"), // open, in_progress, resolved, closed
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
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

// Zod schemas for recordings
export const insertRecordingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  duration: z.number().int().positive(),
  fileSize: z.number().int().positive(),
  fileUrl: z.string(),
  format: z.enum(["wav", "mp3", "ogg"]).default("wav"),
  sampleRate: z.number().int().positive().default(44100),
  channels: z.number().int().min(1).max(8).default(2),
  effectChain: z.array(z.any()).optional(),
  settings: z.record(z.any()).optional(),
  isPublic: z.boolean().default(false),
});

export const updateRecordingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional(),
});

// Zod schemas for support tickets
export const insertSupportTicketSchema = z.object({
  email: z.string().email(),
  name: z.string().max(100).optional(),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(5000),
});

export type Recording = typeof recordings.$inferSelect;
export type InsertRecording = z.infer<typeof insertRecordingSchema>;
export type UpdateRecording = z.infer<typeof updateRecordingSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;

// AI Effect Conversations - stores chat history for effect suggestions
export const aiEffectConversations = pgTable("ai_effect_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").default("New Effect Chat"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// AI Effect Messages - individual messages in effect conversations
export const aiEffectMessages = pgTable("ai_effect_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => aiEffectConversations.id).notNull(),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  effectSuggestions: jsonb("effect_suggestions"), // Array of suggested effects with params
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// User Sound Preferences - learned from conversations to personalize suggestions
export const userSoundPreferences = pgTable("user_sound_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  preferredGenres: text("preferred_genres").array(),
  preferredEffects: text("preferred_effects").array(),
  toneDescriptors: text("tone_descriptors").array(), // e.g., "warm", "bright", "vintage"
  recentEffectChains: jsonb("recent_effect_chains"), // Most used effect combinations
  notes: text("notes"), // AI-generated summary of user's style
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertAIEffectConversationSchema = createInsertSchema(aiEffectConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAIEffectMessageSchema = createInsertSchema(aiEffectMessages).omit({
  id: true,
  createdAt: true,
});

export type AIEffectConversation = typeof aiEffectConversations.$inferSelect;
export type InsertAIEffectConversation = z.infer<typeof insertAIEffectConversationSchema>;
export type AIEffectMessage = typeof aiEffectMessages.$inferSelect;
export type InsertAIEffectMessage = z.infer<typeof insertAIEffectMessageSchema>;
export type UserSoundPreferences = typeof userSoundPreferences.$inferSelect;

// ============================================================================
// PHASE 1: Security & Foundation
// ============================================================================

// Encrypted API Keys - secure storage for user API keys
export const encryptedApiKeys = pgTable("encrypted_api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  provider: text("provider").notNull(), // openai, anthropic, custom
  keyHash: text("key_hash").notNull(), // SHA-256 hash for lookup
  encryptedKey: text("encrypted_key").notNull(), // AES-256-GCM encrypted (iv:authTag:encrypted)
  label: text("label"), // User-friendly name
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// GDPR Consent tracking
export const gdprConsent = pgTable("gdpr_consent", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  consentType: text("consent_type").notNull(), // terms, privacy, marketing, analytics
  granted: boolean("granted").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  consentedAt: timestamp("consented_at").notNull().default(sql`now()`),
  withdrawnAt: timestamp("withdrawn_at"),
});

// GDPR Data Export Requests
export const gdprExportRequests = pgTable("gdpr_export_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, processing, completed, expired
  downloadUrl: text("download_url"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  completedAt: timestamp("completed_at"),
});

// GDPR Deletion Requests
export const gdprDeletionRequests = pgTable("gdpr_deletion_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, processing, completed
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  scheduledDeletionAt: timestamp("scheduled_deletion_at"),
  completedAt: timestamp("completed_at"),
});

// ============================================================================
// PHASE 2: Monetization (Stripe)
// ============================================================================

// Subscription tiers enum-like values
export const SUBSCRIPTION_TIERS = {
  free: "free",
  pro: "pro",
  studio: "studio",
} as const;

export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[keyof typeof SUBSCRIPTION_TIERS];

// Subscriptions - Stripe subscription tracking
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  tier: varchar("tier", { length: 20 }).notNull().default("free"), // free, pro, studio
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, canceled, past_due, trialing
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  trialEndsAt: timestamp("trial_ends_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Usage records for metered billing and tier limits
export const usageRecords = pgTable("usage_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  usageType: text("usage_type").notNull(), // recordings, storage_bytes, ai_requests, effects_used
  quantity: integer("quantity").notNull().default(0),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Payment history
export const paymentHistory = pgTable("payment_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  amount: integer("amount").notNull(), // in cents
  currency: varchar("currency", { length: 3 }).notNull().default("usd"),
  status: varchar("status", { length: 20 }).notNull(), // succeeded, failed, pending, refunded
  description: text("description"),
  receiptUrl: text("receipt_url"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// ============================================================================
// PHASE 3: Team Workspaces & RBAC
// ============================================================================

// Workspace roles enum
export const WORKSPACE_ROLES = {
  admin: "admin",
  editor: "editor",
  viewer: "viewer",
} as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[keyof typeof WORKSPACE_ROLES];

// Workspaces - Team containers
export const workspaces = pgTable("workspaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  logoUrl: text("logo_url"),
  settings: jsonb("settings"), // workspace-specific settings
  subscriptionId: varchar("subscription_id").references(() => subscriptions.id),
  maxMembers: integer("max_members").default(5),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Workspace members - membership with roles
export const workspaceMembers = pgTable("workspace_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").references(() => workspaces.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("viewer"), // admin, editor, viewer
  joinedAt: timestamp("joined_at").notNull().default(sql`now()`),
});

// Workspace invites - pending invitations
export const workspaceInvites = pgTable("workspace_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").references(() => workspaces.id).notNull(),
  email: text("email").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("viewer"),
  token: text("token").notNull().unique(),
  invitedBy: varchar("invited_by").references(() => users.id).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Workspace recordings - link recordings to workspaces
export const workspaceRecordings = pgTable("workspace_recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").references(() => workspaces.id).notNull(),
  recordingId: varchar("recording_id").references(() => recordings.id).notNull(),
  addedBy: varchar("added_by").references(() => users.id).notNull(),
  addedAt: timestamp("added_at").notNull().default(sql`now()`),
});

// ============================================================================
// PHASE 4: Social & Community Features
// ============================================================================

// User profiles - public profile info
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  displayName: text("display_name"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  websiteUrl: text("website_url"),
  twitterHandle: text("twitter_handle"),
  instagramHandle: text("instagram_handle"),
  youtubeChannel: text("youtube_channel"),
  soundcloudUrl: text("soundcloud_url"),
  location: text("location"),
  isPublic: boolean("is_public").notNull().default(true),
  followerCount: integer("follower_count").notNull().default(0),
  followingCount: integer("following_count").notNull().default(0),
  recordingCount: integer("recording_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Follows - follower relationships
export const follows = pgTable("follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").references(() => users.id).notNull(),
  followingId: varchar("following_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Recording likes
export const recordingLikes = pgTable("recording_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recordingId: varchar("recording_id").references(() => recordings.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Recording comments - threaded comments
export const recordingComments = pgTable("recording_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recordingId: varchar("recording_id").references(() => recordings.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  parentId: varchar("parent_id"), // For threaded replies
  content: text("content").notNull(),
  isEdited: boolean("is_edited").notNull().default(false),
  likeCount: integer("like_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Comment likes
export const commentLikes = pgTable("comment_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commentId: varchar("comment_id").references(() => recordingComments.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // follow, like, comment, mention, workspace_invite
  actorId: varchar("actor_id").references(() => users.id),
  resourceType: text("resource_type"), // recording, comment, workspace
  resourceId: varchar("resource_id"),
  message: text("message"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// ============================================================================
// PHASE 5: Analytics & Admin
// ============================================================================

// Analytics events - for tracking user behavior
export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sessionId: text("session_id"),
  eventType: text("event_type").notNull(), // page_view, effect_used, recording_created, etc.
  eventData: jsonb("event_data"), // event-specific data
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Feature flags - for gradual rollouts
export const featureFlags = pgTable("feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  isEnabled: boolean("is_enabled").notNull().default(false),
  enabledForTiers: text("enabled_for_tiers").array(), // which subscription tiers have access
  enabledForUsers: text("enabled_for_users").array(), // specific user IDs for beta testing
  rolloutPercentage: integer("rollout_percentage").default(0), // 0-100 for gradual rollout
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Admin activity logs
export const adminLogs = pgTable("admin_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").references(() => users.id).notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"), // user, subscription, workspace, feature_flag
  targetId: varchar("target_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// ============================================================================
// Zod Schemas for new tables
// ============================================================================

// Encrypted API Keys
export const insertEncryptedApiKeySchema = z.object({
  provider: z.enum(["openai", "anthropic", "custom"]),
  keyHash: z.string(),
  encryptedKey: z.string(),
  label: z.string().max(100).optional(),
});

// GDPR Consent
export const insertGdprConsentSchema = z.object({
  consentType: z.enum(["terms", "privacy", "marketing", "analytics"]),
  granted: z.boolean(),
});

// Subscriptions
export const insertSubscriptionSchema = z.object({
  stripeCustomerId: z.string(),
  stripeSubscriptionId: z.string().optional(),
  stripePriceId: z.string().optional(),
  tier: z.enum(["free", "pro", "studio"]).default("free"),
  status: z.enum(["active", "canceled", "past_due", "trialing"]).default("active"),
});

// Workspaces
export const insertWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
  settings: z.record(z.any()).optional(),
});

export const updateWorkspaceSchema = insertWorkspaceSchema.partial();

// Workspace invites
export const insertWorkspaceInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
});

// User profiles
export const insertUserProfileSchema = z.object({
  displayName: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
  twitterHandle: z.string().max(50).optional(),
  instagramHandle: z.string().max(50).optional(),
  youtubeChannel: z.string().url().optional(),
  soundcloudUrl: z.string().url().optional(),
  location: z.string().max(100).optional(),
  isPublic: z.boolean().default(true),
});

export const updateUserProfileSchema = insertUserProfileSchema.partial();

// Comments
export const insertCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.string().optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

// Analytics events
export const insertAnalyticsEventSchema = z.object({
  eventType: z.string(),
  eventData: z.record(z.any()).optional(),
  sessionId: z.string().optional(),
});

// ============================================================================
// Type exports for new tables
// ============================================================================

export type EncryptedApiKey = typeof encryptedApiKeys.$inferSelect;
export type InsertEncryptedApiKey = z.infer<typeof insertEncryptedApiKeySchema>;
export type GdprConsent = typeof gdprConsent.$inferSelect;
export type InsertGdprConsent = z.infer<typeof insertGdprConsentSchema>;
export type GdprExportRequest = typeof gdprExportRequests.$inferSelect;
export type GdprDeletionRequest = typeof gdprDeletionRequests.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type UsageRecord = typeof usageRecords.$inferSelect;
export type PaymentHistory = typeof paymentHistory.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type UpdateWorkspace = z.infer<typeof updateWorkspaceSchema>;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type WorkspaceInvite = typeof workspaceInvites.$inferSelect;
export type InsertWorkspaceInvite = z.infer<typeof insertWorkspaceInviteSchema>;
export type WorkspaceRecording = typeof workspaceRecordings.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
export type Follow = typeof follows.$inferSelect;
export type RecordingLike = typeof recordingLikes.$inferSelect;
export type RecordingComment = typeof recordingComments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type UpdateComment = z.infer<typeof updateCommentSchema>;
export type CommentLike = typeof commentLikes.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type AdminLog = typeof adminLogs.$inferSelect;
