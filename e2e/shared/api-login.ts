import type { APIRequestContext, APIResponse } from '@playwright/test';

interface ApiLoginOptions {
  attempts?: number;
  initialBackoffMs?: number;
}

/**
 * POST /api/v1/auth/email/login with retry-on-429 (Too Many Requests).
 *
 * Staging applies a ThrottlerGuard to the login endpoint (5/sec, 20/min,
 * 60/hour). With Playwright's fullyParallel mode the suite easily bursts
 * past the per-second window, so the first hit may be 429 even with valid
 * credentials. Back off and retry; everything else (200, 401, 422, …) is
 * returned to the caller as-is.
 */
export async function loginApiWithRetry(
  context: APIRequestContext,
  apiUrl: string,
  email: string,
  password: string,
  options: ApiLoginOptions = {},
): Promise<APIResponse> {
  const attempts = options.attempts ?? 5;
  const initialBackoffMs = options.initialBackoffMs ?? 1500;

  let lastResponse: APIResponse | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    lastResponse = await context.post(`${apiUrl}/api/v1/auth/email/login`, {
      data: { email, password },
    });
    if (lastResponse.status() !== 429) {
      return lastResponse;
    }
    // Exponential backoff: 1.5s, 3s, 6s, 12s, 24s (caps at the throttler's
    // 60s medium window once you get to attempt 5).
    const delay = Math.min(initialBackoffMs * 2 ** attempt, 30_000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  // All attempts returned 429 — surface the last response so the caller's
  // expect() shows the throttle status in the failure message.
  return lastResponse as APIResponse;
}
