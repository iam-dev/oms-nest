import { logger } from '@/utils/logger';

/**
 * @deprecated Token is now stored as httpOnly cookie and not accessible from JS.
 * Authentication is handled via credentials: 'include' on fetch requests.
 * This hook is kept for backward compatibility but always returns null.
 */
export function useToken() {
  return null;
}

/**
 * @deprecated Token is now stored as httpOnly cookie and not accessible from JS.
 * This function is kept for backward compatibility but always returns null.
 */
export function getStoredToken(): string | null {
  return null;
}
