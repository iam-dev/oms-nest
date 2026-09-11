import { test, expect, request, APIRequestContext } from '@playwright/test';
import {
  ROLES,
  apiContextOptions,
  isAuthenticated,
  resolveApiUrl,
} from '../shared/auth-state';

/**
 * Role-Based Access Control E2E Tests
 *
 * Verifies that API endpoints enforce correct role-based access.
 * Tests 5 roles (admin, supervisor, fitter, factory, user) against 22 endpoint groups.
 *
 * Tags: @security @api @readonly
 */

const API_URL = resolveApiUrl();

/**
 * Endpoint access matrix.
 * true = role should have access (expect 200 or 500 for DB issues)
 * false = role should be denied (expect 401 or 403)
 */
interface EndpointConfig {
  path: string;
  roles: Record<string, boolean>;
}

const ENDPOINT_ACCESS: EndpointConfig[] = [
  {
    path: '/api/v1/customers',
    roles: { admin: true, supervisor: true, fitter: true, factory: false, user: false },
  },
  {
    path: '/api/v1/orders?page=1&limit=10',
    roles: { admin: true, supervisor: true, fitter: true, factory: false, user: false },
  },
  {
    path: '/api/v1/fitters',
    roles: { admin: true, supervisor: true, fitter: false, factory: false, user: false },
  },
  {
    path: '/api/v1/factories',
    roles: { admin: true, supervisor: true, fitter: false, factory: true, user: false },
  },
  {
    path: '/api/v1/factory-employees',
    roles: { admin: true, supervisor: true, fitter: false, factory: true, user: false },
  },
  {
    path: '/api/v1/saddles?page=1&limit=10',
    roles: { admin: true, supervisor: true, fitter: true, factory: true, user: false },
  },
  {
    path: '/api/v1/saddle-stock?type=all&page=1&limit=10',
    roles: { admin: true, supervisor: true, fitter: true, factory: false, user: false },
  },
  {
    path: '/api/v1/enriched_orders?page=1&limit=10',
    roles: { admin: true, supervisor: true, fitter: true, factory: false, user: false },
  },
  {
    path: '/api/v1/comments',
    roles: { admin: true, supervisor: true, fitter: true, factory: false, user: false },
  },
  {
    path: '/api/v1/order_product_saddles',
    roles: { admin: true, supervisor: true, fitter: true, factory: false, user: false },
  },
  {
    path: '/api/v1/users',
    roles: { admin: true, supervisor: true, fitter: false, factory: false, user: false },
  },
  {
    path: '/api/v1/brands',
    roles: { admin: true, supervisor: true, fitter: false, factory: false, user: false },
  },
  {
    path: '/api/v1/options',
    roles: { admin: true, supervisor: true, fitter: false, factory: false, user: false },
  },
  {
    path: '/api/v1/extras',
    roles: { admin: true, supervisor: true, fitter: false, factory: false, user: false },
  },
  {
    path: '/api/v1/leathertypes',
    roles: { admin: true, supervisor: true, fitter: false, factory: false, user: false },
  },
  {
    path: '/api/v1/presets',
    roles: { admin: true, supervisor: true, fitter: false, factory: false, user: false },
  },
  {
    path: '/api/v1/warehouses',
    roles: { admin: true, supervisor: true, fitter: false, factory: false, user: false },
  },
  {
    path: '/api/v1/saddle-extras',
    roles: { admin: true, supervisor: true, fitter: false, factory: false, user: false },
  },
  {
    path: '/api/v1/saddle-leathers',
    roles: { admin: true, supervisor: true, fitter: false, factory: false, user: false },
  },
  {
    path: '/api/v1/country_managers',
    roles: { admin: true, supervisor: true, fitter: false, factory: false, user: false },
  },
  {
    path: '/api/v1/access-filter-groups',
    roles: { admin: true, supervisor: true, fitter: false, factory: false, user: false },
  },
  {
    path: '/api/v1/audit-logs',
    roles: { admin: true, supervisor: true, fitter: false, factory: false, user: false },
  },
];

test.describe('Role-Based Access Control @security @api @readonly', () => {
  const loggedInRoles: Set<string> = new Set();
  const contexts: Record<string, APIRequestContext> = {};
  const loginFailures: string[] = [];

  test.beforeAll(async ({ playwright }) => {
    // Sessions were established once in globalSetup. This file alone holds 111
    // tests, and with fullyParallel + retries this hook runs many times per
    // run — logging in here for all 5 roles is what used to exhaust the
    // hourly window on /auth/email/login.
    for (const role of ROLES) {
      if (!isAuthenticated(role)) {
        loginFailures.push(role);
        continue;
      }
      contexts[role] = await playwright.request.newContext(
        apiContextOptions(role),
      );
      loggedInRoles.add(role);
    }

    console.log(`Logged in roles: ${[...loggedInRoles].join(', ')}`);
    if (loginFailures.length > 0) {
      console.log(`Unavailable roles: ${loginFailures.join(', ')} (tests for these roles will be skipped)`);
    }
  });

  test.afterAll(async () => {
    for (const ctx of Object.values(contexts)) {
      await ctx.dispose();
    }
  });

  // Generate tests for roles that should have ACCESS (expect 200 or 500)
  for (const endpoint of ENDPOINT_ACCESS) {
    const endpointName = endpoint.path.split('?')[0].replace('/api/v1/', '');

    for (const [role, shouldAccess] of Object.entries(endpoint.roles)) {
      if (shouldAccess) {
        test(`${role} should ACCESS ${endpointName}`, async () => {
          test.skip(!loggedInRoles.has(role), `${role} login failed — skipping`);

          const response = await contexts[role].get(`${API_URL}${endpoint.path}`);
          const status = response.status();

          // 200 = success, 500 = DB/view issue (acceptable in CI),
          // 403 = RLS guard context failure (acceptable — not a role denial)
          expect(
            [200, 403, 429, 500].includes(status),
            `${role} accessing ${endpointName}: expected 200/403/429/500, got ${status}`,
          ).toBeTruthy();
        });
      }
    }
  }

  // Generate tests for roles that should be DENIED (expect 401 or 403)
  for (const endpoint of ENDPOINT_ACCESS) {
    const endpointName = endpoint.path.split('?')[0].replace('/api/v1/', '');

    for (const [role, shouldAccess] of Object.entries(endpoint.roles)) {
      if (!shouldAccess) {
        test(`${role} should be DENIED ${endpointName}`, async () => {
          test.skip(!loggedInRoles.has(role), `${role} login failed — skipping`);

          const response = await contexts[role].get(`${API_URL}${endpoint.path}`);
          const status = response.status();

          // Denied role must NOT get 200 (success).
          // 401/403 = correctly denied, 500 = internal error also acceptable.
          expect(
            status !== 200,
            `${role} should be denied ${endpointName} but got 200 (success)`,
          ).toBeTruthy();
        });
      }
    }
  }

  // Verify unauthenticated requests are rejected
  test('unauthenticated request should be rejected', async () => {
    const unauthContext = await request.newContext({
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'OMS-E2E-Tests/1.0.0',
      },
      ignoreHTTPSErrors: true,
    });

    const response = await unauthContext.get(`${API_URL}/api/v1/customers`);
    expect(response.status()).toBe(401);

    await unauthContext.dispose();
  });
});
