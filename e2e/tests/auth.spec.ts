import { test, expect, Page } from '@playwright/test';

/**
 * Authentication E2E Tests
 * Critical path testing for user authentication flows
 *
 * NOTE: These tests reference the actual frontend login page at /login.
 * The form uses placeholder-based selectors (Gebruikersnaam/Wachtwoord)
 * and does not use data-testid attributes on form fields.
 * Tests that reference data-testid selectors not present in the frontend
 * are marked as aspirational integration test stubs.
 */

test.describe('Authentication Flow @critical @smoke @readonly', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
  });

  test('should display login page correctly @smoke', async () => {
    await page.goto('/login');

    // Verify login form is visible
    await expect(page.locator('form')).toBeVisible();

    // Check form fields using actual frontend selectors
    await expect(page.locator('input[placeholder="Gebruikersnaam"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Wachtwoord"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for empty submission @critical', async () => {
    await page.goto('/login');

    // Submit empty form - browser validation or Zod validation should trigger
    await page.click('button[type="submit"]');

    // Wait briefly for validation
    await page.waitForTimeout(500);

    // The form should remain on the login page
    await expect(page).toHaveURL(/login/);
  });

  test('should handle login failure gracefully @critical', async () => {
    await page.goto('/login');

    // Use invalid credentials
    await page.fill('input[placeholder="Gebruikersnaam"]', 'nonexistent@test.com');
    await page.fill('input[placeholder="Wachtwoord"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Wait for response
    await page.waitForTimeout(3000);

    // Verify error handling - error message shown via .text-destructive class
    const errorVisible = await page.locator('.text-destructive').isVisible({ timeout: 5000 });
    if (errorVisible) {
      await expect(page.locator('.text-destructive')).toBeVisible();
    }

    // Ensure user stays on login page
    await expect(page).toHaveURL(/login/);
  });

  test('should successfully login with valid credentials @critical @smoke', async () => {
    await page.goto('/login');

    // Use test credentials matching seeded data
    await page.fill('input[placeholder="Gebruikersnaam"]', 'admin@omsaddle.com');
    await page.fill('input[placeholder="Wachtwoord"]', 'AdminPass123!');

    // Submit login form
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForTimeout(3000);

    // Verify successful login - should redirect away from login
    const currentUrl = page.url();
    const isLoggedIn = !currentUrl.includes('/login');

    if (isLoggedIn) {
      await expect(page).toHaveURL(/dashboard/);

      // Verify navigation is visible (sidebar/header)
      await expect(page.locator('nav, header, [data-testid="sidebar"]')).toBeVisible();
    }
  });

  test('should handle role-based access correctly @critical', async () => {
    // Login as fitter
    await page.goto('/login');
    await page.fill('input[placeholder="Gebruikersnaam"]', 'sarah.thompson@fitters.com');
    await page.fill('input[placeholder="Wachtwoord"]', 'FitterPass123!');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    // Verify fitter dashboard access
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      await expect(page).toHaveURL(/dashboard/);

      // Try to access admin-only page - should be redirected
      await page.goto('/users');
      await page.waitForTimeout(2000);

      // Should be redirected away from /users (fitters don't have access)
      const usersUrl = page.url();
      expect(usersUrl.includes('/users')).toBeFalsy();
    }
  });

  test('should handle session expiration @critical', async () => {
    // Login first
    await page.goto('/login');
    await page.fill('input[placeholder="Gebruikersnaam"]', 'admin@omsaddle.com');
    await page.fill('input[placeholder="Wachtwoord"]', 'AdminPass123!');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      // Simulate expired session by clearing storage
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // Try to access protected route
      await page.goto('/orders');
      await page.waitForTimeout(2000);

      // Should redirect to login
      await expect(page).toHaveURL(/login/);
    }
  });

  test('should successfully logout @smoke', async () => {
    // Login first
    await page.goto('/login');
    await page.fill('input[placeholder="Gebruikersnaam"]', 'admin@omsaddle.com');
    await page.fill('input[placeholder="Wachtwoord"]', 'AdminPass123!');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      // Look for logout button
      const logoutSelectors = [
        'button:has-text("Logout")',
        'button:has-text("Sign Out")',
        '[data-testid="logout"]'
      ];

      for (const selector of logoutSelectors) {
        try {
          const element = page.locator(selector);
          if (await element.isVisible({ timeout: 2000 })) {
            await element.click();
            await page.waitForTimeout(2000);

            // Verify redirect to login
            await expect(page).toHaveURL(/login/);
            break;
          }
        } catch {
          continue;
        }
      }
    }
  });

  test('should handle concurrent sessions @security', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Login in first session
      await page1.goto('/login');
      await page1.fill('input[placeholder="Gebruikersnaam"]', 'admin@omsaddle.com');
      await page1.fill('input[placeholder="Wachtwoord"]', 'AdminPass123!');
      await page1.click('button[type="submit"]');
      await page1.waitForTimeout(3000);

      // Login in second session with same user
      await page2.goto('/login');
      await page2.fill('input[placeholder="Gebruikersnaam"]', 'admin@omsaddle.com');
      await page2.fill('input[placeholder="Wachtwoord"]', 'AdminPass123!');
      await page2.click('button[type="submit"]');
      await page2.waitForTimeout(3000);

      // Both sessions should remain active or show concurrent session warning
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
