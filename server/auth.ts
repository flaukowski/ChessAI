import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { storage } from './storage';
import type { User } from '@shared/schema';
import { sendVerificationEmail, sendPasswordResetEmail } from './email';

const router = Router();

// JWT-like token configuration (using simple tokens for now, can upgrade to proper JWT later)
const ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const EMAIL_VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_EXPIRY_MS = 1 * 60 * 60 * 1000; // 1 hour
const SALT_ROUNDS = 10;

// In-memory token store for access tokens (maps token -> userId)
// In production, consider using Redis or proper JWT
const accessTokenStore = new Map<string, { userId: string; expiresAt: Date }>();

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
  const { password, ...safeUser } = user;
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
  
  // Store access token in memory
  accessTokenStore.set(accessToken, { userId, expiresAt: accessExpiresAt });
  
  // Store refresh token in database
  await storage.createRefreshToken(userId, refreshToken, refreshExpiresAt);
  
  return { accessToken, refreshToken };
};

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

// Clean up expired access tokens periodically
setInterval(() => {
  const now = new Date();
  for (const [token, data] of accessTokenStore.entries()) {
    if (data.expiresAt < now) {
      accessTokenStore.delete(token);
    }
  }
}, 60000); // Every minute

// ============== AUTH ROUTES ==============

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Missing fields',
        message: 'Email and password are required' 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password too short',
        message: 'Password must be at least 8 characters'
      });
    }

    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ 
        error: 'Email exists',
        message: 'An account with this email already exists' 
      });
    }

    const username = email.split('@')[0] + '_' + Date.now();
    
    const user = await storage.createUser({
      username,
      email,
      firstName: firstName || '',
      lastName: lastName || '',
      password: await hashPassword(password),
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

    // For now, we'll return requiresVerification but also generate tokens
    // In strict mode, you'd wait for verification before issuing tokens
    const tokens = await createTokenPair(user.id);

    res.status(201).json({ 
      user: sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      requiresVerification: !user.emailVerified,
      message: 'Registration successful. Please verify your email.' 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred during registration' 
    });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Missing credentials',
        message: 'Email and password are required' 
      });
    }

    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Email or password is incorrect' 
      });
    }

    if (!await verifyPassword(password, user.password)) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Email or password is incorrect' 
      });
    }

    // Check if email is verified (optional - can enforce or just warn)
    if (!user.emailVerified) {
      // Still allow login but flag it
      const tokens = await createTokenPair(user.id);
      return res.json({ 
        user: sanitizeUser(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        requiresVerification: true,
        message: 'Login successful. Please verify your email.'
      });
    }

    const tokens = await createTokenPair(user.id);
    
    res.json({ 
      user: sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      message: 'Login successful' 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred during login' 
    });
  }
});

// Logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.split(' ')[1];
    const { refreshToken } = req.body;
    
    // Remove access token from memory
    if (accessToken) {
      accessTokenStore.delete(accessToken);
    }
    
    // Remove refresh token from database
    if (refreshToken) {
      await storage.deleteRefreshToken(refreshToken);
    }
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred during logout' 
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
        message: 'Session invalid' 
      });
    }

    res.json(sanitizeUser(user));
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred while fetching user' 
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
        message: 'Refresh token is required' 
      });
    }

    const storedToken = await storage.getRefreshToken(refreshToken);
    
    if (!storedToken) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Refresh token is invalid or expired' 
      });
    }

    // Delete the old refresh token (single use)
    await storage.deleteRefreshToken(refreshToken);

    // Create new token pair
    const tokens = await createTokenPair(storedToken.userId);

    res.json({ 
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      message: 'Token refreshed' 
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred during token refresh' 
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
        message: 'Verification token is required' 
      });
    }

    const verificationToken = await storage.getEmailVerificationToken(token);
    
    if (!verificationToken) {
      return res.status(400).json({ 
        error: 'Invalid token',
        message: 'Verification token is invalid or expired' 
      });
    }

    // Mark user as verified
    const user = await storage.updateUser(verificationToken.userId, { emailVerified: true });
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'User associated with this token not found' 
      });
    }

    // Delete all verification tokens for this user
    await storage.deleteEmailVerificationTokensForUser(user.id);

    // Create new token pair
    const tokens = await createTokenPair(user.id);

    res.json({ 
      success: true,
      user: sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      message: 'Email verified successfully' 
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred during email verification' 
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
        message: 'Email is required' 
      });
    }

    const user = await storage.getUserByEmail(email);
    
    // Don't reveal if user exists
    if (!user) {
      return res.json({ 
        success: true, 
        message: 'If the email exists, a verification link will be sent' 
      });
    }

    if (user.emailVerified) {
      return res.json({ 
        success: true, 
        message: 'Email is already verified' 
      });
    }

    // Delete old tokens and create new one
    await storage.deleteEmailVerificationTokensForUser(user.id);
    
    const verificationToken = generateToken();
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS);
    await storage.createEmailVerificationToken(user.id, verificationToken, expiresAt);

    // Send verification email
    try {
      await sendVerificationEmail(email, verificationToken, user.firstName);
      console.log(`[Auth] Verification email sent to ${email}`);
    } catch (emailError) {
      console.error('[Auth] Failed to send verification email:', emailError);
    }

    res.json({ 
      success: true, 
      message: 'Verification email sent' 
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred while resending verification' 
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
        message: 'Email is required' 
      });
    }

    const user = await storage.getUserByEmail(email);
    
    // Don't reveal if user exists
    if (!user) {
      return res.json({ 
        success: true, 
        message: 'If the email exists, a password reset link will be sent' 
      });
    }

    // Delete old tokens and create new one
    await storage.deletePasswordResetTokensForUser(user.id);
    
    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);
    await storage.createPasswordResetToken(user.id, resetToken, expiresAt);

    // Send password reset email
    try {
      await sendPasswordResetEmail(email, resetToken);
      console.log(`[Auth] Password reset email sent to ${email}`);
    } catch (emailError) {
      console.error('[Auth] Failed to send password reset email:', emailError);
    }

    res.json({ 
      success: true, 
      message: 'Password reset email sent' 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred while processing password reset' 
    });
  }
});

// Reset password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ 
        error: 'Missing fields',
        message: 'Token and password are required' 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password too short',
        message: 'Password must be at least 8 characters'
      });
    }

    const resetToken = await storage.getPasswordResetToken(token);
    
    if (!resetToken) {
      return res.status(400).json({ 
        error: 'Invalid token',
        message: 'Password reset token is invalid or expired' 
      });
    }

    // Update user password
    const hashedPassword = await hashPassword(password);
    const user = await storage.updateUser(resetToken.userId, { password: hashedPassword });
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'User associated with this token not found' 
      });
    }

    // Delete all password reset tokens for this user
    await storage.deletePasswordResetTokensForUser(user.id);
    
    // Invalidate all existing refresh tokens (force re-login everywhere)
    await storage.deleteRefreshTokensForUser(user.id);

    // Create new token pair
    const tokens = await createTokenPair(user.id);

    res.json({ 
      success: true,
      user: sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      message: 'Password reset successfully' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred during password reset' 
    });
  }
});

export default router;

export const initializeDefaultUser = async () => {
  try {
    const existingUser = await storage.getUserByEmail('info@spacechild.love');
    if (!existingUser) {
      const user = await storage.createUser({
        username: 'spacechild',
        email: 'info@spacechild.love',
        firstName: 'Space',
        lastName: 'Child',
        password: await hashPassword('password'),
      });
      // Mark as verified
      await storage.updateUser(user.id, { emailVerified: true });
      console.log('Default Space Child user created');
    }
  } catch (error) {
    console.error('Failed to initialize default user:', error);
  }
};
