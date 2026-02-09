import { test, expect } from '@playwright/test';

test.describe('E2E Setup Verification', () => {
  test('should verify frontend is accessible', async ({ page }) => {
    await page.goto('/');

    // Should redirect to login or dashboard
    await page.waitForURL(/(login|dashboard)/, { timeout: 10000 });

    // Page should load without errors
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });

  test('should verify API backend is accessible', async ({ request }) => {
    // Test API health endpoint
    const healthResponse = await request.get('http://localhost:3001/health');

    // Should get 200 OK response from health endpoint
    expect(healthResponse.status()).toBe(200);

    // Check response structure
    const healthData = await healthResponse.json();
    expect(healthData).toHaveProperty('status');
    expect(['ok', 'up'].includes(healthData.status)).toBeTruthy();
  });

  test('should verify login page loads correctly', async ({ page }) => {
    await page.goto('/login');

    // Should see login form elements
    const usernameInput = page.getByTestId('username-input');
    const passwordInput = page.getByTestId('password-input');
    const submitButton = page.getByTestId('login-submit');

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test('should verify test configuration is working', async ({ page }) => {
    // Test basic Playwright functionality
    await page.goto('/login');

    // Test that we can interact with elements
    const usernameInput = page.getByTestId('username-input');
    await usernameInput.fill('test');

    const value = await usernameInput.inputValue();
    expect(value).toBe('test');

    // Clear for cleanup
    await usernameInput.clear();
  });
});