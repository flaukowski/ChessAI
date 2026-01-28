/**
 * Space Child Auth React Hook
 * Full authentication hook with email verification and password reset
 *
 * This hook now uses the AuthContext for shared state across all components.
 * When login/logout happens, all components using this hook will update.
 */

import { useAuth } from '@/contexts/auth-context';

// Re-export the hook that uses the context
export function useSpaceChildAuth() {
  return useAuth();
}

export default useSpaceChildAuth;
