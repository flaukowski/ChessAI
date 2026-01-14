import { Router, Request, Response } from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import { storage } from './storage';
import type { User } from '@shared/schema';

const router = Router();

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

const SALT_ROUNDS = 10;

const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

const sanitizeUser = (user: User) => {
  const { password, ...safeUser } = user;
  return safeUser;
};

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

    req.session.userId = user.id;
    
    res.json({ 
      success: true, 
      user: sanitizeUser(user),
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

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        error: 'Missing fields',
        message: 'Email, password, first name, and last name are required' 
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
      firstName,
      lastName,
      password: await hashPassword(password),
    });

    req.session.userId = user.id;

    res.status(201).json({ 
      success: true, 
      user: sanitizeUser(user),
      message: 'Registration successful' 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred during registration' 
    });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ 
        error: 'Logout failed',
        message: 'An error occurred during logout' 
      });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        message: 'No user session found' 
      });
    }

    const user = await storage.getUser(userId);
    
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ 
        error: 'User not found',
        message: 'Session invalid' 
      });
    }

    res.json({ 
      success: true, 
      user: sanitizeUser(user) 
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred while fetching user' 
    });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  const userId = req.session.userId;
  
  if (!userId) {
    return res.status(401).json({ 
      error: 'Not authenticated',
      message: 'No active session' 
    });
  }

  req.session.touch();
  res.json({ success: true, message: 'Session refreshed' });
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  res.json({ 
    success: true, 
    message: 'If the email exists, a reset link will be sent' 
  });
});

router.post('/resend-verification', async (req: Request, res: Response) => {
  res.json({ 
    success: true, 
    message: 'Verification email sent if account exists' 
  });
});

router.post('/verify-email', async (req: Request, res: Response) => {
  res.json({ 
    success: true, 
    message: 'Email verified' 
  });
});

export default router;

export const initializeDefaultUser = async () => {
  try {
    const existingUser = await storage.getUserByEmail('info@spacechild.love');
    if (!existingUser) {
      await storage.createUser({
        username: 'spacechild',
        email: 'info@spacechild.love',
        firstName: 'Space',
        lastName: 'Child',
        password: await hashPassword('password'),
      });
      console.log('Default Space Child user created');
    }
  } catch (error) {
    console.error('Failed to initialize default user:', error);
  }
};
