import { User } from '@/types/Role';
import { logger } from '@/utils/logger';

/**
 * Service for managing user data storage in local storage.
 * Auth tokens are now handled via httpOnly cookies — no client-side token storage.
 */

const USER_STORAGE_KEY = 'oms_current_user';

/**
 * Get the current user from local storage
 */
export const getCurrentUser = (): User | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const userData = localStorage.getItem(USER_STORAGE_KEY);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    logger.error('Error getting current user from storage:', error);
    return null;
  }
};

/**
 * Set the current user in local storage
 */
export const setCurrentUser = (user: User | null): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch (error) {
    logger.error('Error setting current user in storage:', error);
  }
};

/**
 * Clear all user data from local storage
 */
export const clearUserStorage = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch (error) {
    logger.error('Error clearing user storage:', error);
  }
};

/**
 * Check if user is authenticated (has user data stored)
 */
export const isUserAuthenticated = (): boolean => {
  return !!getCurrentUser();
};