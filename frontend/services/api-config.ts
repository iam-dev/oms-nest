export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Sentinel error thrown when a token refresh fails.
 * Callers can `instanceof` this to skip redundant toast/parse work.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired — please log in again.');
    this.name = 'SessionExpiredError';
  }
}

// FE-005: track the in-flight refresh as a module-level promise.
// Only the setter clears isRefreshing/refreshPromise; concurrent callers
// simply await the existing promise without mutating state.
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchWithRefresh(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...options, credentials: 'include' });

  if (res.status === 401) {
    // FE-005: only the first caller starts the refresh; others share the promise.
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshToken().finally(() => {
        // Only the setter clears state so concurrent awaits don't race.
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    // All callers (including the setter) await the shared promise.
    const refreshed = await refreshPromise;

    if (refreshed) {
      return fetch(url, { ...options, credentials: 'include' });
    }

    // FE-006: throw a typed sentinel so callers can distinguish session
    // expiry from other errors and skip toast/parse if desired.
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new SessionExpiredError();
  }

  return res;
}
