/**
 * Space Child Auth React Hook
 * Full authentication hook with email verification and password reset
 */

import { useState, useEffect, useCallback } from 'react';
import * as auth from '@/lib/space-child-auth';
import type { User, LoginParams, RegisterParams } from '@/lib/space-child-auth';

interface AuthResult {
  success: boolean;
  requiresVerification?: boolean;
  error?: string;
  attemptsRemaining?: number;
  retryAfter?: number;
  accountLocked?: boolean;
}

interface UseSpaceChildAuthReturn {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (params: LoginParams) => Promise<AuthResult>;
  register: (params: RegisterParams) => Promise<AuthResult>;
  logout: () => Promise<void>;
  verifyEmail: (token: string) => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  resetPassword: (token: string, password: string) => Promise<{ success: boolean; error?: string }>;
  resendVerification: (email: string) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

export function useSpaceChildAuth(): UseSpaceChildAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    auth.getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (params: LoginParams): Promise<AuthResult> => {
    setError(null);
    setIsLoading(true);
    try {
      // Use smartLogin which tries ZKP first, then falls back to legacy
      const result = await auth.smartLogin(params);
      setUser(result.user);
      setIsLoading(false);
      return { success: true };
    } catch (e: any) {
      setError(e.message);
      setIsLoading(false);
      if (e.requiresVerification) {
        return { success: true, requiresVerification: true };
      }
      // Handle account lockout
      if (e.statusCode === 423) {
        return { success: false, error: e.message, accountLocked: true };
      }
      // Handle rate limiting
      if (e.statusCode === 429) {
        return { success: false, error: e.message, retryAfter: e.retryAfter };
      }
      return {
        success: false,
        error: e.message,
        attemptsRemaining: e.attemptsRemaining,
      };
    }
  }, []);

  const register = useCallback(async (params: RegisterParams): Promise<AuthResult> => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await auth.register(params);
      if (result.accessToken && result.user) {
        setUser(result.user);
      }
      setIsLoading(false);
      return { success: true, requiresVerification: result.requiresVerification };
    } catch (e: any) {
      setError(e.message);
      setIsLoading(false);
      // Handle rate limiting
      if (e.statusCode === 429) {
        return { success: false, error: e.message, retryAfter: e.retryAfter };
      }
      return { success: false, error: e.message };
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    await auth.logout();
    setUser(null);
    setIsLoading(false);
  }, []);

  const verifyEmail = useCallback(async (token: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await auth.verifyEmail(token);
      if (result.user) {
        setUser(result.user);
      }
      setIsLoading(false);
      return { success: true };
    } catch (e: any) {
      setError(e.message);
      setIsLoading(false);
      return { success: false, error: e.message };
    }
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await auth.forgotPassword(email);
      setIsLoading(false);
      return { success: true, message: result.message };
    } catch (e: any) {
      setError(e.message);
      setIsLoading(false);
      return { success: false, error: e.message };
    }
  }, []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await auth.resetPassword(token, password);
      if (result.user) {
        setUser(result.user);
      }
      setIsLoading(false);
      return { success: true };
    } catch (e: any) {
      setError(e.message);
      setIsLoading(false);
      return { success: false, error: e.message };
    }
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await auth.resendVerification(email);
      setIsLoading(false);
      return { success: true };
    } catch (e: any) {
      setError(e.message);
      setIsLoading(false);
      return { success: false, error: e.message };
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const currentUser = await auth.getCurrentUser();
    setUser(currentUser);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    register,
    logout,
    verifyEmail,
    forgotPassword,
    resetPassword,
    resendVerification,
    clearError,
    refreshUser,
  };
}

export default useSpaceChildAuth;
