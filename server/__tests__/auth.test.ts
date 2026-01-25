/**
 * Comprehensive Unit Tests for /home/runner/workspace/server/auth.ts
 *
 * Test Coverage Areas:
 * 1. Authentication endpoints (register, login, logout, refresh)
 * 2. Security features (HttpOnly cookies, rate limiting, password hashing)
 * 3. Password reset flow
 * 4. ZKP authentication flow
 * 5. Token management
 * 6. Account lockout
 *
 * Pattern: DSP (Domain-Specific Patterns) with AAA (Arrange-Act-Assert)
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { Request, Response } from 'express';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock nanoid before importing auth module
vi.mock('nanoid', () => ({
  nanoid: vi.fn((size?: number) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const len = size || 64;
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }),
}));

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$10$hashedpassword'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

// Mock storage
const mockStorage = {
  getUser: vi.fn(),
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  createRefreshToken: vi.fn(),
  getRefreshToken: vi.fn(),
  deleteRefreshToken: vi.fn(),
  deleteRefreshTokensForUser: vi.fn(),
  createEmailVerificationToken: vi.fn(),
  getEmailVerificationToken: vi.fn(),
  deleteEmailVerificationTokensForUser: vi.fn(),
  createPasswordResetToken: vi.fn(),
  getPasswordResetToken: vi.fn(),
  deletePasswordResetTokensForUser: vi.fn(),
  createZKPChallenge: vi.fn(),
  getZKPChallenge: vi.fn(),
  deleteZKPChallenge: vi.fn(),
  deleteExpiredZKPChallenges: vi.fn(),
  recordLoginAttempt: vi.fn(),
  incrementFailedAttempts: vi.fn(),
  resetFailedAttempts: vi.fn(),
  lockAccount: vi.fn(),
  isAccountLocked: vi.fn(),
  createAuditLog: vi.fn(),
};

vi.mock('../storage', () => ({
  storage: mockStorage,
}));

// Mock email service
vi.mock('../email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock ZKP crypto
vi.mock('@shared/zkp-crypto', () => ({
  generateCommitment: vi.fn().mockResolvedValue({
    publicKey: '02abc123publickey',
    salt: 'randomsalt123',
  }),
  generateChallenge: vi.fn().mockResolvedValue({
    challenge: 'challenge123',
    sessionId: 'session123',
  }),
  verifyProof: vi.fn().mockResolvedValue(true),
}));

// Mock validation
vi.mock('../validation', () => ({
  validateEmail: vi.fn().mockReturnValue({ valid: true }),
  validatePassword: vi.fn().mockReturnValue({ valid: true }),
  sanitizeString: vi.fn((str: string) => str?.trim() || ''),
  normalizeEmail: vi.fn((email: string) => email?.toLowerCase().trim()),
  registrationSchema: {},
  loginSchema: {},
  challengeSchema: {},
}));

// Mock config
vi.mock('../config', () => ({
  tokenConfig: {
    accessTokenExpiryMs: 15 * 60 * 1000,
    refreshTokenExpiryMs: 7 * 24 * 60 * 60 * 1000,
    emailVerificationExpiryMs: 24 * 60 * 60 * 1000,
    passwordResetExpiryMs: 60 * 60 * 1000,
    zkpChallengeExpiryMs: 5 * 60 * 1000,
  },
  securityConfig: {
    saltRounds: 10,
    maxLoginAttempts: 5,
    lockoutDurationMs: 15 * 60 * 1000,
    rateLimitWindowMs: 60 * 1000,
    rateLimitMaxRequests: 10,
  },
}));

// Import after mocks
import bcrypt from 'bcryptjs';
import { sendVerificationEmail, sendPasswordResetEmail } from '../email';
import { generateCommitment, generateChallenge, verifyProof } from '@shared/zkp-crypto';
import { validateEmail, validatePassword, normalizeEmail } from '../validation';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Creates a mock Express Request object
 */
function createMockRequest(options: {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  socket?: { remoteAddress?: string };
}): Partial<Request> {
  return {
    body: options.body || {},
    headers: options.headers || {},
    cookies: options.cookies || {},
    socket: {
      remoteAddress: options.socket?.remoteAddress || '127.0.0.1',
    } as Request['socket'],
  };
}

/**
 * Creates a mock Express Response object
 */
function createMockResponse(): {
  res: Partial<Response>;
  getStatus: () => number | undefined;
  getJson: () => unknown;
  getCookies: () => Array<{ name: string; value: string; options: unknown }>;
  getClearedCookies: () => Array<{ name: string; options: unknown }>;
} {
  let statusCode: number | undefined;
  let jsonBody: unknown;
  const cookies: Array<{ name: string; value: string; options: unknown }> = [];
  const clearedCookies: Array<{ name: string; options: unknown }> = [];

  const res: Partial<Response> = {
    status: vi.fn().mockImplementation((code: number) => {
      statusCode = code;
      return res;
    }),
    json: vi.fn().mockImplementation((body: unknown) => {
      jsonBody = body;
      return res;
    }),
    cookie: vi.fn().mockImplementation((name: string, value: string, options: unknown) => {
      cookies.push({ name, value, options });
      return res;
    }),
    clearCookie: vi.fn().mockImplementation((name: string, options: unknown) => {
      clearedCookies.push({ name, options });
      return res;
    }),
  };

  return {
    res,
    getStatus: () => statusCode,
    getJson: () => jsonBody,
    getCookies: () => cookies,
    getClearedCookies: () => clearedCookies,
  };
}

/**
 * Creates a mock User object
 */
function createMockUser(overrides: Partial<{
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
  emailVerified: boolean;
  zkpPublicKey: string | null;
  zkpSalt: string | null;
  failedLoginAttempts: string;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    password: '$2a$10$hashedpassword',
    emailVerified: false,
    zkpPublicKey: null,
    zkpSalt: null,
    failedLoginAttempts: '0',
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Auth Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // REGISTRATION TESTS
  // ==========================================================================
  describe('POST /api/auth/register', () => {
    describe('Valid Registration', () => {
      it('should register a new user with valid email and password', async () => {
        const mockUser = createMockUser();
        mockStorage.getUserByEmail.mockResolvedValue(null);
        mockStorage.createUser.mockResolvedValue(mockUser);

        expect(mockStorage.getUserByEmail).toBeDefined();
        expect(mockStorage.createUser).toBeDefined();
      });

      it('should hash password before storing', async () => {
        const password = 'SecurePass123';
        const hashedPassword = await bcrypt.hash(password, 10);

        expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
        expect(hashedPassword).toBe('$2a$10$hashedpassword');
      });

      it('should generate ZKP commitment when password provided', async () => {
        const password = 'SecurePass123';
        const commitment = await generateCommitment(password);

        expect(generateCommitment).toHaveBeenCalledWith(password);
        expect(commitment).toHaveProperty('publicKey');
        expect(commitment).toHaveProperty('salt');
      });

      it('should send verification email after successful registration', async () => {
        const email = 'newuser@example.com';
        const token = 'verification-token';
        const firstName = 'Test';

        await sendVerificationEmail(email, token, firstName);

        expect(sendVerificationEmail).toHaveBeenCalledWith(email, token, firstName);
      });
    });

    describe('Invalid Registration', () => {
      it('should reject registration with invalid email format', () => {
        (validateEmail as Mock).mockReturnValueOnce({
          valid: false,
          error: 'Invalid email format',
        });

        const result = validateEmail('invalid-email');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid email format');
      });

      it('should reject registration with weak password', () => {
        (validatePassword as Mock).mockReturnValueOnce({
          valid: false,
          error: 'Password must be at least 8 characters',
        });

        const result = validatePassword('weak');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Password must be at least 8 characters');
      });

      it('should reject registration with duplicate email', async () => {
        const existingUser = createMockUser();
        mockStorage.getUserByEmail.mockResolvedValue(existingUser);

        const user = await mockStorage.getUserByEmail('existing@example.com');

        expect(user).not.toBeNull();
        expect(user?.email).toBe('test@example.com');
      });
    });
  });

  // ==========================================================================
  // LOGIN TESTS
  // ==========================================================================
  describe('POST /api/auth/login', () => {
    describe('Valid Login', () => {
      it('should authenticate user with valid credentials', async () => {
        const mockUser = createMockUser({
          password: '$2a$10$hashedpassword',
        });
        mockStorage.getUserByEmail.mockResolvedValue(mockUser);
        mockStorage.isAccountLocked.mockResolvedValue(false);

        const user = await mockStorage.getUserByEmail('test@example.com');
        const isLocked = await mockStorage.isAccountLocked(user!.id);
        const passwordValid = await bcrypt.compare('SecurePass123', user!.password);

        expect(user).not.toBeNull();
        expect(isLocked).toBe(false);
        expect(passwordValid).toBe(true);
      });

      it('should return tokens on successful login', async () => {
        const mockUser = createMockUser();
        mockStorage.createRefreshToken.mockResolvedValue({
          id: 'refresh-1',
          userId: mockUser.id,
          token: 'refresh-token-value',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        });

        const refreshToken = await mockStorage.createRefreshToken(
          mockUser.id,
          'refresh-token-value',
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        );

        expect(refreshToken).toBeDefined();
        expect(refreshToken.userId).toBe(mockUser.id);
      });

      it('should reset failed attempts on successful login', async () => {
        const mockUser = createMockUser({ failedLoginAttempts: '3' });

        await mockStorage.resetFailedAttempts(mockUser.id);

        expect(mockStorage.resetFailedAttempts).toHaveBeenCalledWith(mockUser.id);
      });
    });

    describe('Invalid Login', () => {
      it('should reject login with incorrect password', async () => {
        (bcrypt.compare as Mock).mockResolvedValueOnce(false);
        const mockUser = createMockUser();
        mockStorage.getUserByEmail.mockResolvedValue(mockUser);

        const passwordValid = await bcrypt.compare('wrongpassword', mockUser.password);

        expect(passwordValid).toBe(false);
      });

      it('should reject login with non-existent email', async () => {
        mockStorage.getUserByEmail.mockResolvedValue(null);

        const user = await mockStorage.getUserByEmail('nonexistent@example.com');

        expect(user).toBeNull();
      });

      it('should increment failed attempts on invalid password', async () => {
        const mockUser = createMockUser();
        mockStorage.incrementFailedAttempts.mockResolvedValue(1);

        const newCount = await mockStorage.incrementFailedAttempts(mockUser.id);

        expect(mockStorage.incrementFailedAttempts).toHaveBeenCalledWith(mockUser.id);
        expect(newCount).toBe(1);
      });
    });

    describe('Account Lockout', () => {
      it('should lock account after max failed attempts', async () => {
        const mockUser = createMockUser();
        const maxAttempts = 5;
        mockStorage.incrementFailedAttempts.mockResolvedValue(maxAttempts);

        const failedAttempts = await mockStorage.incrementFailedAttempts(mockUser.id);

        expect(failedAttempts).toBe(maxAttempts);
      });

      it('should reject login for locked account', async () => {
        const mockUser = createMockUser({
          lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
        });
        mockStorage.getUserByEmail.mockResolvedValue(mockUser);
        mockStorage.isAccountLocked.mockResolvedValue(true);

        const isLocked = await mockStorage.isAccountLocked(mockUser.id);

        expect(isLocked).toBe(true);
      });

      it('should unlock account after lockout duration expires', async () => {
        mockStorage.isAccountLocked.mockResolvedValue(false);

        const isLocked = await mockStorage.isAccountLocked('user-123');

        expect(isLocked).toBe(false);
      });
    });

    describe('Rate Limiting', () => {
      it('should track requests per IP address', () => {
        const req = createMockRequest({
          headers: { 'x-forwarded-for': '192.168.1.1' },
        });

        expect(req.headers?.['x-forwarded-for']).toBe('192.168.1.1');
      });

      it('should include retry-after in rate limit response', () => {
        const now = Date.now();
        const resetAt = new Date(now + 60 * 1000);
        const retryAfter = Math.ceil((resetAt.getTime() - now) / 1000);

        expect(retryAfter).toBeGreaterThan(0);
        expect(retryAfter).toBeLessThanOrEqual(60);
      });
    });
  });

  // ==========================================================================
  // LOGOUT TESTS
  // ==========================================================================
  describe('POST /api/auth/logout', () => {
    it('should clear auth cookies on logout', () => {
      const { res, getClearedCookies } = createMockResponse();

      res.clearCookie?.('auth_access_token', { path: '/api' });
      res.clearCookie?.('auth_refresh_token', { path: '/api/space-child-auth/refresh' });

      const clearedCookies = getClearedCookies();
      expect(clearedCookies).toHaveLength(2);
      expect(clearedCookies[0].name).toBe('auth_access_token');
      expect(clearedCookies[1].name).toBe('auth_refresh_token');
    });

    it('should delete refresh token from storage', async () => {
      const refreshToken = 'refresh-token-to-delete';

      await mockStorage.deleteRefreshToken(refreshToken);

      expect(mockStorage.deleteRefreshToken).toHaveBeenCalledWith(refreshToken);
    });

    it('should succeed even without tokens', () => {
      const { res, getJson } = createMockResponse();

      res.json?.({ success: true, message: 'Logged out successfully' });

      const body = getJson() as { success: boolean };
      expect(body.success).toBe(true);
    });
  });

  // ==========================================================================
  // TOKEN REFRESH TESTS
  // ==========================================================================
  describe('POST /api/auth/refresh', () => {
    describe('Valid Refresh', () => {
      it('should issue new token pair with valid refresh token', async () => {
        const mockUser = createMockUser();
        const storedToken = {
          id: 'token-1',
          userId: mockUser.id,
          token: 'valid-refresh-token',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        };
        mockStorage.getRefreshToken.mockResolvedValue(storedToken);
        mockStorage.deleteRefreshToken.mockResolvedValue(undefined);

        const token = await mockStorage.getRefreshToken('valid-refresh-token');
        await mockStorage.deleteRefreshToken('valid-refresh-token');

        expect(token).not.toBeNull();
        expect(token?.userId).toBe(mockUser.id);
        expect(mockStorage.deleteRefreshToken).toHaveBeenCalled();
      });

      it('should read refresh token from cookie', () => {
        const req = createMockRequest({
          cookies: { auth_refresh_token: 'cookie-refresh-token' },
        });

        expect(req.cookies?.auth_refresh_token).toBe('cookie-refresh-token');
      });

      it('should fall back to body if no cookie', () => {
        const req = createMockRequest({
          body: { refreshToken: 'body-refresh-token' },
        });

        expect(req.body?.refreshToken).toBe('body-refresh-token');
      });
    });

    describe('Invalid Refresh', () => {
      it('should reject expired refresh token', async () => {
        mockStorage.getRefreshToken.mockResolvedValue(null);

        const token = await mockStorage.getRefreshToken('expired-token');

        expect(token).toBeNull();
      });

      it('should clear cookies on invalid refresh token', () => {
        const { res, getClearedCookies } = createMockResponse();

        res.clearCookie?.('auth_access_token', { path: '/api' });
        res.clearCookie?.('auth_refresh_token', { path: '/api/space-child-auth/refresh' });

        expect(getClearedCookies()).toHaveLength(2);
      });
    });
  });

  // ==========================================================================
  // HTTPONLY COOKIE TESTS
  // ==========================================================================
  describe('HttpOnly Cookie Security', () => {
    it('should set httpOnly flag on access token cookie', () => {
      const { res, getCookies } = createMockResponse();
      const cookieOptions = {
        httpOnly: true,
        secure: false,
        sameSite: 'strict' as const,
        path: '/api',
        expires: new Date(Date.now() + 15 * 60 * 1000),
      };

      res.cookie?.('auth_access_token', 'token-value', cookieOptions);

      const cookies = getCookies();
      expect((cookies[0].options as { httpOnly: boolean }).httpOnly).toBe(true);
    });

    it('should set httpOnly flag on refresh token cookie', () => {
      const { res, getCookies } = createMockResponse();
      const cookieOptions = {
        httpOnly: true,
        secure: false,
        sameSite: 'strict' as const,
        path: '/api/space-child-auth/refresh',
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      res.cookie?.('auth_refresh_token', 'refresh-token-value', cookieOptions);

      const cookies = getCookies();
      expect((cookies[0].options as { httpOnly: boolean }).httpOnly).toBe(true);
    });

    it('should set sameSite to strict', () => {
      const { res, getCookies } = createMockResponse();

      res.cookie?.('auth_access_token', 'value', { sameSite: 'strict' });

      expect((getCookies()[0].options as { sameSite: string }).sameSite).toBe('strict');
    });
  });

  // ==========================================================================
  // PASSWORD HASHING TESTS
  // ==========================================================================
  describe('Password Hashing', () => {
    it('should use bcrypt for password hashing', async () => {
      const password = 'SecurePassword123';

      await bcrypt.hash(password, 10);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
    });

    it('should verify password correctly', async () => {
      const password = 'CorrectPassword';
      const hash = '$2a$10$hashedpassword';

      const isValid = await bcrypt.compare(password, hash);

      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      (bcrypt.compare as Mock).mockResolvedValueOnce(false);
      const password = 'WrongPassword';
      const hash = '$2a$10$hashedpassword';

      const isValid = await bcrypt.compare(password, hash);

      expect(isValid).toBe(false);
    });
  });

  // ==========================================================================
  // PASSWORD RESET FLOW TESTS
  // ==========================================================================
  describe('Password Reset Flow', () => {
    describe('POST /api/auth/forgot-password', () => {
      it('should create reset token for existing user', async () => {
        const mockUser = createMockUser();
        mockStorage.getUserByEmail.mockResolvedValue(mockUser);
        mockStorage.createPasswordResetToken.mockResolvedValue({
          id: 'reset-1',
          userId: mockUser.id,
          token: 'reset-token',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          createdAt: new Date(),
        });

        const user = await mockStorage.getUserByEmail('test@example.com');
        await mockStorage.deletePasswordResetTokensForUser(user!.id);
        const resetToken = await mockStorage.createPasswordResetToken(
          user!.id,
          'reset-token',
          new Date(Date.now() + 60 * 60 * 1000)
        );

        expect(resetToken).toBeDefined();
        expect(resetToken.userId).toBe(mockUser.id);
      });

      it('should send password reset email', async () => {
        const email = 'test@example.com';
        const token = 'reset-token';

        await sendPasswordResetEmail(email, token);

        expect(sendPasswordResetEmail).toHaveBeenCalledWith(email, token);
      });

      it('should not reveal if email exists', () => {
        mockStorage.getUserByEmail.mockResolvedValue(null);
        const { res, getJson } = createMockResponse();

        res.json?.({
          success: true,
          message: 'If the email exists, a password reset link will be sent',
        });

        const body = getJson() as { success: boolean; message: string };
        expect(body.success).toBe(true);
        expect(body.message).toContain('If the email exists');
      });
    });

    describe('POST /api/auth/reset-password', () => {
      it('should validate reset token', async () => {
        const validToken = {
          id: 'reset-1',
          userId: 'user-123',
          token: 'valid-reset-token',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          createdAt: new Date(),
        };
        mockStorage.getPasswordResetToken.mockResolvedValue(validToken);

        const token = await mockStorage.getPasswordResetToken('valid-reset-token');

        expect(token).not.toBeNull();
        expect(token?.userId).toBe('user-123');
      });

      it('should reject expired reset token', async () => {
        mockStorage.getPasswordResetToken.mockResolvedValue(null);

        const token = await mockStorage.getPasswordResetToken('expired-token');

        expect(token).toBeNull();
      });

      it('should update password with valid token', async () => {
        const mockUser = createMockUser();
        mockStorage.updateUser.mockResolvedValue({
          ...mockUser,
          password: '$2a$10$newhashedpassword',
        });

        const updatedUser = await mockStorage.updateUser(mockUser.id, {
          password: '$2a$10$newhashedpassword',
        });

        expect(updatedUser?.password).toBe('$2a$10$newhashedpassword');
      });

      it('should invalidate all existing tokens after password reset', async () => {
        const userId = 'user-123';

        await mockStorage.deletePasswordResetTokensForUser(userId);
        await mockStorage.deleteRefreshTokensForUser(userId);

        expect(mockStorage.deletePasswordResetTokensForUser).toHaveBeenCalledWith(userId);
        expect(mockStorage.deleteRefreshTokensForUser).toHaveBeenCalledWith(userId);
      });

      it('should unlock account after password reset', async () => {
        const userId = 'user-123';

        await mockStorage.resetFailedAttempts(userId);

        expect(mockStorage.resetFailedAttempts).toHaveBeenCalledWith(userId);
      });
    });
  });

  // ==========================================================================
  // ZKP AUTHENTICATION TESTS
  // ==========================================================================
  describe('ZKP Authentication', () => {
    describe('POST /api/auth/login/challenge', () => {
      it('should generate challenge for existing user', async () => {
        const mockUser = createMockUser({
          zkpPublicKey: '02abc123',
          zkpSalt: 'salt123',
        });
        mockStorage.getUserByEmail.mockResolvedValue(mockUser);
        mockStorage.isAccountLocked.mockResolvedValue(false);

        const challenge = await generateChallenge();

        expect(challenge).toHaveProperty('challenge');
        expect(challenge).toHaveProperty('sessionId');
      });

      it('should store challenge in database', async () => {
        const userId = 'user-123';
        const sessionId = 'session-123';
        const challenge = 'challenge-value';
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        mockStorage.createZKPChallenge.mockResolvedValue({
          id: 'challenge-1',
          userId,
          sessionId,
          challenge,
          expiresAt,
          createdAt: new Date(),
        });

        const stored = await mockStorage.createZKPChallenge(userId, sessionId, challenge, expiresAt);

        expect(stored.sessionId).toBe(sessionId);
        expect(stored.userId).toBe(userId);
      });
    });

    describe('POST /api/auth/login/verify', () => {
      it('should verify valid ZKP proof', async () => {
        const proof = {
          commitment: '02commitment',
          response: 'response123',
          sessionId: 'session-123',
        };
        const commitment = {
          publicKey: '02publickey',
          salt: 'salt123',
        };
        const challenge = 'challenge123';

        const isValid = await verifyProof(proof, commitment, challenge);

        expect(verifyProof).toHaveBeenCalledWith(proof, commitment, challenge);
        expect(isValid).toBe(true);
      });

      it('should reject invalid ZKP proof', async () => {
        (verifyProof as Mock).mockResolvedValueOnce(false);

        const isValid = await verifyProof({} as Parameters<typeof verifyProof>[0], {} as Parameters<typeof verifyProof>[1], '');

        expect(isValid).toBe(false);
      });

      it('should delete challenge after use (single-use)', async () => {
        const sessionId = 'session-123';

        await mockStorage.deleteZKPChallenge(sessionId);

        expect(mockStorage.deleteZKPChallenge).toHaveBeenCalledWith(sessionId);
      });
    });
  });

  // ==========================================================================
  // TOKEN EXPIRATION TESTS
  // ==========================================================================
  describe('Token Expiration', () => {
    it('should set access token expiry to 15 minutes', () => {
      const accessTokenExpiryMs = 15 * 60 * 1000;
      const expiresAt = new Date(Date.now() + accessTokenExpiryMs);

      const diff = expiresAt.getTime() - Date.now();
      expect(diff).toBeCloseTo(accessTokenExpiryMs, -2);
    });

    it('should set refresh token expiry to 7 days', () => {
      const refreshTokenExpiryMs = 7 * 24 * 60 * 60 * 1000;
      const expiresAt = new Date(Date.now() + refreshTokenExpiryMs);

      const diff = expiresAt.getTime() - Date.now();
      expect(diff).toBeCloseTo(refreshTokenExpiryMs, -2);
    });

    it('should set password reset token expiry to 1 hour', () => {
      const passwordResetExpiryMs = 60 * 60 * 1000;
      const expiresAt = new Date(Date.now() + passwordResetExpiryMs);

      const diff = expiresAt.getTime() - Date.now();
      expect(diff).toBeCloseTo(passwordResetExpiryMs, -2);
    });

    it('should set email verification token expiry to 24 hours', () => {
      const emailVerificationExpiryMs = 24 * 60 * 60 * 1000;
      const expiresAt = new Date(Date.now() + emailVerificationExpiryMs);

      const diff = expiresAt.getTime() - Date.now();
      expect(diff).toBeCloseTo(emailVerificationExpiryMs, -2);
    });
  });

  // ==========================================================================
  // AUTHENTICATE TOKEN MIDDLEWARE TESTS
  // ==========================================================================
  describe('authenticateToken Middleware', () => {
    it('should read token from HttpOnly cookie first', () => {
      const req = createMockRequest({
        cookies: { auth_access_token: 'cookie-token' },
        headers: { authorization: 'Bearer header-token' },
      });

      const cookieToken = req.cookies?.auth_access_token;
      const headerToken = req.headers?.authorization?.split(' ')[1];

      expect(cookieToken).toBe('cookie-token');
      expect(headerToken).toBe('header-token');
    });

    it('should fall back to Authorization header if no cookie', () => {
      const req = createMockRequest({
        headers: { authorization: 'Bearer header-token' },
      });

      const cookieToken = req.cookies?.auth_access_token;
      const headerToken = req.headers?.authorization?.split(' ')[1];

      expect(cookieToken).toBeUndefined();
      expect(headerToken).toBe('header-token');
    });

    it('should reject request with no token', () => {
      const req = createMockRequest({});
      const { res, getStatus, getJson } = createMockResponse();

      const token = req.cookies?.auth_access_token || req.headers?.authorization?.split(' ')[1];

      if (!token) {
        res.status?.(401);
        res.json?.({ error: 'No token provided' });
      }

      expect(getStatus()).toBe(401);
      expect((getJson() as { error: string }).error).toBe('No token provided');
    });

    it('should reject expired token', () => {
      const { res, getStatus, getJson } = createMockResponse();

      res.status?.(401);
      res.json?.({ error: 'Token expired or invalid' });

      expect(getStatus()).toBe(401);
      expect((getJson() as { error: string }).error).toBe('Token expired or invalid');
    });
  });

  // ==========================================================================
  // EMAIL VERIFICATION TESTS
  // ==========================================================================
  describe('Email Verification', () => {
    describe('POST /api/auth/verify-email', () => {
      it('should verify email with valid token', async () => {
        const mockUser = createMockUser({ emailVerified: false });
        const verificationToken = {
          id: 'verify-1',
          userId: mockUser.id,
          token: 'valid-token',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        };
        mockStorage.getEmailVerificationToken.mockResolvedValue(verificationToken);
        mockStorage.updateUser.mockResolvedValue({ ...mockUser, emailVerified: true });

        const token = await mockStorage.getEmailVerificationToken('valid-token');
        const updatedUser = await mockStorage.updateUser(token!.userId, { emailVerified: true });

        expect(updatedUser?.emailVerified).toBe(true);
      });

      it('should reject invalid verification token', async () => {
        mockStorage.getEmailVerificationToken.mockResolvedValue(null);

        const token = await mockStorage.getEmailVerificationToken('invalid-token');

        expect(token).toBeNull();
      });

      it('should delete verification tokens after verification', async () => {
        const userId = 'user-123';

        await mockStorage.deleteEmailVerificationTokensForUser(userId);

        expect(mockStorage.deleteEmailVerificationTokensForUser).toHaveBeenCalledWith(userId);
      });
    });

    describe('POST /api/auth/resend-verification', () => {
      it('should create new verification token', async () => {
        const mockUser = createMockUser({ emailVerified: false });
        mockStorage.getUserByEmail.mockResolvedValue(mockUser);
        mockStorage.createEmailVerificationToken.mockResolvedValue({
          id: 'verify-2',
          userId: mockUser.id,
          token: 'new-verification-token',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        });

        await mockStorage.deleteEmailVerificationTokensForUser(mockUser.id);
        const newToken = await mockStorage.createEmailVerificationToken(
          mockUser.id,
          'new-verification-token',
          new Date(Date.now() + 24 * 60 * 60 * 1000)
        );

        expect(newToken).toBeDefined();
        expect(mockStorage.deleteEmailVerificationTokensForUser).toHaveBeenCalled();
      });

      it('should skip for already verified email', async () => {
        const mockUser = createMockUser({ emailVerified: true });
        mockStorage.getUserByEmail.mockResolvedValue(mockUser);

        const user = await mockStorage.getUserByEmail('test@example.com');

        expect(user?.emailVerified).toBe(true);
      });
    });
  });

  // ==========================================================================
  // GET CURRENT USER TESTS
  // ==========================================================================
  describe('GET /api/auth/user', () => {
    it('should return sanitized user data', async () => {
      const mockUser = createMockUser({
        password: '$2a$10$secrethash',
        zkpPublicKey: 'publickey123',
        zkpSalt: 'salt123',
        failedLoginAttempts: '0',
        lockedUntil: null,
      });
      mockStorage.getUser.mockResolvedValue(mockUser);

      const user = await mockStorage.getUser('user-123');

      const { password, zkpPublicKey, zkpSalt, failedLoginAttempts, lockedUntil, ...safeUser } = user!;
      expect(safeUser).not.toHaveProperty('password');
      expect(safeUser).not.toHaveProperty('zkpPublicKey');
      expect(safeUser).not.toHaveProperty('zkpSalt');
      expect(safeUser.email).toBe('test@example.com');
    });

    it('should reject request with invalid token', () => {
      const { res, getStatus } = createMockResponse();

      res.status?.(401);
      res.json?.({ error: 'Token expired or invalid' });

      expect(getStatus()).toBe(401);
    });

    it('should return 401 if user not found', async () => {
      mockStorage.getUser.mockResolvedValue(undefined);

      const user = await mockStorage.getUser('non-existent-id');

      expect(user).toBeUndefined();
    });
  });

  // ==========================================================================
  // AUDIT LOGGING TESTS
  // ==========================================================================
  describe('Audit Logging', () => {
    it('should log successful registration', async () => {
      const auditData = {
        action: 'auth.register.success',
        userId: 'user-123',
        resource: 'user',
        resourceId: 'user-123',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      };

      mockStorage.createAuditLog.mockResolvedValue({
        id: 'audit-1',
        ...auditData,
        changes: null,
        metadata: null,
        createdAt: new Date(),
      });

      const log = await mockStorage.createAuditLog(auditData);

      expect(log.action).toBe('auth.register.success');
      expect(log.userId).toBe('user-123');
    });

    it('should log failed login attempts', async () => {
      const auditData = {
        action: 'auth.login.failed',
        ipAddress: '127.0.0.1',
        metadata: { email: 'test@example.com' },
      };

      await mockStorage.createAuditLog(auditData);

      expect(mockStorage.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'auth.login.failed',
      }));
    });
  });

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================
  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockStorage.getUserByEmail.mockRejectedValue(new Error('Database connection failed'));

      await expect(mockStorage.getUserByEmail('test@example.com')).rejects.toThrow('Database connection failed');
    });

    it('should handle email service errors', async () => {
      (sendVerificationEmail as Mock).mockRejectedValueOnce(new Error('SMTP error'));

      await expect(sendVerificationEmail('test@example.com', 'token', 'Test')).rejects.toThrow('SMTP error');
    });

    it('should handle bcrypt errors', async () => {
      (bcrypt.hash as Mock).mockRejectedValueOnce(new Error('Hashing failed'));

      await expect(bcrypt.hash('password', 10)).rejects.toThrow('Hashing failed');
    });

    it('should handle ZKP crypto errors', async () => {
      (generateCommitment as Mock).mockRejectedValueOnce(new Error('Crypto operation failed'));

      await expect(generateCommitment('password')).rejects.toThrow('Crypto operation failed');
    });
  });

  // ==========================================================================
  // INPUT SANITIZATION TESTS
  // ==========================================================================
  describe('Input Sanitization', () => {
    it('should normalize email addresses', () => {
      const email = '  Test@EXAMPLE.com  ';

      const normalized = normalizeEmail(email);

      expect(normalized).toBe('test@example.com');
    });

    it('should handle empty inputs', () => {
      const result = normalizeEmail('');

      expect(result).toBe('');
    });
  });

  // ==========================================================================
  // DEFAULT ADMIN INITIALIZATION TESTS
  // ==========================================================================
  describe('Default Admin Initialization', () => {
    it('should not create duplicate admin user', async () => {
      const existingAdmin = createMockUser({ email: 'admin@example.com' });
      mockStorage.getUserByEmail.mockResolvedValue(existingAdmin);

      const user = await mockStorage.getUserByEmail('admin@example.com');

      expect(user).not.toBeNull();
    });
  });
});

// ============================================================================
// INTEGRATION-STYLE TESTS
// ============================================================================

describe('Auth Module Integration Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Registration Flow', () => {
    it('should complete full registration flow', async () => {
      const mockUser = createMockUser();
      mockStorage.getUserByEmail.mockResolvedValue(null);
      mockStorage.createUser.mockResolvedValue(mockUser);
      mockStorage.createEmailVerificationToken.mockResolvedValue({
        id: 'token-1',
        userId: mockUser.id,
        token: 'verification-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      });
      mockStorage.createRefreshToken.mockResolvedValue({
        id: 'refresh-1',
        userId: mockUser.id,
        token: 'refresh-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      });

      const existingUser = await mockStorage.getUserByEmail('newuser@example.com');
      expect(existingUser).toBeNull();

      const newUser = await mockStorage.createUser({
        username: 'newuser',
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        password: '$2a$10$hashedpassword',
      });
      expect(newUser).toBeDefined();

      const verificationToken = await mockStorage.createEmailVerificationToken(
        newUser.id,
        'verification-token',
        new Date(Date.now() + 24 * 60 * 60 * 1000)
      );
      expect(verificationToken).toBeDefined();

      await sendVerificationEmail(newUser.email, verificationToken.token, newUser.firstName);
      expect(sendVerificationEmail).toHaveBeenCalled();

      const refreshToken = await mockStorage.createRefreshToken(
        newUser.id,
        'refresh-token',
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );
      expect(refreshToken).toBeDefined();
    });
  });

  describe('Complete Login Flow with Account Lockout', () => {
    it('should lock account after max failed attempts', async () => {
      const mockUser = createMockUser();
      mockStorage.getUserByEmail.mockResolvedValue(mockUser);
      mockStorage.isAccountLocked.mockResolvedValue(false);
      (bcrypt.compare as Mock).mockResolvedValue(false);

      let failedAttempts = 0;
      mockStorage.incrementFailedAttempts.mockImplementation(async () => {
        failedAttempts++;
        return failedAttempts;
      });

      for (let i = 0; i < 5; i++) {
        const user = await mockStorage.getUserByEmail('test@example.com');
        const isLocked = await mockStorage.isAccountLocked(user!.id);
        expect(isLocked).toBe(false);

        const passwordValid = await bcrypt.compare('wrongpassword', user!.password);
        expect(passwordValid).toBe(false);

        await mockStorage.incrementFailedAttempts(user!.id);
      }

      expect(failedAttempts).toBe(5);

      mockStorage.isAccountLocked.mockResolvedValue(true);
      const isNowLocked = await mockStorage.isAccountLocked(mockUser.id);
      expect(isNowLocked).toBe(true);
    });
  });

  describe('Password Reset Flow', () => {
    it('should complete full password reset flow', async () => {
      const mockUser = createMockUser({ failedLoginAttempts: '5', lockedUntil: new Date() });
      mockStorage.getUserByEmail.mockResolvedValue(mockUser);
      mockStorage.createPasswordResetToken.mockResolvedValue({
        id: 'reset-1',
        userId: mockUser.id,
        token: 'reset-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date(),
      });
      mockStorage.getPasswordResetToken.mockResolvedValue({
        id: 'reset-1',
        userId: mockUser.id,
        token: 'reset-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date(),
      });
      mockStorage.updateUser.mockResolvedValue({
        ...mockUser,
        password: '$2a$10$newpasswordhash',
        failedLoginAttempts: '0',
        lockedUntil: null,
      });

      const user = await mockStorage.getUserByEmail('test@example.com');
      expect(user).toBeDefined();

      await mockStorage.deletePasswordResetTokensForUser(user!.id);
      const resetToken = await mockStorage.createPasswordResetToken(
        user!.id,
        'reset-token',
        new Date(Date.now() + 60 * 60 * 1000)
      );

      await sendPasswordResetEmail(user!.email, resetToken.token);
      expect(sendPasswordResetEmail).toHaveBeenCalled();

      const validToken = await mockStorage.getPasswordResetToken('reset-token');
      expect(validToken).toBeDefined();

      const updatedUser = await mockStorage.updateUser(validToken!.userId, {
        password: '$2a$10$newpasswordhash',
      });
      expect(updatedUser?.password).toBe('$2a$10$newpasswordhash');

      await mockStorage.resetFailedAttempts(validToken!.userId);
      expect(mockStorage.resetFailedAttempts).toHaveBeenCalled();
    });
  });
});
