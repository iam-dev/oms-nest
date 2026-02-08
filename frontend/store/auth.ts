import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { User } from '../types/Role';
import { logger } from '@/utils/logger';

// User atom - stored in memory only for security (critical user data should not persist)
export const userAtom = atom<User | null>(null);

// User basic info atom - stored in localStorage for service access (minimal data only)
export const userBasicInfoAtom = atomWithStorage<{ id: number; username: string; role: string; firstName?: string; lastName?: string; email?: string } | null>('auth_user', null);

// Loading state atom - starts as true to prevent premature redirects before auth check completes
export const isAuthLoadingAtom = atom<boolean>(true);

// Derived atom for authentication status - based on user presence only (token is httpOnly cookie)
export const isAuthenticatedAtom = atom((get) => {
  const user = get(userAtom);
  const userBasicInfo = get(userBasicInfoAtom);

  // Consider authenticated if we have full user data or basic user info
  return !!(user || userBasicInfo);
});

// Action atoms
export const loginActionAtom = atom(
  null,
  (get, set, { user }: { user: User }) => {
    logger.log('loginActionAtom: Setting user:', { user });
    set(userAtom, user);
    // Store minimal user info for service access
    set(userBasicInfoAtom, {
      id: Number(user.id),
      username: user.username,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email
    });
    set(isAuthLoadingAtom, false);
    logger.log('loginActionAtom: All atoms set');
  }
);

export const logoutActionAtom = atom(
  null,
  (get, set) => {
    set(userAtom, null);
    set(userBasicInfoAtom, null);
    set(isAuthLoadingAtom, false);
  }
);

export const setLoadingAtom = atom(
  null,
  (get, set, loading: boolean) => {
    set(isAuthLoadingAtom, loading);
  }
);
