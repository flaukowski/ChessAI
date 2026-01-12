/**
 * Space Child Auth React Hook
 */

import { useState, useEffect, useCallback } from 'react';
import * as auth from '@/lib/space-child-auth';
import type { User, LoginParams, RegisterParams } from '@/lib/space-child-auth';

export function useSpaceChildAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    auth.getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (params: LoginParams) => {
    setError(null);
    try {
      const result = await auth.login(params);
      setUser(result.user);
      return result;
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  }, []);

  const register = useCallback(async (params: RegisterParams) => {
    setError(null);
    try {
      const result = await auth.register(params);
      if (result.accessToken) setUser(result.user);
      return result;
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    await auth.logout();
    setUser(null);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    register,
    logout,
    refreshUser: () => auth.getCurrentUser().then(setUser),
  };
}

export default useSpaceChildAuth;
