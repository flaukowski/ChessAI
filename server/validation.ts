/**
 * Server-side validation utilities
 * Provides strict input validation for security-sensitive operations
 */

import { z } from 'zod';

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
 * Validates and normalizes email address
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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
  firstName: z.string().max(100).optional().default(''),
  lastName: z.string().max(100).optional().default(''),
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

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChallengeInput = z.infer<typeof challengeSchema>;
export type VerifyProofInput = z.infer<typeof verifyProofSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
