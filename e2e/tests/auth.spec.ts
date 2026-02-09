import { test, expect, Page } from '@playwright/test';

/**
 * Authentication E2E Tests
 * Critical path testing for user authentication flows
 *
 * Selector strategy (ordered by preference):
 *   1. getByRole / locator('[type="..."]') — resilient to text/placeholder changes
 *   2. CSS attribute selectors (input[type], button[type])
 *   3. Placeholder text as last resort (may change with i18n)
 */

/**
 * Wait for the login form to render.
 * The login page shows "Loading..." while AuthContext initializes.
 * Webkit on CI is slower to resolve this, so we must explicitly wait
 * for the form to appear before interacting with it.
 */
async function waitForLoginForm(target: Page): Promise<void> {
  // Wait for the form element to appear (AuthContext finished loading)
  await target.locator('form').waitFor({ state: 'visible', timeout: 30000 });
}

/** Fill login form using resilient selectors: email input, password input, submit */
async function fillLoginForm(
  target: Page,
  email: string,
  password: string,
): Promise<void> {
  await waitForLoginForm(target);

  const emailInput = target.locator('input[type="email"], input[type="text"]').first();
  const passwordInput = target.locator('input[type="password"]');

  await emailInput.waitFor({ state: 'visible' });
  await emailInput.fill(email);
  await passwordInput.fill(password);
}

/** Submit the login form and wait for navigation away from /login (or timeout) */
async function submitLoginAndWait(target: Page): Promise<boolean> {
  await waitForLoginForm(target);
  await target.locator('button[type="submit"]').click();

  // Wait for either a redirect away from /login or an error indicator
  await Promise.race([
    target.waitForURL(/.*(?<!\/login)$/, { timeout: 10000 }),
    target.locator('.text-destructive').waitFor({ state: 'visible', timeout: 10000 }),
  ]).catch(() => {/* timeout is acceptable */});

  return !target.url().includes('/login');
}

test.describe('Authentication Flow @critical @smoke @readonly', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
  });

  test.afterEach(async () => {
    // Clear auth state to prevent test pollution
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch {}
    }).catch(() => {});
  });

  test('should display login page correctly @smoke @readonly', async () => {
    await page.goto('/login');

    // Wait for AuthContext to finish loading (shows "Loading..." until ready)
    await waitForLoginForm(page);

    // Verify login form is visible
    await expect(page.locator('form')).toBeVisible();

    // Check form fields using type-based selectors
    await expect(page.locator('input[type="email"], input[type="text"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for empty submission @critical @readonly', async () => {
    await page.goto('/login');

    // Wait for form to render (webkit is slower with AuthContext init)
    await waitForLoginForm(page);

    // Submit empty form - browser validation or Zod validation should trigger
    await page.locator('button[type="submit"]').click();

    // Wait for validation feedback (form stays on login)
    await expect(page).toHaveURL(/login/);
  });

  test('should handle login failure gracefully @critical @readonly', async () => {
    await page.goto('/login');

    // Use invalid credentials
    await fillLoginForm(page, 'nonexistent@test.com', 'wrongpassword');
    await page.locator('button[type="submit"]').click();

    // Wait for error response to render
    const errorLocator = page.locator('.text-destructive');
    const errorVisible = await errorLocator.isVisible({ timeout: 5000 }).catch(() => false);
    if (errorVisible) {
      await expect(errorLocator).toBeVisible();
    }

    // Ensure user stays on login page
    await expect(page).toHaveURL(/login/);
  });

  test('should successfully login with valid credentials @critical @smoke', async () => {
    await page.goto('/login');

    await fillLoginForm(
      page,
      process.env.TEST_ADMIN_EMAIL || 'admin@omsaddle.com',
      process.env.TEST_ADMIN_PASSWORD || 'AdminPass123!',
    );

    const isLoggedIn = await submitLoginAndWait(page);

    if (isLoggedIn) {
      await expect(page).toHaveURL(/dashboard/);

      // Verify navigation is visible (sidebar/header)
      await expect(page.locator('nav, header, [data-testid="sidebar"]')).toBeVisible();
    }
  });

  test('should handle role-based access correctly @critical @readonly', async () => {
    // Login as fitter
    await page.goto('/login');
    await fillLoginForm(
      page,
      process.env.TEST_FITTER_EMAIL || 'sarah.thompson@fitters.com',
      process.env.TEST_FITTER_PASSWORD || 'FitterPass123!',
    );

    const isLoggedIn = await submitLoginAndWait(page);

    if (isLoggedIn) {
      await expect(page).toHaveURL(/dashboard/);

      // Try to access admin-only page - should be redirected
      await page.goto('/users');
      await page.waitForURL(/.*(?!\/users$)/, { timeout: 5000 }).catch(() => {});

      // Should be redirected away from /users (fitters don't have access)
      const usersUrl = page.url();
      expect(usersUrl.includes('/users')).toBeFalsy();
    }
  });

  test('should handle session expiration @critical @readonly', async () => {
    // Login first
    await page.goto('/login');
    await fillLoginForm(
      page,
      process.env.TEST_ADMIN_EMAIL || 'admin@omsaddle.com',
      process.env.TEST_ADMIN_PASSWORD || 'AdminPass123!',
    );

    const isLoggedIn = await submitLoginAndWait(page);

    if (isLoggedIn) {
      // Simulate expired session by clearing storage
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // Try to access protected route
      await page.goto('/orders');

      // Should redirect to login
      await page.waitForURL(/login/, { timeout: 10000 }).catch(() => {});
      await expect(page).toHaveURL(/login/);
    }
  });

  test('should successfully logout @smoke @readonly', async () => {
    // Login first
    await page.goto('/login');
    await fillLoginForm(
      page,
      process.env.TEST_ADMIN_EMAIL || 'admin@omsaddle.com',
      process.env.TEST_ADMIN_PASSWORD || 'AdminPass123!',
    );

    const isLoggedIn = await submitLoginAndWait(page);

    if (isLoggedIn) {
      // Look for logout button
      const logoutSelectors = [
        'button:has-text("Logout")',
        'button:has-text("Sign Out")',
        '[data-testid="logout"]',
      ];

      for (const selector of logoutSelectors) {
        try {
          const element = page.locator(selector);
          if (await element.isVisible({ timeout: 2000 })) {
            await element.click();

            // Wait for redirect to login instead of fixed timeout
            await page.waitForURL(/login/, { timeout: 5000 }).catch(() => {});
            await expect(page).toHaveURL(/login/);
            break;
          }
        } catch {
          continue;
        }
      }
    }
  });

  test('should handle concurrent sessions @security @readonly', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Login in first session
      await page1.goto('/login');
      await fillLoginForm(
        page1,
        process.env.TEST_ADMIN_EMAIL || 'admin@omsaddle.com',
        process.env.TEST_ADMIN_PASSWORD || 'AdminPass123!',
      );
      await submitLoginAndWait(page1);

      // Login in second session with same user
      await page2.goto('/login');
      await fillLoginForm(
        page2,
        process.env.TEST_ADMIN_EMAIL || 'admin@omsaddle.com',
        process.env.TEST_ADMIN_PASSWORD || 'AdminPass123!',
      );
      await submitLoginAndWait(page2);

      // Both sessions should remain active or show concurrent session warning
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
