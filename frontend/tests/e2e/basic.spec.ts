import { test, expect } from '@playwright/test';

test.describe('Basic E2E Tests', () => {
  test('should load the application', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for redirect to login or dashboard
    await page.waitForURL(/(login|dashboard)/, { timeout: 10000 });

    // Check that page loaded successfully
    const title = await page.title();
    expect(title).toBeTruthy();

    // Check that we're on a valid page
    const url = page.url();
    expect(url).toMatch(/(login|dashboard)/);
  });

  test('should load login page', async ({ page }) => {
    await page.goto('/login');

    // Wait for form to load
    await page.waitForSelector('form', { timeout: 10000 });

    // Check for form elements using more flexible selectors
    const formExists = await page.locator('form').isVisible();
    expect(formExists).toBeTruthy();

    // Check for input fields
    const inputs = await page.locator('input').count();
    expect(inputs).toBeGreaterThanOrEqual(2); // Should have at least username and password

    // Check for submit button
    const submitButton = await page.locator('button[type="submit"]').isVisible();
    expect(submitButton).toBeTruthy();
  });

  test('should handle form interaction', async ({ page }) => {
    await page.goto('/login');

    // Wait for form
    await page.waitForSelector('form');

    // Find inputs by their type and placeholder
    const usernameInput = page.locator('input').first();
    const passwordInput = page.locator('input[type="password"]');

    // Test that inputs exist and are interactive
    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Test input interaction
    await usernameInput.fill('test');
    const value = await usernameInput.inputValue();
    expect(value).toBe('test');

    // Clear for cleanup
    await usernameInput.clear();
  });
});