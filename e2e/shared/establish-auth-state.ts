import { request } from '@playwright/test';
import * as fs from 'fs';

import {
  API_CONTEXT_HEADERS,
  AUTH_DIR,
  AuthManifest,
  ROLES,
  ROLE_CREDENTIALS,
  Role,
  authStatePath,
  writeAuthManifest,
} from './auth-state';
import { loginApiWithRetry } from './api-login';

/** Spacing between logins: the login route allows 5/sec. */
const DELAY_BETWEEN_LOGINS_MS = 1_000;

/**
 * Log in once per role and persist each session as a storageState file.
 *
 * Runs from globalSetup, i.e. exactly once per `playwright test` invocation —
 * not per worker and not per retry. That is the whole point: it caps the
 * suite's login count at one per role, keeping it clear of the throttle on
 * POST /api/v1/auth/email/login.
 *
 * Roles that cannot log in are recorded in the manifest rather than thrown,
 * because CI only provisions admin and fitter. Admin is the exception: nearly
 * every spec needs it, so failing fast there beats emitting dozens of
 * identical downstream failures.
 */
export async function establishAuthState(apiUrl: string): Promise<void> {
  console.log('🔐 Establishing shared auth state (one login per role)...');

  // Clear stale state so a failed login can never silently reuse the previous
  // run's cookie.
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const manifest: AuthManifest = { authenticated: [], failed: {} };

  for (const role of ROLES) {
    const credentials = ROLE_CREDENTIALS[role];
    const context = await request.newContext({
      extraHTTPHeaders: { ...API_CONTEXT_HEADERS },
      ignoreHTTPSErrors: true,
    });

    try {
      const response = await loginApiWithRetry(
        context,
        apiUrl,
        credentials.email,
        credentials.password,
      );

      if (response.ok()) {
        // Playwright stored the Set-Cookie from the login response; persisting
        // the context's storageState captures the session cookie for reuse by
        // both API request contexts and browser contexts.
        await context.storageState({ path: authStatePath(role) });
        manifest.authenticated.push(role);
        console.log(`  ✅ ${role} (${credentials.email})`);
      } else {
        const body = await response.text().catch(() => '(no body)');
        manifest.failed[role] =
          `login returned ${response.status()}: ${body.slice(0, 200)}`;
        console.log(
          `  ⚠️  ${role} (${credentials.email}) — ${manifest.failed[role]}`,
        );
      }
    } catch (error) {
      manifest.failed[role] = `login threw: ${(error as Error).message}`;
      console.log(`  ⚠️  ${role} (${credentials.email}) — ${manifest.failed[role]}`);
    } finally {
      await context.dispose();
    }

    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_LOGINS_MS));
  }

  writeAuthManifest(manifest);

  if (!manifest.authenticated.includes('admin' as Role)) {
    throw new Error(
      `❌ Admin login failed, so most of the suite cannot run: ${manifest.failed['admin']}`,
    );
  }

  const skipped = Object.keys(manifest.failed);
  console.log(
    `✅ Auth state ready for: ${manifest.authenticated.join(', ')}` +
      (skipped.length ? ` (unavailable: ${skipped.join(', ')})` : ''),
  );
}
