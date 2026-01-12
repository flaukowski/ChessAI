/**
 * Space Child Auth Routes (Stub Implementation)
 * These routes provide a graceful response when auth service isn't configured.
 * In production, connect these to your authentication service.
 */

import { Router, Request, Response } from 'express';

const router = Router();

// Auth not configured response
const authNotConfigured = (res: Response) => {
  res.status(503).json({
    error: 'Authentication service not configured',
    message: 'User authentication is currently disabled. Please try again later or use the app as a guest.',
    code: 'AUTH_NOT_CONFIGURED'
  });
};

// Login
router.post('/login', async (req: Request, res: Response) => {
  authNotConfigured(res);
});

// Register
router.post('/register', async (req: Request, res: Response) => {
  authNotConfigured(res);
});

// Logout
router.post('/logout', async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Logged out' });
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  authNotConfigured(res);
});

// Get current user
router.get('/me', async (req: Request, res: Response) => {
  res.status(401).json({ 
    error: 'Not authenticated',
    message: 'No user session found' 
  });
});

// Forgot password
router.post('/forgot-password', async (req: Request, res: Response) => {
  authNotConfigured(res);
});

// Resend verification
router.post('/resend-verification', async (req: Request, res: Response) => {
  authNotConfigured(res);
});

// Verify email
router.post('/verify-email', async (req: Request, res: Response) => {
  authNotConfigured(res);
});

export default router;
