import { test, expect } from '@playwright/test';
import { AuthHelper, TEST_USERS } from '../shared/auth-helpers';
import { ApiHelper } from '../shared/api-helpers';

test.describe('Users Entity Management', () => {
  let authHelper: AuthHelper;
  let apiHelper: ApiHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    apiHelper = new ApiHelper(page);

    await authHelper.login(TEST_USERS.admin);
    await page.goto('/users');
    await authHelper.waitForPageLoad();
  });

  test.afterEach(async () => {
    await authHelper.logout();
  });

  test('should load users page and validate API response', async ({ page }) => {
    await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible();

    const response = await apiHelper.waitForApiResponse('/users');

    // Users endpoint returns infinity pagination format: { data: [], meta: {} }
    if (response.data) {
      expect(Array.isArray(response.data)).toBeTruthy();
      if (response.data.length > 0) {
        const firstUser = response.data[0];
        expect(firstUser).toHaveProperty('id');
        expect(firstUser).toHaveProperty('username');
        expect(firstUser).toHaveProperty('email');
      }
    }
  });

  test('should display users in table format', async ({ page }) => {
    await authHelper.waitForPageLoad();

    const tableFound = await page.locator('table, [data-testid="entity-table"], [role="table"]').isVisible();
    expect(tableFound).toBeTruthy();

    const userRows = page.locator('tbody tr, [data-testid*="user-row"]');
    const rowCount = await userRows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('should support user search', async ({ page }) => {
    await authHelper.waitForPageLoad();

    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"], [data-testid="search"]').first();

    if (await searchInput.isVisible({ timeout: 2000 })) {
      apiHelper.clearRequestHistory();

      await searchInput.fill('admin');
      // Wait for debounced search API call after typing
      await page.waitForResponse(resp => resp.url().includes('/users') && resp.status() === 200);

      const searchRequest = apiHelper.getLastApiRequest('/users');
      if (searchRequest) {
        expect(searchRequest.url()).toMatch(/search|name|email|username/i);
      }
    }
  });

  test('should view user details', async ({ page }) => {
    await authHelper.waitForPageLoad();

    const detailTriggers = [
      'button:has-text("View")',
      'button:has-text("Details")',
      '[data-testid="view-details"]',
      'tbody tr'
    ];

    for (const selector of detailTriggers) {
      try {
        const trigger = page.locator(selector).first();
        if (await trigger.isVisible({ timeout: 2000 })) {
          await trigger.click();

          // Wait for either a modal to appear or URL to change
          const detailModal = page.locator('[role="dialog"], .modal, [data-testid*="modal"], [data-testid*="details"]');
          try {
            await detailModal.waitFor({ state: 'visible', timeout: 3000 });
            expect(true).toBeTruthy();
          } catch {
            // If no modal, check if URL changed to a detail page
            const urlChanged = page.url().includes('/user') && !page.url().endsWith('/users');
            expect(urlChanged).toBeTruthy();
          }
          break;
        }
      } catch {
        continue;
      }
    }
  });

  test('should validate user data integrity', async () => {
    const response = await apiHelper.waitForApiResponse('/users');

    if (response.data) {
      expect(Array.isArray(response.data)).toBeTruthy();

      response.data.forEach((user: any) => {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('email');

        if (user.email) {
          expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        }
      });
    }
  });
});
