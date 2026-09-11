"use client";
import React, { createContext, useContext, useEffect, ReactNode, useCallback } from 'react';
import { useAtom } from 'jotai';
import { User, UserRole } from '../types/Role';
import { login as loginApi, clearAuthTokens } from '../api/login';
import { API_URL } from '../services/api-config';
import { logger } from '@/utils/logger';
import {
  userAtom,
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

/**
 * The server answered the session probe and said no. Distinct from a
 * transport failure, where we learned nothing about the session at all.
 */
class AuthCheckRejectedError extends Error {
  constructor(public readonly status: number) {
    super(`Auth check failed: ${status}`);
    this.name = 'AuthCheckRejectedError';
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  logger.log('AuthProvider: initializing');

  const [user] = useAtom(userAtom);
  const [isLoading] = useAtom(isAuthLoadingAtom);
  const [isAuthenticated] = useAtom(isAuthenticatedAtom);
  const [, loginAction] = useAtom(loginActionAtom);
  const [, logoutAction] = useAtom(logoutActionAtom);
  const [, setLoadingAction] = useAtom(setLoadingAtom);

  logger.log('AuthProvider: state:', { hasUser: !!user, isLoading, isAuthenticated });

  const isLoaded = !isLoading;

  // Fetch user data from backend using cookie auth
  const fetchUserData = useCallback(async () => {
    const userResponse = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { 'Accept': 'application/json' },
      credentials: 'include',
    });

    if (!userResponse.ok) {
      throw new AuthCheckRejectedError(userResponse.status);
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
    logger.log('AuthContext: user loaded, role:', userData.role);
    return userData;
  }, [loginAction]);

  // Check for existing session on initial load
  useEffect(() => {
    // Prevent unnecessary reinitializations if we already have valid auth state
    if (user && !isLoading) {
      logger.log('AuthContext: Skipping checkAuth - already authenticated');
      return;
    }

    let cancelled = false;

    const checkAuth = async () => {
      logger.log('AuthContext: Starting checkAuth...');
      setLoadingAction(true);
      try {
        // Verify session with backend (cookie sent automatically)
        await fetchUserData();
        logger.log('AuthContext: Session verified via /auth/me');
      } catch (error) {
        // A transport failure tells us nothing about the session — the cookie
        // may well still be valid — so retry once before tearing it down.
        // React StrictMode fires this effect twice in dev, racing two probes,
        // and a dropped one used to log a perfectly good session out and
        // bounce the page to /login. Real users hit the same thing when the
        // network blips during a refresh. An HTTP response IS an answer, so
        // don't retry that.
        const serverAnswered = error instanceof AuthCheckRejectedError;
        if (!serverAnswered && !cancelled) {
          try {
            await fetchUserData();
            logger.log('AuthContext: Session verified via /auth/me (after retry)');
            return;
          } catch {
            logger.log('AuthContext: /auth/me still unreachable after retry');
          }
        }
        if (!cancelled) {
          logger.log('AuthContext: no valid session, clearing auth state');
          logoutAction();
        }
      } finally {
        if (!cancelled) {
          setLoadingAction(false);
        }
      }
    };

    checkAuth();

    return () => {
      // Stop a torn-down run (StrictMode's first pass) from clobbering the
      // state that the live one is establishing.
      cancelled = true;
    };
  // TODO(react-hooks): intentionally empty — this effect must run exactly once on mount
  // to restore an existing session. Adding fetchUserData/user/isLoading/logoutAction/
  // setLoadingAction as deps would trigger re-auth on every state change, causing an
  // infinite authentication loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Login function
  const login = async (username: string, password: string) => {
    logger.log('AuthContext: login attempt');

    try {
      const result = await loginApi(username, password);
      logger.log('AuthContext: login result:', result.success ? 'success' : 'failed');

      if (result.success) {
        logger.log('AuthContext: Login API successful, fetching user data...');

        try {
          // Cookie is now set by backend, fetch full user data
          const userData = await fetchUserData();
          logger.log('AuthContext: user data fetched successfully');

          return {
            success: true,
            message: 'Login successful',
            user: userData
          };
        } catch (fetchError) {
          logger.error('AuthContext: Failed to fetch user data after login:', fetchError);

          // Fallback: use user info from login response
          if (result.user) {
            const u = result.user;
            const rawRole = u['role'];
            const roleTypeName =
              (typeof rawRole === 'object' && rawRole !== null && 'type' in rawRole && typeof (rawRole as Record<string, unknown>)['type'] === 'string')
                ? (rawRole as Record<string, unknown>)['type'] as string
                : typeof rawRole === 'string'
                  ? rawRole
                  : 'user';
            const userRole = mapTypeNameToRole(roleTypeName);

            const userData: User = {
              id: (result.userId ?? (typeof u['id'] === 'string' || typeof u['id'] === 'number' ? u['id'] : 0)) as string | number,
              username: typeof u['username'] === 'string' ? u['username'] : username,
              role: userRole,
              email: typeof u['email'] === 'string' ? u['email'] : undefined,
              firstName: typeof u['firstName'] === 'string' ? u['firstName'] : '',
              lastName: typeof u['lastName'] === 'string' ? u['lastName'] : '',
            };

            logger.log('AuthContext: using fallback user data from login response');
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
        logger.log('AuthContext: login failed');
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
  // TODO(react-hooks): `logout` is defined in the same render scope without useCallback
  // and would create a new reference each render, making refreshUser a new function on
  // every render if added. The logout function itself only calls stable Jotai actions
  // and clearAuthTokens, so the stale-closure risk is negligible.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  logger.log('mapTypeNameToRole:', typeName);

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

  logger.log('useAuth: authenticated:', ctx.isAuthenticated, '| loaded:', ctx.isLoaded);

  return ctx;
}
