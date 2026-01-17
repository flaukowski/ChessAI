import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
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

const router = Router();

// Token configuration (from centralized config)
const ACCESS_TOKEN_EXPIRY_MS = tokenConfig.accessTokenExpiryMs;
const REFRESH_TOKEN_EXPIRY_MS = tokenConfig.refreshTokenExpiryMs;
const EMAIL_VERIFICATION_EXPIRY_MS = tokenConfig.emailVerificationExpiryMs;
const PASSWORD_RESET_EXPIRY_MS = tokenConfig.passwordResetExpiryMs;
const ZKP_CHALLENGE_EXPIRY_MS = tokenConfig.zkpChallengeExpiryMs;
const SALT_ROUNDS = securityConfig.saltRounds;

// Security configuration (from centralized config)
const MAX_LOGIN_ATTEMPTS = securityConfig.maxLoginAttempts;
const LOCKOUT_DURATION_MS = securityConfig.lockoutDurationMs;
const RATE_LIMIT_WINDOW_MS = securityConfig.rateLimitWindowMs;
const RATE_LIMIT_MAX_REQUESTS = securityConfig.rateLimitMaxRequests;

// In-memory stores
const accessTokenStore = new Map<string, { userId: string; expiresAt: Date }>();
const rateLimitStore = new Map<string, { count: number; resetAt: Date }>();

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

  accessTokenStore.set(accessToken, { userId, expiresAt: accessExpiresAt });
  await storage.createRefreshToken(userId, refreshToken, refreshExpiresAt);

  return { accessToken, refreshToken };
};

const getClientIP = (req: Request): string => {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';
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

// Middleware to verify access token
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

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

// Clean up expired tokens periodically
setInterval(() => {
  const now = new Date();
  for (const [token, data] of accessTokenStore.entries()) {
    if (data.expiresAt < now) {
      accessTokenStore.delete(token);
    }
  }
  // Clean up rate limit entries
  for (const [key, data] of rateLimitStore.entries()) {
    if (data.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
  // Clean up expired ZKP challenges
  storage.deleteExpiredZKPChallenges().catch(console.error);
}, 60000);

// ============== ZKP AUTH ROUTES ==============

/**
 * Register with ZKP
 * Client sends pre-computed ZKP commitment (public key + salt)
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, zkpCommitment, firstName, lastName } = req.body;

    if (!email || (!password && !zkpCommitment)) {
      return res.status(400).json({
        error: 'Missing fields',
        message: 'Email and either password or ZKP commitment required',
      });
    }

    // Validate password if provided (for backward compatibility or if client generates commitment server-side)
    if (password && password.length < 8) {
      return res.status(400).json({
        error: 'Password too short',
        message: 'Password must be at least 8 characters',
      });
    }

    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'Email exists',
        message: 'An account with this email already exists',
      });
    }

    const username = email.split('@')[0] + '_' + Date.now();

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
      email,
      firstName: firstName || '',
      lastName: lastName || '',
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
      await sendVerificationEmail(email, verificationToken, firstName);
      console.log(`[Auth] Verification email sent to ${email}`);
    } catch (emailError) {
      console.error('[Auth] Failed to send verification email:', emailError);
    }

    const tokens = await createTokenPair(user.id);

    // Log successful registration
    await storage.recordLoginAttempt(email, true, getClientIP(req), req.headers['user-agent']);

    res.status(201).json({
      user: sanitizeUser({ ...user, zkpPublicKey: commitment.publicKey, zkpSalt: commitment.salt }),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
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
      await storage.recordLoginAttempt(email, false, getClientIP(req), req.headers['user-agent'], 'User not found');
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Check if account is locked
    if (await storage.isAccountLocked(user.id)) {
      await storage.recordLoginAttempt(email, false, getClientIP(req), req.headers['user-agent'], 'Account locked');
      return res.status(423).json({
        error: 'Account locked',
        message: 'Too many failed attempts. Please try again later.',
      });
    }

    // Get the challenge
    const storedChallenge = await storage.getZKPChallenge(proof.sessionId);

    if (!storedChallenge || storedChallenge.userId !== user.id) {
      await storage.recordLoginAttempt(email, false, getClientIP(req), req.headers['user-agent'], 'Invalid challenge');
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
      await storage.recordLoginAttempt(email, false, getClientIP(req), req.headers['user-agent'], 'No ZKP credentials');
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
      await storage.recordLoginAttempt(email, false, getClientIP(req), req.headers['user-agent'], 'Invalid proof');
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
    await storage.recordLoginAttempt(email, true, getClientIP(req), req.headers['user-agent']);

    const tokens = await createTokenPair(user.id);

    if (!user.emailVerified) {
      return res.json({
        user: sanitizeUser(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        requiresVerification: true,
        message: 'Login successful. Please verify your email.',
      });
    }

    res.json({
      user: sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
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
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required',
      });
    }

    const user = await storage.getUserByEmail(email);

    if (!user) {
      await storage.recordLoginAttempt(email, false, getClientIP(req), req.headers['user-agent'], 'User not found');
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Check if account is locked
    if (await storage.isAccountLocked(user.id)) {
      await storage.recordLoginAttempt(email, false, getClientIP(req), req.headers['user-agent'], 'Account locked');
      return res.status(423).json({
        error: 'Account locked',
        message: 'Too many failed attempts. Please try again later.',
      });
    }

    // Try bcrypt verification first (for legacy accounts)
    const passwordValid = await verifyPassword(password, user.password);

    if (!passwordValid) {
      await storage.recordLoginAttempt(email, false, getClientIP(req), req.headers['user-agent'], 'Invalid password');
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
    await storage.recordLoginAttempt(email, true, getClientIP(req), req.headers['user-agent']);

    const tokens = await createTokenPair(user.id);

    if (!user.emailVerified) {
      return res.json({
        user: sanitizeUser(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        zkpSalt: user.zkpSalt, // Include salt for ZKP upgrade
        requiresVerification: true,
        message: 'Login successful. Please verify your email.',
      });
    }

    res.json({
      user: sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
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
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.split(' ')[1];
    const { refreshToken } = req.body;

    if (accessToken) {
      accessTokenStore.delete(accessToken);
    }

    if (refreshToken) {
      await storage.deleteRefreshToken(refreshToken);
    }

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
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

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
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Missing token',
        message: 'Refresh token is required',
      });
    }

    const storedToken = await storage.getRefreshToken(refreshToken);

    if (!storedToken) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Refresh token is invalid or expired',
      });
    }

    await storage.deleteRefreshToken(refreshToken);
    const tokens = await createTokenPair(storedToken.userId);

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
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

    res.json({
      success: true,
      user: sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
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

// Resend verification email
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Missing email',
        message: 'Email is required',
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

// Forgot password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Missing email',
        message: 'Email is required',
      });
    }

    const user = await storage.getUserByEmail(email);

    if (!user) {
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

// Reset password
router.post('/reset-password', async (req: Request, res: Response) => {
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
    await storage.resetFailedAttempts(user.id); // Unlock account on password reset

    const tokens = await createTokenPair(user.id);

    res.json({
      success: true,
      user: sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
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
