/**
 * Server-side validation utilities
 * Provides strict input validation for security-sensitive operations
 */

import { z } from 'zod';
import crypto from 'crypto';

// RFC 5322 compliant email regex (simplified but covers most cases)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Common disposable email domains to block
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com', 'throwaway.email', 'mailinator.com', 'guerrillamail.com',
  'temp-mail.org', '10minutemail.com', 'fakeinbox.com', 'trashmail.com',
  'getairmail.com', 'getnada.com', 'mohmal.com', 'maildrop.cc',
]);

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates email format and checks against disposable domains
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Length check
  if (trimmedEmail.length > 254) {
    return { valid: false, error: 'Email address is too long' };
  }

  // Format check
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Domain validation
  const domain = trimmedEmail.split('@')[1];
  if (!domain) {
    return { valid: false, error: 'Invalid email domain' };
  }

  // Check for disposable email domains
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return { valid: false, error: 'Disposable email addresses are not allowed' };
  }

  // Check for valid TLD (at least 2 characters)
  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) {
    return { valid: false, error: 'Invalid email domain' };
  }

  return { valid: true };
}

/**
 * Validates password strength
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password is too long' };
  }

  // Check for at least one lowercase, one uppercase, one digit
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);

  if (!hasLowercase || !hasUppercase || !hasDigit) {
    return {
      valid: false,
      error: 'Password must contain at least one lowercase letter, one uppercase letter, and one digit',
    };
  }

  // Check for common weak passwords
  const weakPasswords = ['password', '12345678', 'qwerty123', 'admin123'];
  if (weakPasswords.some(weak => password.toLowerCase().includes(weak))) {
    return { valid: false, error: 'Password is too common' };
  }

  return { valid: true };
}

/**
 * Validates username
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Username must be less than 50 characters' };
  }

  // Only alphanumeric and underscores allowed
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }

  return { valid: true };
}

/**
 * Validates name fields (first/last name)
 */
export function validateName(name: string, fieldName: string = 'Name'): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { valid: true }; // Names are optional
  }

  const trimmed = name.trim();

  if (trimmed.length > 100) {
    return { valid: false, error: `${fieldName} must be less than 100 characters` };
  }

  // Basic XSS prevention - no HTML tags
  if (/<[^>]*>/.test(trimmed)) {
    return { valid: false, error: `${fieldName} contains invalid characters` };
  }

  return { valid: true };
}

/**
 * Sanitizes string input by removing potentially dangerous characters
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  // Remove null bytes and control characters, trim whitespace
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

/**
 * HTML-escapes a string to prevent XSS attacks
 * Used for user-provided strings that will be rendered or stored
 */
export function escapeHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes and HTML-escapes a name field for safe storage
 * Combines control character removal, trimming, and HTML entity encoding
 */
export function sanitizeName(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  // First remove control characters and trim
  const sanitized = sanitizeString(input);
  // Then HTML-escape for safe storage
  return escapeHtml(sanitized);
}

/**
 * Validates and normalizes email address
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Hashes an IP address using SHA-256 for GDPR/privacy compliance
 * Returns a consistent hash that can be used for rate limiting and analytics
 * without storing the actual IP address
 */
export function hashIpAddress(ipAddress: string | undefined | null): string {
  if (!ipAddress) {
    return 'unknown';
  }
  // Use a salt to prevent rainbow table attacks
  // In production, this should come from environment variable
  const salt = process.env.IP_HASH_SALT || 'audionoise-ip-salt-v1';
  return crypto
    .createHash('sha256')
    .update(salt + ipAddress)
    .digest('hex')
    .substring(0, 16); // Truncate to 16 chars for storage efficiency
}

// Zod schemas for API validation
export const registrationSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .max(254, 'Email is too long')
    .email('Invalid email format')
    .transform(normalizeEmail),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .optional(),
  zkpCommitment: z.object({
    publicKey: z.string(),
    salt: z.string(),
  }).optional(),
  // XSS prevention: HTML-escape names before storage
  firstName: z.string()
    .max(100, 'First name must be less than 100 characters')
    .optional()
    .default('')
    .transform(val => sanitizeName(val)),
  lastName: z.string()
    .max(100, 'Last name must be less than 100 characters')
    .optional()
    .default('')
    .transform(val => sanitizeName(val)),
}).refine(data => data.password || data.zkpCommitment, {
  message: 'Either password or ZKP commitment is required',
});

export const loginSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .transform(normalizeEmail),
  password: z.string().min(1, 'Password is required'),
});

export const challengeSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .transform(normalizeEmail),
});

export const verifyProofSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .transform(normalizeEmail),
  proof: z.object({
    sessionId: z.string(),
    response: z.string(),
    publicKey: z.string(),
  }),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .optional(),
  zkpCommitment: z.object({
    publicKey: z.string(),
    salt: z.string(),
  }).optional(),
}).refine(data => data.password || data.zkpCommitment, {
  message: 'Either password or ZKP commitment is required',
});

// ============================================================================
// Extended Zod Schemas for All User Input (Phase 2.2 Security Enhancement)
// ============================================================================

/**
 * Support ticket schema with input validation
 */
export const supportTicketSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .max(254, 'Email is too long')
    .email('Invalid email format')
    .transform(normalizeEmail),
  name: z.string()
    .max(100, 'Name must be less than 100 characters')
    .optional()
    .transform(val => val ? sanitizeName(val) : undefined),
  subject: z.string()
    .min(1, 'Subject is required')
    .max(200, 'Subject must be less than 200 characters')
    .transform(val => escapeHtml(sanitizeString(val))),
  message: z.string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must be less than 5000 characters')
    .transform(val => escapeHtml(sanitizeString(val))),
});

/**
 * User profile update schema with sanitization
 */
export const userProfileSchema = z.object({
  displayName: z.string()
    .max(100, 'Display name must be less than 100 characters')
    .optional()
    .transform(val => val ? sanitizeName(val) : undefined),
  bio: z.string()
    .max(500, 'Bio must be less than 500 characters')
    .optional()
    .transform(val => val ? escapeHtml(sanitizeString(val)) : undefined),
  avatarUrl: z.string()
    .url('Invalid avatar URL')
    .max(500, 'URL too long')
    .optional()
    .or(z.literal('')),
  websiteUrl: z.string()
    .url('Invalid website URL')
    .max(500, 'URL too long')
    .optional()
    .or(z.literal('')),
  twitterHandle: z.string()
    .max(50, 'Handle too long')
    .regex(/^@?[a-zA-Z0-9_]*$/, 'Invalid Twitter handle')
    .optional()
    .transform(val => val ? sanitizeString(val) : undefined),
  instagramHandle: z.string()
    .max(50, 'Handle too long')
    .regex(/^@?[a-zA-Z0-9_.]*$/, 'Invalid Instagram handle')
    .optional()
    .transform(val => val ? sanitizeString(val) : undefined),
  youtubeChannel: z.string()
    .url('Invalid YouTube URL')
    .max(500, 'URL too long')
    .optional()
    .or(z.literal('')),
  soundcloudUrl: z.string()
    .url('Invalid SoundCloud URL')
    .max(500, 'URL too long')
    .optional()
    .or(z.literal('')),
  location: z.string()
    .max(100, 'Location must be less than 100 characters')
    .optional()
    .transform(val => val ? sanitizeName(val) : undefined),
  isPublic: z.boolean().optional(),
});

/**
 * Comment schema with XSS prevention
 */
export const commentSchema = z.object({
  content: z.string()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment must be less than 2000 characters')
    .transform(val => escapeHtml(sanitizeString(val))),
  parentId: z.string().uuid('Invalid parent comment ID').optional(),
});

/**
 * Workspace creation schema
 */
export const workspaceSchema = z.object({
  name: z.string()
    .min(1, 'Workspace name is required')
    .max(100, 'Name must be less than 100 characters')
    .transform(val => sanitizeName(val)),
  slug: z.string()
    .min(1, 'Slug is required')
    .max(100, 'Slug must be less than 100 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .transform(val => val ? escapeHtml(sanitizeString(val)) : undefined),
  logoUrl: z.string()
    .url('Invalid logo URL')
    .max(500, 'URL too long')
    .optional()
    .or(z.literal('')),
});

/**
 * Workspace invite schema
 */
export const workspaceInviteSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .transform(normalizeEmail),
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
});

/**
 * Preset schema with sanitization
 */
export const presetSchema = z.object({
  name: z.string()
    .min(1, 'Preset name is required')
    .max(100, 'Name must be less than 100 characters')
    .transform(val => sanitizeName(val)),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .transform(val => val ? escapeHtml(sanitizeString(val)) : undefined),
  effectChain: z.array(z.any()),
  tags: z.array(z.string().max(50).transform(sanitizeString)).max(10).optional(),
  isPublic: z.boolean().optional(),
});

/**
 * Recording schema with sanitization
 */
export const recordingSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters')
    .transform(val => sanitizeName(val)),
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional()
    .transform(val => val ? escapeHtml(sanitizeString(val)) : undefined),
  duration: z.number().int().positive('Duration must be positive'),
  fileSize: z.number().int().positive('File size must be positive'),
  fileUrl: z.string().min(1, 'File URL is required'),
  format: z.enum(['wav', 'mp3', 'ogg']).default('wav'),
  sampleRate: z.number().int().positive().default(44100),
  channels: z.number().int().min(1).max(8).default(2),
  effectChain: z.array(z.any()).optional(),
  settings: z.record(z.any()).optional(),
  isPublic: z.boolean().default(false),
});

/**
 * AI settings schema
 */
export const aiSettingsSchema = z.object({
  provider: z.enum(['none', 'openai', 'anthropic', 'ollama', 'custom']).default('none'),
  apiKey: z.string()
    .max(500, 'API key too long')
    .optional()
    .transform(val => val ? sanitizeString(val) : undefined),
  baseUrl: z.string()
    .url('Invalid base URL')
    .max(500, 'URL too long')
    .optional()
    .or(z.literal('')),
  model: z.string()
    .max(100, 'Model name too long')
    .optional()
    .transform(val => val ? sanitizeString(val) : undefined),
  settings: z.record(z.any()).optional(),
});

/**
 * Token verification schema (generic)
 */
export const tokenSchema = z.object({
  token: z.string()
    .min(1, 'Token is required')
    .max(256, 'Token too long'),
});

/**
 * Pagination schema for list endpoints
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid('Invalid ID format');

// ============================================================================
// Type Exports
// ============================================================================

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChallengeInput = z.infer<typeof challengeSchema>;
export type VerifyProofInput = z.infer<typeof verifyProofSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SupportTicketInput = z.infer<typeof supportTicketSchema>;
export type UserProfileInput = z.infer<typeof userProfileSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type WorkspaceInput = z.infer<typeof workspaceSchema>;
export type WorkspaceInviteInput = z.infer<typeof workspaceInviteSchema>;
export type PresetInput = z.infer<typeof presetSchema>;
export type RecordingInput = z.infer<typeof recordingSchema>;
export type AISettingsInput = z.infer<typeof aiSettingsSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
