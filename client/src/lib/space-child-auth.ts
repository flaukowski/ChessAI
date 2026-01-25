/**
 * Space Child Auth Client Library
 * Unified authentication with Zero-Knowledge Proof support
 */

import {
  generateCommitment,
  generateProof,
  type ZKPCommitment,
  type ZKPProof,
} from '@shared/zkp-crypto';

// Auth API base URL
const AUTH_BASE_URL = '/api/space-child-auth';

export interface User {
  id: string;
  email: string;
  username?: string;
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
  zkpSalt?: string;
}

export interface RegisterResponse {
  user: User;
  requiresVerification?: boolean;
  message?: string;
  accessToken?: string;
  refreshToken?: string;
  zkpSalt?: string;
}

export interface AuthError extends Error {
  requiresVerification?: boolean;
  statusCode?: number;
  attemptsRemaining?: number;
  retryAfter?: number;
}

interface ChallengeResponse {
  challenge: string;
  sessionId: string;
  salt: string;
}

const ACCESS_TOKEN_KEY = 'space-child-access-token';
const REFRESH_TOKEN_KEY = 'space-child-refresh-token';
const ZKP_SALT_KEY = 'space-child-zkp-salt';

/**
 * @deprecated Tokens are now stored in HttpOnly cookies.
 * This function is kept for backward compatibility only.
 * Do NOT use this for API calls - cookies are sent automatically with credentials: 'include'.
 */
export function getStoredTokens(): AuthTokens | null {
  if (typeof window === 'undefined') return null;

  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  if (accessToken && refreshToken) {
    return { accessToken, refreshToken };
  }
  return null;
}

/**
 * @deprecated Tokens are now stored in HttpOnly cookies set by the server.
 * This function is kept for backward compatibility only.
 */
export function setStoredTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

/**
 * @deprecated Tokens are now stored in HttpOnly cookies.
 * This function is kept for backward compatibility to clear legacy localStorage tokens.
 */
export function clearStoredTokens(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ZKP_SALT_KEY);
}

export function getStoredZKPSalt(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ZKP_SALT_KEY);
}

export function setStoredZKPSalt(salt: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ZKP_SALT_KEY, salt);
}

/**
 * Register with ZKP - generates commitment client-side
 */
export async function register(params: RegisterParams): Promise<RegisterResponse> {
  // Generate ZKP commitment from password
  const zkpCommitment = await generateCommitment(params.password);

  const response = await fetch(`${AUTH_BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      email: params.email,
      zkpCommitment,
      firstName: params.firstName,
      lastName: params.lastName,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    const authError: AuthError = new Error(error.message || error.error || 'Registration failed');
    authError.statusCode = response.status;
    if (response.status === 429) {
      authError.retryAfter = error.retryAfter;
    }
    throw authError;
  }

  const data: RegisterResponse = await response.json();

  if (data.accessToken && data.refreshToken) {
    setStoredTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  }

  if (data.zkpSalt) {
    setStoredZKPSalt(data.zkpSalt);
  }

  return data;
}

/**
 * Login with ZKP - two-step process:
 * 1. Request challenge from server
 * 2. Generate proof and verify
 */
export async function login(params: LoginParams): Promise<AuthResponse> {
  // Step 1: Request challenge
  const challengeResponse = await fetch(`${AUTH_BASE_URL}/login/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email: params.email }),
  });

  if (!challengeResponse.ok) {
    const error = await challengeResponse.json();
    const authError: AuthError = new Error(error.message || error.error || 'Failed to get challenge');
    authError.statusCode = challengeResponse.status;
    if (challengeResponse.status === 429) {
      authError.retryAfter = error.retryAfter;
    }
    throw authError;
  }

  const challengeData: ChallengeResponse = await challengeResponse.json();

  // Step 2: Generate proof and verify
  const proof = await generateProof(
    params.password,
    challengeData.salt,
    challengeData.challenge,
    challengeData.sessionId
  );

  const verifyResponse = await fetch(`${AUTH_BASE_URL}/login/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      email: params.email,
      proof,
    }),
  });

  const data = await verifyResponse.json();

  if (!verifyResponse.ok) {
    const authError: AuthError = new Error(data.message || data.error || 'Login failed');
    authError.requiresVerification = data.requiresVerification;
    authError.statusCode = verifyResponse.status;
    authError.attemptsRemaining = data.attemptsRemaining;
    if (verifyResponse.status === 429) {
      authError.retryAfter = data.retryAfter;
    }
    throw authError;
  }

  if (data.accessToken && data.refreshToken) {
    setStoredTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  }

  // Store salt for future logins
  if (challengeData.salt) {
    setStoredZKPSalt(challengeData.salt);
  }

  // If login succeeded but requires verification, throw with flag
  if (data.requiresVerification) {
    const error: AuthError = new Error('Email verification required');
    error.requiresVerification = true;
    throw error;
  }

  return data;
}

/**
 * Legacy login - fallback for accounts without ZKP setup
 * This sends the password directly (less secure)
 */
export async function loginLegacy(params: LoginParams): Promise<AuthResponse> {
  const response = await fetch(`${AUTH_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok) {
    const error: AuthError = new Error(data.message || data.error || 'Login failed');
    error.requiresVerification = data.requiresVerification;
    error.statusCode = response.status;
    error.attemptsRemaining = data.attemptsRemaining;
    if (response.status === 429) {
      error.retryAfter = data.retryAfter;
    }
    throw error;
  }

  if (data.accessToken && data.refreshToken) {
    setStoredTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  }

  if (data.zkpSalt) {
    setStoredZKPSalt(data.zkpSalt);
  }

  if (data.requiresVerification) {
    const error: AuthError = new Error('Email verification required');
    error.requiresVerification = true;
    throw error;
  }

  return data;
}

/**
 * Smart login - tries ZKP first, falls back to legacy
 */
export async function smartLogin(params: LoginParams): Promise<AuthResponse> {
  try {
    return await login(params);
  } catch (error) {
    // If ZKP login fails with invalid credentials, try legacy
    // (for accounts created before ZKP was implemented)
    if (error instanceof Error && (error as AuthError).statusCode === 401) {
      console.log('[Auth] ZKP login failed, trying legacy login...');
      return await loginLegacy(params);
    }
    throw error;
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${AUTH_BASE_URL}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
  } catch (e) {
    // Ignore logout errors
  }

  clearStoredTokens();
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await fetch(`${AUTH_BASE_URL}/user`, {
      credentials: 'include',
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
  } catch (e) {
    console.error('Get current user error:', e);
    return null;
  }
}

export async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${AUTH_BASE_URL}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!response.ok) {
      clearStoredTokens();
      return false;
    }

    const data = await response.json();
    // Still store tokens for backward compatibility
    setStoredTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return true;
  } catch (e) {
    clearStoredTokens();
    return false;
  }
}

export async function verifyEmail(token: string): Promise<{ success: boolean; message: string; user?: User; accessToken?: string; refreshToken?: string }> {
  const response = await fetch(`${AUTH_BASE_URL}/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'Verification failed');
  }

  if (data.accessToken && data.refreshToken) {
    setStoredTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  }

  return data;
}

export async function resendVerification(email: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${AUTH_BASE_URL}/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
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
    credentials: 'include',
    body: JSON.stringify({ email }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to send reset email');
  }

  return data;
}

/**
 * Reset password with ZKP - generates new commitment
 */
export async function resetPassword(token: string, password: string): Promise<{ success: boolean; message: string; user?: User; accessToken?: string; refreshToken?: string; zkpSalt?: string }> {
  // Generate new ZKP commitment
  const zkpCommitment = await generateCommitment(password);

  const response = await fetch(`${AUTH_BASE_URL}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token, zkpCommitment }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'Password reset failed');
  }

  if (data.accessToken && data.refreshToken) {
    setStoredTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  }

  if (data.zkpSalt) {
    setStoredZKPSalt(data.zkpSalt);
  }

  return data;
}

export function createAuthenticatedFetch() {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers);

    let response = await fetch(url, { 
      ...options, 
      headers,
      credentials: 'include',
    });

    // Try refresh if unauthorized
    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        response = await fetch(url, { 
          ...options, 
          headers,
          credentials: 'include',
        });
      }
    }

    return response;
  };
}

export const authFetch = createAuthenticatedFetch();

// Re-export ZKP types for convenience
export type { ZKPCommitment, ZKPProof };
