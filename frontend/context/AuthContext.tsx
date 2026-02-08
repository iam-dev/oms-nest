"use client";
import React, { createContext, useContext, useEffect, ReactNode, useCallback } from 'react';
import { useAtom } from 'jotai';
import { User, UserRole } from '../types/Role';
import { login as loginApi, clearAuthTokens } from '../api/login';
import { API_URL } from '../services/api-config';
import { logger } from '@/utils/logger';
import {
  userAtom,
  userBasicInfoAtom,
  isAuthLoadingAtom,
  isAuthenticatedAtom,
  loginActionAtom,
  logoutActionAtom,
  setLoadingAtom,
} from '../store/auth';

interface AuthContextType {
  user: User | null;
  isLoaded: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{
    success: boolean;
    message?: string;
    user?: User;
  }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  logger.log('AuthProvider: Component mounting/initializing');

  const [user, setUser] = useAtom(userAtom);
  const [userBasicInfo, setUserBasicInfo] = useAtom(userBasicInfoAtom);
  const [isLoading] = useAtom(isAuthLoadingAtom);
  const [isAuthenticated] = useAtom(isAuthenticatedAtom);
  const [, loginAction] = useAtom(loginActionAtom);
  const [, logoutAction] = useAtom(logoutActionAtom);
  const [, setLoadingAction] = useAtom(setLoadingAtom);

  logger.log('AuthProvider: Current state on mount:', {
    hasUser: !!user,
    isLoading,
    isAuthenticated,
    username: user?.username || 'none'
  });

  const isLoaded = !isLoading;

  // Fetch user data from backend using cookie auth
  const fetchUserData = useCallback(async () => {
    const userResponse = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { 'Accept': 'application/json' },
      credentials: 'include',
    });

    if (!userResponse.ok) {
      throw new Error(`Auth check failed: ${userResponse.status}`);
    }

    const member = await userResponse.json();

    if (!member || !member.id) {
      throw new Error('No user data returned from /auth/me');
    }

    const rawRole = member.typeName || member.role || member["@type"] || 'user';
    const mappedRole = mapTypeNameToRole(rawRole);

    // Map backend name to firstName/lastName for frontend
    const nameParts = (member.name || '').split(' ').filter((part: string) => part.length > 0);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const userData: User = {
      id: member.id,
      username: member.username || member.email,
      role: mappedRole,
      email: member.email,
      firstName: firstName,
      lastName: lastName,
    };

    loginAction({ user: userData });
    logger.log('AuthContext: User data set from /auth/me:', userData);
    return userData;
  }, [loginAction]);

  // Check for existing session on initial load
  useEffect(() => {
    // Prevent unnecessary reinitializations if we already have valid auth state
    if (user && !isLoading) {
      logger.log('AuthContext: Skipping checkAuth - already authenticated');
      return;
    }

    const checkAuth = async () => {
      logger.log('AuthContext: Starting checkAuth...');
      setLoadingAction(true);
      try {
        // Restore user from localStorage basic info immediately for fast UI render
        if (!user && userBasicInfo && userBasicInfo.id && userBasicInfo.username) {
          logger.log('AuthContext: Restoring user from basic info:', userBasicInfo);
          const restoredUser: User = {
            id: userBasicInfo.id,
            username: userBasicInfo.username,
            role: userBasicInfo.role as UserRole,
            email: userBasicInfo.email,
            firstName: userBasicInfo.firstName,
            lastName: userBasicInfo.lastName,
          };
          setUser(restoredUser);
        }

        // Verify session with backend (cookie sent automatically)
        await fetchUserData();
        logger.log('AuthContext: Session verified via /auth/me');
      } catch (error) {
        logger.log('AuthContext: No valid session, clearing auth state:', error);
        clearAuthTokens();
        logoutAction();
      } finally {
        setLoadingAction(false);
      }
    };

    checkAuth();
  }, []); // Empty dependency array - should only run once on mount

  // Login function
  const login = async (username: string, password: string) => {
    logger.log('AuthContext: Starting login for username:', username);

    try {
      const result = await loginApi(username, password);
      logger.log('AuthContext: Login API result:', result);

      if (result.success) {
        logger.log('AuthContext: Login API successful, fetching user data...');

        try {
          // Cookie is now set by backend, fetch full user data
          const userData = await fetchUserData();
          logger.log('AuthContext: User data fetched successfully:', userData);

          return {
            success: true,
            message: 'Login successful',
            user: userData
          };
        } catch (fetchError) {
          logger.error('AuthContext: Failed to fetch user data after login:', fetchError);

          // Fallback: use user info from login response
          if (result.user) {
            const userRole = mapTypeNameToRole(result.user?.role?.type || result.user?.role || 'user');

            const userData: User = {
              id: result.userId || result.user.id || 0,
              username: result.user.username || username,
              role: userRole,
              email: result.user.email,
              firstName: result.user.firstName || '',
              lastName: result.user.lastName || '',
            };

            logger.log('AuthContext: Using fallback user data from login response:', userData);
            loginAction({ user: userData });

            return {
              success: true,
              message: 'Login successful',
              user: userData
            };
          }

          return {
            success: false,
            message: 'Login succeeded but failed to load user data'
          };
        }
      } else {
        logger.log('AuthContext: Login API failed:', result.message);
        return {
          success: false,
          message: result.message || 'Login failed. Please check your credentials.'
        };
      }
    } catch (error) {
      logger.error('AuthContext: Login error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred during login.'
      };
    }
  };

  // Logout function
  const logout = () => {
    clearAuthTokens();
    logoutAction(); // This will clear user from Jotai store
  };

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      await fetchUserData();
    } catch (error) {
      logger.error('Failed to refresh user data:', error);
      logout();
    }
  }, [fetchUserData]);

  // Create the context value
  const contextValue = {
    user,
    isLoaded,
    isAuthenticated,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

function mapTypeNameToRole(typeName: string): UserRole {
  logger.log('mapTypeNameToRole: input typeName:', typeName);

  // Normalize to lowercase for comparison
  const normalized = typeName.toLowerCase();

  switch (normalized) {
    case 'admin': return UserRole.ADMIN;
    case 'fitter': return UserRole.FITTER;
    case 'factory': return UserRole.SUPPLIER;
    case 'supplier': return UserRole.SUPPLIER;
    case 'supervisor': return UserRole.SUPERVISOR;
    case 'user': return UserRole.USER;
    case 'customsaddler': return UserRole.USER;
    case 'role_admin': return UserRole.ADMIN;
    case 'role_fitter': return UserRole.FITTER;
    case 'role_supplier': return UserRole.SUPPLIER;
    case 'role_supervisor': return UserRole.SUPERVISOR;
    case 'role_user': return UserRole.USER;
    default:
      logger.log('mapTypeNameToRole: no match found, defaulting to USER');
      return UserRole.USER;
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');

  logger.log('useAuth: context value:', {
    user: ctx.user,
    isLoaded: ctx.isLoaded,
    isAuthenticated: ctx.isAuthenticated,
  });

  return ctx;
}
