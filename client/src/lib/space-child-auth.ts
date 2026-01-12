/**
 * Space Child Auth Client Library
 * Unified authentication for SonicVision - connects to Space-Child-Dream auth API
 */

// Auth API base URL - points to Space-Child-Dream
const AUTH_BASE_URL = '/api/space-child-auth';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginParams {
  email: string;
  password: string;
}

export interface RegisterParams {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResponse {
  user: User;
  requiresVerification?: boolean;
  message?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface AuthError extends Error {
  requiresVerification?: boolean;
  statusCode?: number;
}

const ACCESS_TOKEN_KEY = 'space-child-access-token';
const REFRESH_TOKEN_KEY = 'space-child-refresh-token';

export function getStoredTokens(): AuthTokens | null {
  if (typeof window === 'undefined') return null;
  
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  
  if (accessToken && refreshToken) {
    return { accessToken, refreshToken };
  }
  return null;
}

export function setStoredTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearStoredTokens(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function login(params: LoginParams): Promise<AuthResponse> {
  const response = await fetch(`${AUTH_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json();
    const error: AuthError = new Error(errorData.error || 'Login failed');
    error.requiresVerification = errorData.requiresVerification;
    error.statusCode = response.status;
    throw error;
  }

  const data: AuthResponse = await response.json();
  setStoredTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data;
}

export async function register(params: RegisterParams): Promise<RegisterResponse> {
  const response = await fetch(`${AUTH_BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Registration failed');
  }

  const data: RegisterResponse = await response.json();
  
  if (data.accessToken && data.refreshToken) {
    setStoredTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  }
  
  return data;
}

export async function logout(): Promise<void> {
  const tokens = getStoredTokens();
  
  if (tokens?.accessToken) {
    try {
      await fetch(`${AUTH_BASE_URL}/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
        },
      });
    } catch (e) {
      // Ignore logout errors
    }
  }
  
  clearStoredTokens();
}

export async function getCurrentUser(): Promise<User | null> {
  const tokens = getStoredTokens();
  
  if (!tokens?.accessToken) {
    return null;
  }

  const response = await fetch(`${AUTH_BASE_URL}/user`, {
    headers: {
      'Authorization': `Bearer ${tokens.accessToken}`,
    },
  });

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      clearStoredTokens();
      return null;
    }
    return getCurrentUser();
  }

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function refreshAccessToken(): Promise<boolean> {
  const tokens = getStoredTokens();
  
  if (!tokens?.refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${AUTH_BASE_URL}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!response.ok) {
      clearStoredTokens();
      return false;
    }

    const data = await response.json();
    setStoredTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return true;
  } catch (e) {
    clearStoredTokens();
    return false;
  }
}

export async function verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${AUTH_BASE_URL}/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Verification failed');
  }

  return data;
}

export async function resendVerification(email: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${AUTH_BASE_URL}/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to resend');
  }

  return data;
}

export async function forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${AUTH_BASE_URL}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to send reset email');
  }

  return data;
}

export async function resetPassword(token: string, password: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${AUTH_BASE_URL}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Password reset failed');
  }

  return data;
}

export function createAuthenticatedFetch() {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const tokens = getStoredTokens();
    
    const headers = new Headers(options.headers);
    if (tokens?.accessToken) {
      headers.set('Authorization', `Bearer ${tokens.accessToken}`);
    }
    
    let response = await fetch(url, { ...options, headers });
    
    if (response.status === 401 && tokens?.refreshToken) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        const newTokens = getStoredTokens();
        if (newTokens?.accessToken) {
          headers.set('Authorization', `Bearer ${newTokens.accessToken}`);
          response = await fetch(url, { ...options, headers });
        }
      }
    }
    
    return response;
  };
}

export const authFetch = createAuthenticatedFetch();
