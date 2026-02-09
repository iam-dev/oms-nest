import { atom } from 'jotai';
import { User } from '../types/Role';
import { logger } from '@/utils/logger';

// User atom - stored in memory only for security (critical user data should not persist)
export const userAtom = atom<User | null>(null);

// Loading state atom - starts as true to prevent premature redirects before auth check completes
export const isAuthLoadingAtom = atom<boolean>(true);

// Derived atom for authentication status - based on user presence only (token is httpOnly cookie)
export const isAuthenticatedAtom = atom((get) => {
  const user = get(userAtom);
  return !!user;
});

// Action atoms
export const loginActionAtom = atom(
  null,
  (get, set, { user }: { user: User }) => {
    logger.log('loginActionAtom: Setting user:', { user });
    set(userAtom, user);
    set(isAuthLoadingAtom, false);
    logger.log('loginActionAtom: All atoms set');
  }
);

export const logoutActionAtom = atom(
  null,
  (get, set) => {
    set(userAtom, null);
    set(isAuthLoadingAtom, false);
  }
);

export const setLoadingAtom = atom(
  null,
  (get, set, loading: boolean) => {
    set(isAuthLoadingAtom, loading);
  }
);
