import * as fs from 'fs';
import * as path from 'path';

/**
 * Shared authentication state for the E2E suite.
 *
 * `POST /api/v1/auth/email/login` is throttled (5/sec, 20/min, 60/hour per
 * client).  Logging in from every spec's `beforeAll` — and again from every
 * `beforeEach` in the UI specs — burned ~42 logins per run, and Playwright
 * restarts the worker on failure so each of the 3 retries re-ran those hooks.
 * The suite reliably exhausted the hourly window and then failed on 429s that
 * no amount of backoff could clear.
 *
 * Instead globalSetup logs in ONCE per role and persists the session cookie as
 * a Playwright storageState file.  Specs open contexts from that file, so the
 * whole run costs one login per role no matter how many workers or retries
 * are involved.  Auth is a plain httpOnly cookie scoped to the parent domain,
 * so a single storageState works for both API and browser contexts.
 */

export const ROLES = [
  'admin',
  'supervisor',
  'fitter',
  'factory',
  'user',
] as const;

export type Role = (typeof ROLES)[number];

export interface RoleCredentials {
  email: string;
  password: string;
}

/**
 * Credentials per role.
 *
 * CI only provisions admin and fitter (see
 * .github/workflows/scripts/e2e-create-users.js); the remaining roles fall
 * back to local seed data and simply fail to log in against staging, which
 * callers handle by skipping those tests.
 */
export const ROLE_CREDENTIALS: Record<Role, RoleCredentials> = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@omsaddle.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'AdminPass123!',
  },
  supervisor: {
    email: process.env.TEST_SUPERVISOR_EMAIL || 'supervisor@omsaddle.com',
    password: process.env.TEST_SUPERVISOR_PASSWORD || 'SupervisorPass123!',
  },
  fitter: {
    email: process.env.TEST_FITTER_EMAIL || 'sarah.thompson@fitters.com',
    password: process.env.TEST_FITTER_PASSWORD || 'FitterPass123!',
  },
  factory: {
    email: process.env.TEST_FACTORY_EMAIL || 'factory-test@omsaddle.com',
    password: process.env.TEST_FACTORY_PASSWORD || 'FactoryPass123!',
  },
  user: {
    email: process.env.TEST_USER_EMAIL || 'testuser',
    password: process.env.TEST_USER_PASSWORD || 'TestUser123!',
  },
};

/** Directory holding the per-role storageState files (gitignored). */
export const AUTH_DIR = path.join(__dirname, '..', '.auth');

/** Written by globalSetup to record which roles actually authenticated. */
const MANIFEST_PATH = path.join(AUTH_DIR, 'manifest.json');

export interface AuthManifest {
  /** Roles whose storageState file exists and carries a session cookie. */
  authenticated: Role[];
  /** Roles that could not log in, with the reason, for skip messages. */
  failed: Record<string, string>;
}

export function authStatePath(role: Role): string {
  return path.join(AUTH_DIR, `${role}.json`);
}

export function writeAuthManifest(manifest: AuthManifest): void {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

/**
 * Read the manifest written by globalSetup.
 *
 * Returns an empty manifest when absent so that a spec run without globalSetup
 * (e.g. `--no-deps`, or an editor running a single test) degrades to skipping
 * rather than throwing during collection.
 */
export function readAuthManifest(): AuthManifest {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')) as AuthManifest;
  } catch {
    return { authenticated: [], failed: {} };
  }
}

export function isAuthenticated(role: Role): boolean {
  return readAuthManifest().authenticated.includes(role);
}

/** Reason a role is unavailable, for use in `test.skip()` messages. */
export function authFailureReason(role: Role): string {
  const manifest = readAuthManifest();
  return (
    manifest.failed[role] ||
    'no stored auth state — globalSetup did not run or the login failed'
  );
}

/** Base URL of the API, matching the resolution order used across the suite. */
export function resolveApiUrl(): string {
  if (process.env.STAGING_API_URL && process.env.ENVIRONMENT === 'staging') {
    return process.env.STAGING_API_URL;
  }
  if (process.env.E2E_API_URL) {
    return process.env.E2E_API_URL.replace(/\/api$/, '');
  }
  return 'http://localhost:3001';
}

/** Headers every JSON API context in the suite sends. */
export const API_CONTEXT_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': 'OMS-E2E-Tests/1.0.0',
} as const;

/** Options for opening a pre-authenticated API request context for `role`. */
export function apiContextOptions(role: Role) {
  return {
    extraHTTPHeaders: { ...API_CONTEXT_HEADERS },
    ignoreHTTPSErrors: true,
    storageState: authStatePath(role),
  };
}
