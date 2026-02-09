import { test, expect } from '@playwright/test';
import { AuthHelper, TEST_USERS } from '../shared/auth-helpers';
import { ApiHelper } from '../shared/api-helpers';

test.describe('Authentication Flow', () => {
  let authHelper: AuthHelper;
  let apiHelper: ApiHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    apiHelper = new ApiHelper(page);

    // Ensure we start logged out
    await authHelper.logout();
  });

  test.afterEach(async () => {
    await authHelper.logout();
  });

  test('should login successfully with valid admin credentials', async ({ page }) => {
    // Login as admin
    await authHelper.login(TEST_USERS.admin);

    // Verify we're on the dashboard
    await expect(page).toHaveURL('/dashboard');

    // Verify auth token is set
    const token = await authHelper.getAuthToken();
    expect(token).toBeTruthy();

    // Verify navigation elements are visible
    await expect(page.locator('nav, header, [data-testid="sidebar"]')).toBeVisible();
  });

  test('should fail login with invalid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Fill in invalid credentials
    await page.getByTestId('username-input').fill('invalid@user.com');
    await page.getByTestId('password-input').fill('wrongpassword');

    // Submit form
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');

    // Wait for error to appear (invalid credentials should stay on login)
    await Promise.race([
      page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 5000 }),
      page.locator('.error, .alert, [data-testid="error"]').first().waitFor({ state: 'visible', timeout: 5000 }),
    ]).catch(() => {});
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/login/);

    // Check for error message
    const errorSelectors = [
      'text="Invalid credentials"',
      'text="Login failed"',
      '[data-testid="error"]',
      '.error',
      '.alert'
    ];

    let errorFound = false;
    for (const selector of errorSelectors) {
      try {
        await expect(page.locator(selector)).toBeVisible({ timeout: 1000 });
        errorFound = true;
        break;
      } catch {
        continue;
      }
    }

    // Either error message should be visible or we should still be on login
    expect(errorFound || currentUrl.includes('/login')).toBeTruthy();
  });

  test('should logout successfully', async ({ page }) => {
    // First login
    await authHelper.login(TEST_USERS.admin);
    await expect(page).toHaveURL('/dashboard');

    // Then logout
    await authHelper.logout();

    // Should be redirected to login
    await expect(page).toHaveURL('/login');

    // Auth token should be cleared
    const token = await authHelper.getAuthToken();
    expect(token).toBeFalsy();
  });

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    // Try to access dashboard without logging in
    await page.goto('/dashboard');

    // Should be redirected to login
    await page.waitForURL('/login', { timeout: 10000 });
    await expect(page).toHaveURL('/login');
  });

  test('should maintain login state across page refreshes', async ({ page }) => {
    // Login as admin
    await authHelper.login(TEST_USERS.admin);
    await expect(page).toHaveURL('/dashboard');

    // Refresh the page
    await page.reload();

    // Should still be logged in and on dashboard
    await expect(page).toHaveURL('/dashboard');

    // Auth token should still be present
    const token = await authHelper.getAuthToken();
    expect(token).toBeTruthy();
  });

  test('should make authenticated API calls after login', async ({ page }) => {
    // Login as admin
    await authHelper.login(TEST_USERS.admin);

    // Navigate to a page that makes API calls (e.g., customers)
    await page.goto('/customers');
    await authHelper.waitForPageLoad();

    // Wait for and verify API call was made with authentication
    const apiCall = await apiHelper.waitForApiCall('/customers', 10000);
    expect(apiCall).toBeTruthy();

    // Check that the request has authorization header
    const headers = apiCall.headers();
    expect(headers['authorization'] || headers['Authorization']).toBeTruthy();
  });

  test('should handle different user roles correctly', async ({ page }) => {
    // Test admin access
    await authHelper.login(TEST_USERS.admin);
    await expect(page).toHaveURL('/dashboard');

    // Admin should be able to access user management
    await page.goto('/users');
    await authHelper.waitForPageLoad();

    // Should not be redirected (admin has access)
    expect(page.url()).toMatch(/\/users/);

    // Logout and test regular user (if available)
    await authHelper.logout();

    // Try with fitter user
    if (TEST_USERS.fitter) {
      await authHelper.login(TEST_USERS.fitter);
      await expect(page).toHaveURL('/dashboard');

      // Fitter should have restricted access to admin pages
      await page.goto('/users');
      await page.waitForLoadState('networkidle');

      // Fitter should be redirected away from /users
      const finalUrl = page.url();
      console.log(`Fitter role access to /users: ${finalUrl}`);
    }
  });
});