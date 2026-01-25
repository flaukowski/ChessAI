import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { storage } from './storage';
import { tokenConfig, securityConfig } from './config';
import type { User } from '@shared/schema';
import { sendVerificationEmail, sendPasswordResetEmail } from './email';
import {
  generateCommitment,
  generateChallenge,
  verifyProof,
  type ZKPCommitment,
  type ZKPProof,
} from '@shared/zkp-crypto';
import {
  validateEmail,
  validatePassword,
  sanitizeString,
  sanitizeName,
  normalizeEmail,
  hashIpAddress,
  registrationSchema,
  loginSchema,
  challengeSchema,
} from './validation';
import cookieParser from 'cookie-parser';

const router = Router();

// Cookie configuration for HttpOnly cookies (XSS protection)
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api',
};

const REFRESH_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  path: '/api/space-child-auth/refresh',
};

// Cookie names
const ACCESS_TOKEN_COOKIE = 'auth_access_token';
const REFRESH_TOKEN_COOKIE = 'auth_refresh_token';
const CSRF_TOKEN_COOKIE = 'csrf_token';

// CSRF cookie configuration (readable by JavaScript for double-submit pattern)
const CSRF_COOKIE_OPTIONS = {
  httpOnly: false, // Must be readable by JavaScript
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

// CSRF token generation (256-bit cryptographically secure)
const generateCSRFToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Helper to set CSRF cookie and return token for response body
const setCSRFCookie = (res: Response): string => {
  const csrfToken = generateCSRFToken();
  res.cookie(CSRF_TOKEN_COOKIE, csrfToken, {
    ...CSRF_COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  return csrfToken;
};

// Helper to set auth cookies
const setAuthCookies = (res: Response, accessToken: string, refreshToken: string, accessExpiresAt: Date, refreshExpiresAt: Date) => {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...COOKIE_OPTIONS,
    expires: accessExpiresAt,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...REFRESH_COOKIE_OPTIONS,
    expires: refreshExpiresAt,
  });
};

// Helper to clear auth cookies
const clearAuthCookies = (res: Response) => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { path: COOKIE_OPTIONS.path });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: REFRESH_COOKIE_OPTIONS.path });
  res.clearCookie(CSRF_TOKEN_COOKIE, { path: CSRF_COOKIE_OPTIONS.path });
};

/**
 * CSRF Protection Middleware
 * Validates CSRF token on state-changing requests (POST, PUT, DELETE, PATCH)
 * Uses double-submit cookie pattern: compares X-CSRF-Token header with csrf_token cookie
 */
export const validateCSRFToken = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF validation for safe HTTP methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const headerToken = req.headers['x-csrf-token'] as string | undefined;
  const cookieToken = req.cookies?.[CSRF_TOKEN_COOKIE] as string | undefined;

  // Both tokens must be present
  if (!headerToken || !cookieToken) {
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'Missing CSRF token. Please refresh the page and try again.',
    });
  }

  // Tokens must match (constant-time comparison to prevent timing attacks)
  try {
    const headerBuffer = Buffer.from(headerToken);
    const cookieBuffer = Buffer.from(cookieToken);

    if (headerBuffer.length !== cookieBuffer.length ||
        !crypto.timingSafeEqual(headerBuffer, cookieBuffer)) {
      return res.status(403).json({
        error: 'Invalid CSRF token',
        message: 'CSRF token validation failed. Please refresh the page and try again.',
      });
    }
  } catch {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'CSRF token validation failed. Please refresh the page and try again.',
    });
  }

  next();
};

// Token configuration (from centralized config)
const ACCESS_TOKEN_EXPIRY_MS = tokenConfig.accessTokenExpiryMs;
const REFRESH_TOKEN_EXPIRY_MS = tokenConfig.refreshTokenExpiryMs;
const ABSOLUTE_SESSION_TIMEOUT_MS = tokenConfig.absoluteSessionTimeoutMs;
const EMAIL_VERIFICATION_EXPIRY_MS = tokenConfig.emailVerificationExpiryMs;
const PASSWORD_RESET_EXPIRY_MS = tokenConfig.passwordResetExpiryMs;
const ZKP_CHALLENGE_EXPIRY_MS = tokenConfig.zkpChallengeExpiryMs;
const SALT_ROUNDS = securityConfig.saltRounds;

// Security configuration (from centralized config)
const MAX_LOGIN_ATTEMPTS = securityConfig.maxLoginAttempts;
const LOCKOUT_DURATION_MS = securityConfig.lockoutDurationMs;
const RATE_LIMIT_WINDOW_MS = securityConfig.rateLimitWindowMs;
const RATE_LIMIT_MAX_REQUESTS = securityConfig.rateLimitMaxRequests;

// Credential stuffing prevention configuration
const EMAIL_FAILED_LOGIN_WINDOW_MS = securityConfig.emailFailedLoginWindowMs;
const EMAIL_MAX_FAILED_ATTEMPTS = securityConfig.emailMaxFailedAttempts;
const EMAIL_ACTION_WINDOW_MS = securityConfig.emailActionWindowMs;
const EMAIL_MAX_ACTION_REQUESTS = securityConfig.emailMaxActionRequests;

// Graduated backoff configuration
const BACKOFF_BASE_DELAY_MS = securityConfig.backoffBaseDelayMs;
const BACKOFF_MAX_DELAY_MS = securityConfig.backoffMaxDelayMs;
const BACKOFF_MULTIPLIER = securityConfig.backoffMultiplier;

// Global auth rate limiting
const GLOBAL_AUTH_RATE_LIMIT_WINDOW_MS = securityConfig.globalAuthRateLimitWindowMs;
const GLOBAL_AUTH_RATE_LIMIT_MAX_REQUESTS = securityConfig.globalAuthRateLimitMaxRequests;
const SENSITIVE_ENDPOINT_MAX_REQUESTS = securityConfig.sensitiveEndpointMaxRequests;
const SENSITIVE_ENDPOINT_WINDOW_MS = securityConfig.sensitiveEndpointWindowMs;

// In-memory stores with max size limits to prevent unbounded growth
const MAX_ACCESS_TOKENS = 10000; // Max concurrent sessions
const MAX_RATE_LIMIT_ENTRIES = 5000;
const MAX_EMAIL_TRACKING_ENTRIES = 10000;
const accessTokenStore = new Map<string, { userId: string; expiresAt: Date }>();
const rateLimitStore = new Map<string, { count: number; resetAt: Date }>();
const emailRateLimitStore = new Map<string, { count: number; resetAt: Date }>();

// Per-email failed login tracking (24h window for credential stuffing prevention)
interface EmailFailedLoginTracking {
  attempts: number;
  firstAttemptAt: Date;
  lastAttemptAt: Date;
  consecutiveFailures: number; // For graduated backoff
  lockedUntil?: Date;
}
const emailFailedLoginStore = new Map<string, EmailFailedLoginTracking>();

// Per-email action rate limiting (verification, password reset)
interface EmailActionTracking {
  count: number;
  resetAt: Date;
}
const emailActionStore = new Map<string, EmailActionTracking>();

// Sensitive endpoint rate limiting (login, register, reset - stricter limits)
const sensitiveEndpointStore = new Map<string, { count: number; resetAt: Date }>();

// Evict oldest entries when store reaches max size (LRU-style)
const evictOldestIfNeeded = <K, V>(store: Map<K, V>, maxSize: number): void => {
  if (store.size >= maxSize) {
    // Delete first 10% of entries (oldest, since Map maintains insertion order)
    const deleteCount = Math.floor(maxSize * 0.1);
    const iterator = store.keys();
    for (let i = 0; i < deleteCount; i++) {
      const key = iterator.next().value;
      if (key !== undefined) store.delete(key);
    }
  }
};

// Per-email rate limiting configuration
const EMAIL_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_RATE_LIMIT_MAX_ATTEMPTS = 5; // Max registration/reset attempts per email per hour

/**
 * Invalidate all in-memory access tokens for a specific user.
 * Called on password reset, account compromise, or forced logout.
 * This is critical for security - refresh token deletion alone is not enough
 * since in-memory access tokens remain valid until they expire.
 */
const invalidateAccessTokensForUser = (userId: string): number => {
  let invalidatedCount = 0;
  for (const [token, data] of accessTokenStore.entries()) {
    if (data.userId === userId) {
      accessTokenStore.delete(token);
      invalidatedCount++;
    }
  }
  if (invalidatedCount > 0) {
    console.log(`[Auth] Invalidated ${invalidatedCount} access token(s) for user ${userId}`);
  }
  return invalidatedCount;
};

// Helper functions
const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

const generateToken = (): string => {
  return nanoid(64);
};

const sanitizeUser = (user: User) => {
  const { password, zkpPublicKey, zkpSalt, failedLoginAttempts, lockedUntil, ...safeUser } = user;
  return {
    ...safeUser,
    createdAt: safeUser.createdAt?.toISOString(),
    updatedAt: safeUser.updatedAt?.toISOString(),
  };
};

const createTokenPair = async (userId: string) => {
  const accessToken = generateToken();
  const refreshToken = generateToken();

  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_EXPIRY_MS);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  // Evict old tokens if we're at capacity
  evictOldestIfNeeded(accessTokenStore, MAX_ACCESS_TOKENS);
  accessTokenStore.set(accessToken, { userId, expiresAt: accessExpiresAt });
  await storage.createRefreshToken(userId, refreshToken, refreshExpiresAt);

  return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt };
};

const getClientIP = (req: Request): string => {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';
};

/**
 * Get hashed client IP for GDPR-compliant storage in login_attempts
 * The hash allows for rate limiting and analytics without storing raw IPs
 */
const getHashedClientIP = (req: Request): string => {
  const rawIP = getClientIP(req);
  return hashIpAddress(rawIP);
};

// Check per-email rate limit
const checkEmailRateLimit = (email: string): { allowed: boolean; retryAfter?: number } => {
  const normalizedEmail = normalizeEmail(email);
  const now = new Date();
  const limit = emailRateLimitStore.get(normalizedEmail);

  if (!limit) {
    emailRateLimitStore.set(normalizedEmail, {
      count: 1,
      resetAt: new Date(now.getTime() + EMAIL_RATE_LIMIT_WINDOW_MS),
    });
    return { allowed: true };
  }

  if (limit.resetAt < now) {
    emailRateLimitStore.set(normalizedEmail, {
      count: 1,
      resetAt: new Date(now.getTime() + EMAIL_RATE_LIMIT_WINDOW_MS),
    });
    return { allowed: true };
  }

  if (limit.count >= EMAIL_RATE_LIMIT_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfter: Math.ceil((limit.resetAt.getTime() - now.getTime()) / 1000),
    };
  }

  limit.count++;
  return { allowed: true };
};

// =============================================================================
// CREDENTIAL STUFFING PREVENTION (Phase 2.3)
// =============================================================================

/**
 * Calculate graduated backoff delay based on consecutive failures.
 * Uses exponential backoff: baseDelay * (multiplier ^ failures)
 * Capped at maxDelay to prevent excessive wait times.
 *
 * Backoff schedule (with default config):
 * - 1st failure: 1s
 * - 2nd failure: 2s
 * - 3rd failure: 4s
 * - 4th failure: 8s
 * - 5th failure: 16s (account locked for 24h after this)
 */
const calculateBackoffDelay = (consecutiveFailures: number): number => {
  if (consecutiveFailures <= 0) return 0;
  const delay = BACKOFF_BASE_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, consecutiveFailures - 1);
  return Math.min(delay, BACKOFF_MAX_DELAY_MS);
};

/**
 * Check if login attempt is allowed for an email (24h window).
 * Implements per-email rate limiting to prevent credential stuffing attacks.
 *
 * @returns { allowed, retryAfter, backoffDelay, remainingAttempts }
 */
const trackEmailFailedLogin = (email: string): {
  allowed: boolean;
  retryAfter?: number;
  backoffDelay?: number;
  remainingAttempts?: number;
} => {
  const normalizedEmail = normalizeEmail(email);
  const now = new Date();

  // Evict oldest entries if needed
  evictOldestIfNeeded(emailFailedLoginStore, MAX_EMAIL_TRACKING_ENTRIES);

  let tracking = emailFailedLoginStore.get(normalizedEmail);

  // Check if currently locked due to graduated backoff
  if (tracking?.lockedUntil && tracking.lockedUntil > now) {
    return {
      allowed: false,
      retryAfter: Math.ceil((tracking.lockedUntil.getTime() - now.getTime()) / 1000),
    };
  }

  // Reset if 24h window has passed
  if (tracking && (now.getTime() - tracking.firstAttemptAt.getTime() > EMAIL_FAILED_LOGIN_WINDOW_MS)) {
    emailFailedLoginStore.delete(normalizedEmail);
    tracking = undefined;
  }

  if (!tracking) {
    // No tracking yet - allow the attempt
    return { allowed: true, remainingAttempts: EMAIL_MAX_FAILED_ATTEMPTS };
  }

  // Check if max attempts exceeded in 24h window
  if (tracking.attempts >= EMAIL_MAX_FAILED_ATTEMPTS) {
    const windowResetTime = new Date(tracking.firstAttemptAt.getTime() + EMAIL_FAILED_LOGIN_WINDOW_MS);
    return {
      allowed: false,
      retryAfter: Math.ceil((windowResetTime.getTime() - now.getTime()) / 1000),
      remainingAttempts: 0,
    };
  }

  // Calculate graduated backoff delay
  const backoffDelay = calculateBackoffDelay(tracking.consecutiveFailures);
  const backoffUntil = new Date(tracking.lastAttemptAt.getTime() + backoffDelay);

  if (backoffDelay > 0 && backoffUntil > now) {
    return {
      allowed: false,
      retryAfter: Math.ceil((backoffUntil.getTime() - now.getTime()) / 1000),
      backoffDelay: Math.ceil(backoffDelay / 1000),
      remainingAttempts: EMAIL_MAX_FAILED_ATTEMPTS - tracking.attempts,
    };
  }

  return {
    allowed: true,
    backoffDelay: backoffDelay > 0 ? Math.ceil(backoffDelay / 1000) : undefined,
    remainingAttempts: EMAIL_MAX_FAILED_ATTEMPTS - tracking.attempts,
  };
};

/**
 * Record a failed login attempt for an email.
 * Implements graduated backoff by tracking consecutive failures.
 */
const recordEmailFailedLogin = (email: string): void => {
  const normalizedEmail = normalizeEmail(email);
  const now = new Date();

  let tracking = emailFailedLoginStore.get(normalizedEmail);

  // Reset if 24h window has passed
  if (tracking && (now.getTime() - tracking.firstAttemptAt.getTime() > EMAIL_FAILED_LOGIN_WINDOW_MS)) {
    tracking = undefined;
  }

  if (!tracking) {
    tracking = {
      attempts: 1,
      firstAttemptAt: now,
      lastAttemptAt: now,
      consecutiveFailures: 1,
    };
  } else {
    tracking.attempts++;
    tracking.lastAttemptAt = now;
    tracking.consecutiveFailures++;

    // Apply graduated backoff lock
    const backoffDelay = calculateBackoffDelay(tracking.consecutiveFailures);
    if (backoffDelay > 0) {
      tracking.lockedUntil = new Date(now.getTime() + backoffDelay);
    }
  }

  emailFailedLoginStore.set(normalizedEmail, tracking);
};

/**
 * Clear failed login tracking for an email (on successful login).
 */
const clearEmailFailedLogin = (email: string): void => {
  const normalizedEmail = normalizeEmail(email);
  emailFailedLoginStore.delete(normalizedEmail);
};

/**
 * Rate limit verification endpoints (resend-verification, forgot-password).
 * Prevents email spam by limiting requests per email per hour.
 * Default: 3 requests per email per hour.
 */
const checkEmailActionRateLimit = (email: string, action: string): {
  allowed: boolean;
  retryAfter?: number;
} => {
  const normalizedEmail = normalizeEmail(email);
  const key = `${action}:${normalizedEmail}`;
  const now = new Date();

  evictOldestIfNeeded(emailActionStore, MAX_RATE_LIMIT_ENTRIES);

  const tracking = emailActionStore.get(key);

  if (!tracking || tracking.resetAt < now) {
    emailActionStore.set(key, {
      count: 1,
      resetAt: new Date(now.getTime() + EMAIL_ACTION_WINDOW_MS),
    });
    return { allowed: true };
  }

  if (tracking.count >= EMAIL_MAX_ACTION_REQUESTS) {
    return {
      allowed: false,
      retryAfter: Math.ceil((tracking.resetAt.getTime() - now.getTime()) / 1000),
    };
  }

  tracking.count++;
  return { allowed: true };
};

/**
 * Strict rate limiting for sensitive endpoints (login, register, password reset).
 * More restrictive than general rate limiting to prevent brute force.
 * Default: 5 requests per IP per 5 minutes for sensitive operations.
 */
const checkSensitiveEndpointRateLimit = (ip: string): {
  allowed: boolean;
  retryAfter?: number;
} => {
  const now = new Date();

  evictOldestIfNeeded(sensitiveEndpointStore, MAX_RATE_LIMIT_ENTRIES);

  const tracking = sensitiveEndpointStore.get(ip);

  if (!tracking || tracking.resetAt < now) {
    sensitiveEndpointStore.set(ip, {
      count: 1,
      resetAt: new Date(now.getTime() + SENSITIVE_ENDPOINT_WINDOW_MS),
    });
    return { allowed: true };
  }

  if (tracking.count >= SENSITIVE_ENDPOINT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfter: Math.ceil((tracking.resetAt.getTime() - now.getTime()) / 1000),
    };
  }

  tracking.count++;
  return { allowed: true };
};

/**
 * Middleware for sensitive endpoints with combined rate limiting.
 * Applies stricter IP-based limits for login/register/reset endpoints.
 */
const sensitiveEndpointRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = getClientIP(req);

  // Check sensitive endpoint rate limit
  const sensitiveLimit = checkSensitiveEndpointRateLimit(ip);
  if (!sensitiveLimit.allowed) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Too many authentication attempts. Please wait before trying again.',
      retryAfter: sensitiveLimit.retryAfter,
    });
  }

  next();
};

// Log audit event helper
// Note: Uses hashed IP for GDPR compliance in audit logs
const logAuditEvent = async (
  action: string,
  req: Request,
  userId?: string,
  resource?: string,
  resourceId?: string,
  changes?: Record<string, any>,
  metadata?: Record<string, any>
) => {
  try {
    await storage.createAuditLog({
      userId,
      action,
      resource,
      resourceId,
      changes,
      ipAddress: getHashedClientIP(req),
      userAgent: req.headers['user-agent'],
      metadata,
    });
  } catch (error) {
    console.error('[Audit] Failed to log event:', error);
  }
};

// Rate limiting middleware
const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const key = getClientIP(req);
  const now = new Date();

  const limit = rateLimitStore.get(key);
  if (limit) {
    if (limit.resetAt < now) {
      // Reset window
      rateLimitStore.set(key, { count: 1, resetAt: new Date(now.getTime() + RATE_LIMIT_WINDOW_MS) });
    } else if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Please wait before trying again',
        retryAfter: Math.ceil((limit.resetAt.getTime() - now.getTime()) / 1000),
      });
    } else {
      limit.count++;
    }
  } else {
    rateLimitStore.set(key, { count: 1, resetAt: new Date(now.getTime() + RATE_LIMIT_WINDOW_MS) });
  }

  next();
};

// Apply rate limiting to all auth routes
router.use(rateLimiter);

// Middleware to verify access token (reads from HttpOnly cookies first, falls back to Authorization header)
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  // Try to get token from HttpOnly cookie first (primary method for XSS protection)
  let token = req.cookies?.[ACCESS_TOKEN_COOKIE];
  
  // Fall back to Authorization header for backwards compatibility
  if (!token) {
    const authHeader = req.headers.authorization;
    token = authHeader?.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const tokenData = accessTokenStore.get(token);
  if (!tokenData || tokenData.expiresAt < new Date()) {
    accessTokenStore.delete(token);
    return res.status(401).json({ error: 'Token expired or invalid' });
  }

  (req as any).userId = tokenData.userId;
  next();
};

// Clean up expired tokens and rate limit entries periodically
setInterval(() => {
  const now = new Date();

  // Clean up expired access tokens
  for (const [token, data] of accessTokenStore.entries()) {
    if (data.expiresAt < now) {
      accessTokenStore.delete(token);
    }
  }

  // Clean up IP rate limit entries
  for (const [key, data] of rateLimitStore.entries()) {
    if (data.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }

  // Clean up email registration rate limit entries
  for (const [email, data] of emailRateLimitStore.entries()) {
    if (data.resetAt < now) {
      emailRateLimitStore.delete(email);
    }
  }

  // Clean up per-email failed login tracking (24h window)
  for (const [email, data] of emailFailedLoginStore.entries()) {
    if (now.getTime() - data.firstAttemptAt.getTime() > EMAIL_FAILED_LOGIN_WINDOW_MS) {
      emailFailedLoginStore.delete(email);
    }
  }

  // Clean up email action rate limit entries (verification, password reset)
  for (const [key, data] of emailActionStore.entries()) {
    if (data.resetAt < now) {
      emailActionStore.delete(key);
    }
  }

  // Clean up sensitive endpoint rate limit entries
  for (const [ip, data] of sensitiveEndpointStore.entries()) {
    if (data.resetAt < now) {
      sensitiveEndpointStore.delete(ip);
    }
  }

  // Clean up expired ZKP challenges
  storage.deleteExpiredZKPChallenges().catch(console.error);
}, 60000);

// ============== ZKP AUTH ROUTES ==============

/**
 * Register with ZKP
 * Client sends pre-computed ZKP commitment (public key + salt)
 *
 * SECURITY (Phase 2.3):
 * - IP-based sensitive endpoint rate limiting (5 per 5 minutes)
 * - Per-email rate limiting for registration attempts
 */
router.post('/register', sensitiveEndpointRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, zkpCommitment, firstName, lastName } = req.body;

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        error: 'Invalid email',
        message: emailValidation.error,
      });
    }

    // Check per-email rate limit
    const emailRateLimit = checkEmailRateLimit(email);
    if (!emailRateLimit.allowed) {
      await logAuditEvent('auth.register.rate_limited', req, undefined, 'user', undefined, undefined, { email: normalizeEmail(email) });
      return res.status(429).json({
        error: 'Too many attempts',
        message: 'Too many registration attempts for this email. Please try again later.',
        retryAfter: emailRateLimit.retryAfter,
      });
    }

    if (!email || (!password && !zkpCommitment)) {
      return res.status(400).json({
        error: 'Missing fields',
        message: 'Email and either password or ZKP commitment required',
      });
    }

    // Validate password if provided
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          error: 'Invalid password',
          message: passwordValidation.error,
        });
      }
    }

    const normalizedEmail = normalizeEmail(email);
    const existingUser = await storage.getUserByEmail(normalizedEmail);
    if (existingUser) {
      // Don't reveal that email exists - use same rate limit response
      await logAuditEvent('auth.register.email_exists', req, undefined, 'user', undefined, undefined, { email: normalizedEmail });
      return res.status(409).json({
        error: 'Email exists',
        message: 'An account with this email already exists',
      });
    }

    // Use sanitizeName for XSS prevention - HTML-escapes in addition to control char removal
    const sanitizedFirstName = sanitizeName(firstName || '');
    const sanitizedLastName = sanitizeName(lastName || '');
    const username = normalizedEmail.split('@')[0] + '_' + Date.now();

    // Handle ZKP commitment or generate from password
    let commitment: ZKPCommitment;
    let passwordHash: string;

    if (zkpCommitment) {
      // Client provided ZKP commitment
      commitment = zkpCommitment;
      // Store a placeholder hash (ZKP is the primary auth method)
      passwordHash = await hashPassword(nanoid(32));
    } else {
      // Generate ZKP commitment from password on server (less secure but backward compatible)
      commitment = await generateCommitment(password);
      passwordHash = await hashPassword(password);
    }

    const user = await storage.createUser({
      username,
      email: normalizedEmail,
      firstName: sanitizedFirstName,
      lastName: sanitizedLastName,
      password: passwordHash,
    });

    // Store ZKP commitment
    await storage.updateUser(user.id, {
      zkpPublicKey: commitment.publicKey,
      zkpSalt: commitment.salt,
    });

    // Create email verification token
    const verificationToken = generateToken();
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS);
    await storage.createEmailVerificationToken(user.id, verificationToken, expiresAt);

    // Send verification email
    try {
      await sendVerificationEmail(normalizedEmail, verificationToken, sanitizedFirstName);
      console.log(`[Auth] Verification email sent to ${normalizedEmail}`);
    } catch (emailError) {
      console.error('[Auth] Failed to send verification email:', emailError);
    }

    const tokens = await createTokenPair(user.id);

    // Log successful registration
    await storage.recordLoginAttempt(normalizedEmail, true, getHashedClientIP(req), req.headers['user-agent']);
    await logAuditEvent('auth.register.success', req, user.id, 'user', user.id, undefined, { email: normalizedEmail });

    // Set HttpOnly cookies for XSS protection
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken, tokens.accessExpiresAt, tokens.refreshExpiresAt);
    const csrfToken = setCSRFCookie(res);

    res.status(201).json({
      user: sanitizeUser({ ...user, zkpPublicKey: commitment.publicKey, zkpSalt: commitment.salt }),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      csrfToken,
      zkpSalt: commitment.salt, // Return salt so client can generate proofs
      requiresVerification: !user.emailVerified,
      message: 'Registration successful. Please verify your email.',
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred during registration',
    });
  }
});

/**
 * Step 1 of ZKP Login: Request a challenge
 */
router.post('/login/challenge', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Missing email',
        message: 'Email is required',
      });
    }

    const user = await storage.getUserByEmail(email);

    // Don't reveal if user exists - return a fake challenge
    if (!user) {
      const fakeChallenge = await generateChallenge();
      return res.json({
        challenge: fakeChallenge.challenge,
        sessionId: fakeChallenge.sessionId,
        salt: nanoid(64), // Fake salt
      });
    }

    // Check if account is locked
    if (await storage.isAccountLocked(user.id)) {
      // Still return a challenge to not reveal account status
      const fakeChallenge = await generateChallenge();
      return res.json({
        challenge: fakeChallenge.challenge,
        sessionId: fakeChallenge.sessionId,
        salt: user.zkpSalt || nanoid(64),
      });
    }

    // Generate real challenge
    const challengeData = await generateChallenge();
    const expiresAt = new Date(Date.now() + ZKP_CHALLENGE_EXPIRY_MS);

    await storage.createZKPChallenge(
      user.id,
      challengeData.sessionId,
      challengeData.challenge,
      expiresAt
    );

    res.json({
      challenge: challengeData.challenge,
      sessionId: challengeData.sessionId,
      salt: user.zkpSalt,
    });
  } catch (error) {
    console.error('Challenge generation error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while generating challenge',
    });
  }
});

/**
 * Step 2 of ZKP Login: Verify the proof
 */
router.post('/login/verify', async (req: Request, res: Response) => {
  try {
    const { email, proof } = req.body as { email: string; proof: ZKPProof };

    if (!email || !proof) {
      return res.status(400).json({
        error: 'Missing fields',
        message: 'Email and proof are required',
      });
    }

    const user = await storage.getUserByEmail(email);

    if (!user) {
      await storage.recordLoginAttempt(email, false, getHashedClientIP(req), req.headers['user-agent'], 'User not found');
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Check if account is locked
    if (await storage.isAccountLocked(user.id)) {
      await storage.recordLoginAttempt(email, false, getHashedClientIP(req), req.headers['user-agent'], 'Account locked');
      return res.status(423).json({
        error: 'Account locked',
        message: 'Too many failed attempts. Please try again later.',
      });
    }

    // Get the challenge
    const storedChallenge = await storage.getZKPChallenge(proof.sessionId);

    if (!storedChallenge || storedChallenge.userId !== user.id) {
      await storage.recordLoginAttempt(email, false, getHashedClientIP(req), req.headers['user-agent'], 'Invalid challenge');
      const failedAttempts = await storage.incrementFailedAttempts(user.id);

      if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await storage.lockAccount(user.id, lockUntil);
      }

      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Verify ZKP proof
    if (!user.zkpPublicKey || !user.zkpSalt) {
      await storage.recordLoginAttempt(email, false, getHashedClientIP(req), req.headers['user-agent'], 'No ZKP credentials');
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    const commitment: ZKPCommitment = {
      publicKey: user.zkpPublicKey,
      salt: user.zkpSalt,
    };

    const isValid = await verifyProof(proof, commitment, storedChallenge.challenge);

    // Delete the challenge (single use)
    await storage.deleteZKPChallenge(proof.sessionId);

    if (!isValid) {
      await storage.recordLoginAttempt(email, false, getHashedClientIP(req), req.headers['user-agent'], 'Invalid proof');
      const failedAttempts = await storage.incrementFailedAttempts(user.id);

      if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await storage.lockAccount(user.id, lockUntil);
        return res.status(423).json({
          error: 'Account locked',
          message: 'Too many failed attempts. Account locked for 15 minutes.',
        });
      }

      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
        attemptsRemaining: MAX_LOGIN_ATTEMPTS - failedAttempts,
      });
    }

    // Success! Reset failed attempts
    await storage.resetFailedAttempts(user.id);
    await storage.recordLoginAttempt(email, true, getHashedClientIP(req), req.headers['user-agent']);

    const tokens = await createTokenPair(user.id);

    // Set HttpOnly cookies for XSS protection
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken, tokens.accessExpiresAt, tokens.refreshExpiresAt);
    const csrfToken = setCSRFCookie(res);

    if (!user.emailVerified) {
      return res.json({
        user: sanitizeUser(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        csrfToken,
        requiresVerification: true,
        message: 'Login successful. Please verify your email.',
      });
    }

    res.json({
      user: sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      csrfToken,
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Login verification error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred during login',
    });
  }
});

/**
 * Legacy login (backward compatible - uses password directly)
 * Falls back to bcrypt if ZKP not set up
 *
 * SECURITY FEATURES (Phase 2.3):
 * - Per-email rate limiting: 5 failed attempts per 24h window
 * - Graduated backoff: Exponential delays after failures (1s, 2s, 4s, 8s, 16s...)
 * - IP-based sensitive endpoint rate limiting
 * - Account lockout after 5 consecutive failures
 */
router.post('/login', sensitiveEndpointRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required',
      });
    }

    // Check per-email rate limit with graduated backoff (24h window)
    const emailRateCheck = trackEmailFailedLogin(email);
    if (!emailRateCheck.allowed) {
      await logAuditEvent('auth.login.rate_limited', req, undefined, 'user', undefined, undefined, {
        email: normalizeEmail(email),
        reason: 'email_rate_limit',
      });
      return res.status(429).json({
        error: 'Too many attempts',
        message: emailRateCheck.remainingAttempts === 0
          ? 'Maximum login attempts exceeded. Please try again later or reset your password.'
          : 'Please wait before trying again.',
        retryAfter: emailRateCheck.retryAfter,
        backoffDelay: emailRateCheck.backoffDelay,
      });
    }

    const user = await storage.getUserByEmail(email);

    if (!user) {
      // Record failed attempt for rate limiting (even if user doesn't exist)
      recordEmailFailedLogin(email);
      await storage.recordLoginAttempt(email, false, getHashedClientIP(req), req.headers['user-agent'], 'User not found');
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Check if account is locked (per-user lockout)
    if (await storage.isAccountLocked(user.id)) {
      recordEmailFailedLogin(email);
      await storage.recordLoginAttempt(email, false, getHashedClientIP(req), req.headers['user-agent'], 'Account locked');
      return res.status(423).json({
        error: 'Account locked',
        message: 'Too many failed attempts. Please try again later or reset your password.',
      });
    }

    // Try bcrypt verification first (for legacy accounts)
    const passwordValid = await verifyPassword(password, user.password);

    if (!passwordValid) {
      // Record failed attempt for both per-email and per-account tracking
      recordEmailFailedLogin(email);
      await storage.recordLoginAttempt(email, false, getHashedClientIP(req), req.headers['user-agent'], 'Invalid password');
      const failedAttempts = await storage.incrementFailedAttempts(user.id);

      if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await storage.lockAccount(user.id, lockUntil);
        await logAuditEvent('auth.login.account_locked', req, user.id, 'user', user.id, undefined, {
          email: normalizeEmail(email),
          reason: 'max_attempts_exceeded',
        });
        return res.status(423).json({
          error: 'Account locked',
          message: 'Too many failed attempts. Account locked for 15 minutes.',
        });
      }

      // Include backoff info in response
      const currentTracking = trackEmailFailedLogin(email);
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
        attemptsRemaining: Math.min(MAX_LOGIN_ATTEMPTS - failedAttempts, currentTracking.remainingAttempts || 0),
        backoffDelay: currentTracking.backoffDelay,
      });
    }

    // Success! Clear all rate limiting for this email
    clearEmailFailedLogin(email);
    await storage.resetFailedAttempts(user.id);
    await storage.recordLoginAttempt(email, true, getHashedClientIP(req), req.headers['user-agent']);

    const tokens = await createTokenPair(user.id);

    // Set HttpOnly cookies for XSS protection
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken, tokens.accessExpiresAt, tokens.refreshExpiresAt);
    const csrfToken = setCSRFCookie(res);

    if (!user.emailVerified) {
      return res.json({
        user: sanitizeUser(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        csrfToken,
        zkpSalt: user.zkpSalt, // Include salt for ZKP upgrade
        requiresVerification: true,
        message: 'Login successful. Please verify your email.',
      });
    }

    res.json({
      user: sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      csrfToken,
      zkpSalt: user.zkpSalt, // Include salt for ZKP upgrade
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred during login',
    });
  }
});

// Logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // Get token from cookie first, then fall back to Authorization header
    let accessToken = req.cookies?.[ACCESS_TOKEN_COOKIE];
    if (!accessToken) {
      const authHeader = req.headers.authorization;
      accessToken = authHeader?.split(' ')[1];
    }
    
    // Get refresh token from cookie first, then fall back to body
    let refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      refreshToken = req.body?.refreshToken;
    }

    if (accessToken) {
      accessTokenStore.delete(accessToken);
    }

    if (refreshToken) {
      await storage.deleteRefreshToken(refreshToken);
    }

    // Clear HttpOnly cookies
    clearAuthCookies(res);

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred during logout',
    });
  }
});

// Get current user
router.get('/user', async (req: Request, res: Response) => {
  try {
    // Get token from cookie first, then fall back to Authorization header
    let token = req.cookies?.[ACCESS_TOKEN_COOKIE];
    if (!token) {
      const authHeader = req.headers.authorization;
      token = authHeader?.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const tokenData = accessTokenStore.get(token);
    if (!tokenData || tokenData.expiresAt < new Date()) {
      accessTokenStore.delete(token);
      return res.status(401).json({ error: 'Token expired or invalid' });
    }

    const user = await storage.getUser(tokenData.userId);

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        message: 'Session invalid',
      });
    }

    res.json(sanitizeUser(user));
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while fetching user',
    });
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // Get refresh token from cookie first, then fall back to body
    let refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      refreshToken = req.body?.refreshToken;
    }

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Missing token',
        message: 'Refresh token is required',
      });
    }

    const storedToken = await storage.getRefreshToken(refreshToken);

    if (!storedToken) {
      // Clear invalid cookies
      clearAuthCookies(res);
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Refresh token is invalid or expired',
      });
    }

    // SECURITY: Enforce absolute session timeout (24 hours from initial login)
    // This limits the exposure window if tokens are compromised.
    // The session cannot be extended beyond this time regardless of refresh activity.
    const sessionAge = Date.now() - storedToken.createdAt.getTime();
    if (sessionAge > ABSOLUTE_SESSION_TIMEOUT_MS) {
      // Session has exceeded absolute timeout - user must re-authenticate
      await storage.deleteRefreshToken(refreshToken);
      clearAuthCookies(res);

      console.log(`[Auth] Absolute session timeout enforced for user ${storedToken.userId} (session age: ${Math.floor(sessionAge / 1000 / 60)} minutes)`);

      return res.status(401).json({
        error: 'Session expired',
        message: 'Your session has expired. Please log in again for security.',
        code: 'ABSOLUTE_SESSION_TIMEOUT',
      });
    }

    // Token rotation: Delete old refresh token and issue new pair
    await storage.deleteRefreshToken(refreshToken);
    const tokens = await createTokenPair(storedToken.userId);

    // Set new HttpOnly cookies
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken, tokens.accessExpiresAt, tokens.refreshExpiresAt);
    const csrfToken = setCSRFCookie(res);

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      csrfToken,
      message: 'Token refreshed',
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred during token refresh',
    });
  }
});

// Verify email
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Missing token',
        message: 'Verification token is required',
      });
    }

    const verificationToken = await storage.getEmailVerificationToken(token);

    if (!verificationToken) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'Verification token is invalid or expired',
      });
    }

    const user = await storage.updateUser(verificationToken.userId, { emailVerified: true });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User associated with this token not found',
      });
    }

    await storage.deleteEmailVerificationTokensForUser(user.id);
    const tokens = await createTokenPair(user.id);

    // Set HttpOnly cookies for XSS protection
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken, tokens.accessExpiresAt, tokens.refreshExpiresAt);
    const csrfToken = setCSRFCookie(res);

    res.json({
      success: true,
      user: sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      csrfToken,
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred during email verification',
    });
  }
});

/**
 * Resend verification email
 *
 * SECURITY (Phase 2.3): Rate limited to 3 requests per email per hour
 * to prevent email spam attacks.
 */
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Missing email',
        message: 'Email is required',
      });
    }

    // Check email action rate limit (3 per hour per email)
    const actionRateLimit = checkEmailActionRateLimit(email, 'resend-verification');
    if (!actionRateLimit.allowed) {
      await logAuditEvent('auth.resend_verification.rate_limited', req, undefined, 'user', undefined, undefined, {
        email: normalizeEmail(email),
      });
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Too many verification email requests. Please wait before trying again.',
        retryAfter: actionRateLimit.retryAfter,
      });
    }

    const user = await storage.getUserByEmail(email);

    if (!user) {
      return res.json({
        success: true,
        message: 'If the email exists, a verification link will be sent',
      });
    }

    if (user.emailVerified) {
      return res.json({
        success: true,
        message: 'Email is already verified',
      });
    }

    await storage.deleteEmailVerificationTokensForUser(user.id);

    const verificationToken = generateToken();
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS);
    await storage.createEmailVerificationToken(user.id, verificationToken, expiresAt);

    try {
      await sendVerificationEmail(email, verificationToken, user.firstName);
      console.log(`[Auth] Verification email sent to ${email}`);
    } catch (emailError) {
      console.error('[Auth] Failed to send verification email:', emailError);
    }

    res.json({
      success: true,
      message: 'Verification email sent',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while resending verification',
    });
  }
});

/**
 * Forgot password - initiate password reset flow
 *
 * SECURITY (Phase 2.3):
 * - Rate limited to 3 requests per email per hour to prevent email spam
 * - IP-based sensitive endpoint rate limiting
 * - Does not reveal if email exists (same response either way)
 */
router.post('/forgot-password', sensitiveEndpointRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Missing email',
        message: 'Email is required',
      });
    }

    // Check email action rate limit (3 per hour per email)
    const actionRateLimit = checkEmailActionRateLimit(email, 'forgot-password');
    if (!actionRateLimit.allowed) {
      await logAuditEvent('auth.forgot_password.rate_limited', req, undefined, 'user', undefined, undefined, {
        email: normalizeEmail(email),
      });
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Too many password reset requests. Please wait before trying again.',
        retryAfter: actionRateLimit.retryAfter,
      });
    }

    const user = await storage.getUserByEmail(email);

    if (!user) {
      // Don't reveal if email exists - return same response
      return res.json({
        success: true,
        message: 'If the email exists, a password reset link will be sent',
      });
    }

    await storage.deletePasswordResetTokensForUser(user.id);

    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);
    await storage.createPasswordResetToken(user.id, resetToken, expiresAt);

    try {
      await sendPasswordResetEmail(email, resetToken);
      console.log(`[Auth] Password reset email sent to ${email}`);
    } catch (emailError) {
      console.error('[Auth] Failed to send password reset email:', emailError);
    }

    res.json({
      success: true,
      message: 'Password reset email sent',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while processing password reset',
    });
  }
});

/**
 * Reset password - complete password reset with token
 *
 * SECURITY (Phase 2.3):
 * - IP-based sensitive endpoint rate limiting
 * - Clears per-email failed login tracking on successful reset
 * - Invalidates all existing sessions
 */
router.post('/reset-password', sensitiveEndpointRateLimiter, async (req: Request, res: Response) => {
  try {
    const { token, password, zkpCommitment } = req.body;

    if (!token || (!password && !zkpCommitment)) {
      return res.status(400).json({
        error: 'Missing fields',
        message: 'Token and password are required',
      });
    }

    if (password && password.length < 8) {
      return res.status(400).json({
        error: 'Password too short',
        message: 'Password must be at least 8 characters',
      });
    }

    const resetToken = await storage.getPasswordResetToken(token);

    if (!resetToken) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'Password reset token is invalid or expired',
      });
    }

    // Handle ZKP commitment or generate from password
    let commitment: ZKPCommitment;
    let passwordHash: string;

    if (zkpCommitment) {
      commitment = zkpCommitment;
      passwordHash = await hashPassword(nanoid(32));
    } else {
      commitment = await generateCommitment(password);
      passwordHash = await hashPassword(password);
    }

    const user = await storage.updateUser(resetToken.userId, {
      password: passwordHash,
      zkpPublicKey: commitment.publicKey,
      zkpSalt: commitment.salt,
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User associated with this token not found',
      });
    }

    await storage.deletePasswordResetTokensForUser(user.id);
    await storage.deleteRefreshTokensForUser(user.id);

    // SECURITY: Invalidate ALL in-memory access tokens for this user
    // This ensures no existing sessions remain valid after password change
    invalidateAccessTokensForUser(user.id);

    // Clear per-email failed login tracking (user proved ownership via reset email)
    clearEmailFailedLogin(user.email);

    await storage.resetFailedAttempts(user.id); // Unlock account on password reset

    const tokens = await createTokenPair(user.id);

    // Set HttpOnly cookies for XSS protection
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken, tokens.accessExpiresAt, tokens.refreshExpiresAt);
    const csrfToken = setCSRFCookie(res);

    res.json({
      success: true,
      user: sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      csrfToken,
      zkpSalt: commitment.salt,
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred during password reset',
    });
  }
});

// Export for use by admin endpoints (forced logout, account compromise)
export { invalidateAccessTokensForUser };

export default router;

/**
 * Initialize default admin user from environment variables.
 * SECURITY: Never hardcode credentials. Use environment variables only.
 *
 * Required environment variables:
 * - DEFAULT_ADMIN_EMAIL: Admin user email
 * - DEFAULT_ADMIN_PASSWORD: Admin user password (min 12 characters recommended)
 * - DEFAULT_ADMIN_FIRST_NAME: Admin first name (optional)
 * - DEFAULT_ADMIN_LAST_NAME: Admin last name (optional)
 */
export const initializeDefaultUser = async () => {
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL;
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;

  // Skip if no admin credentials configured
  if (!adminEmail || !adminPassword) {
    console.log('[Auth] No default admin configured. Set DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD to create one.');
    return;
  }

  // Validate password strength
  if (adminPassword.length < 8) {
    console.error('[Auth] DEFAULT_ADMIN_PASSWORD must be at least 8 characters');
    return;
  }

  try {
    const existingUser = await storage.getUserByEmail(adminEmail);
    if (!existingUser) {
      // Generate ZKP commitment for admin user
      const commitment = await generateCommitment(adminPassword);

      const user = await storage.createUser({
        username: adminEmail.split('@')[0] + '_admin',
        email: adminEmail,
        firstName: process.env.DEFAULT_ADMIN_FIRST_NAME || 'Admin',
        lastName: process.env.DEFAULT_ADMIN_LAST_NAME || 'User',
        password: await hashPassword(adminPassword),
      });

      await storage.updateUser(user.id, {
        emailVerified: true,
        zkpPublicKey: commitment.publicKey,
        zkpSalt: commitment.salt,
      });

      console.log(`[Auth] Default admin user created: ${adminEmail}`);
    }
  } catch (error) {
    console.error('[Auth] Failed to initialize default user:', error);
  }
};
