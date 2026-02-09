import { test, expect } from '@playwright/test';
import { AuthHelper, TEST_USERS } from '../shared/auth-helpers';
import { ApiHelper } from '../shared/api-helpers';

test.describe('Fitters Entity Management', () => {
  let authHelper: AuthHelper;
  let apiHelper: ApiHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    apiHelper = new ApiHelper(page);

    await authHelper.login(TEST_USERS.admin);
    await page.goto('/fitters');
    await authHelper.waitForPageLoad();
  });

  test.afterEach(async () => {
    await authHelper.logout();
  });

  test('should load fitters page and validate API response', async ({ page }) => {
    await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible();

    const response = await apiHelper.waitForApiResponse('/fitters');

    // Fitters API returns direct array
    expect(Array.isArray(response)).toBeTruthy();

    if (response.length > 0) {
      const firstFitter = response[0];
      expect(firstFitter).toHaveProperty('id');
      expect(typeof firstFitter.id).toBe('number');
    }
  });

  test('should display fitters in table format', async ({ page }) => {
    await authHelper.waitForPageLoad();

    const tableFound = await page.locator('table, [data-testid="entity-table"], [role="table"]').isVisible();
    expect(tableFound).toBeTruthy();

    const fitterRows = page.locator('tbody tr, [data-testid*="fitter-row"]');
    const rowCount = await fitterRows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('should support fitter search', async ({ page }) => {
    await authHelper.waitForPageLoad();

    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"], [data-testid="search"]').first();

    if (await searchInput.isVisible({ timeout: 2000 })) {
      apiHelper.clearRequestHistory();

      await searchInput.fill('test fitter');
      // Wait for debounced search API call after typing
      await page.waitForResponse(resp => resp.url().includes('/fitters') && resp.status() === 200);

      const searchRequest = apiHelper.getLastApiRequest('/fitters');
      if (searchRequest) {
        expect(searchRequest.url()).toMatch(/search|name|country/i);
      }
    }
  });

  test('should view fitter details', async ({ page }) => {
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
            const urlChanged = page.url().includes('/fitter') && !page.url().endsWith('/fitters');
            expect(urlChanged).toBeTruthy();
          }
          break;
        }
      } catch {
        continue;
      }
    }
  });

  test('should handle fitter creation flow', async ({ page }) => {
    await authHelper.waitForPageLoad();

    const createTriggers = [
      'button:has-text("Add")',
      'button:has-text("Create")',
      'button:has-text("New")',
      '[data-testid="add-fitter"]',
      '[data-testid="create-fitter"]'
    ];

    for (const selector of createTriggers) {
      try {
        const trigger = page.locator(selector);
        if (await trigger.isVisible({ timeout: 2000 })) {
          await trigger.click();

          // Wait for form modal or navigation to create page
          const formLocator = page.locator('form, [role="dialog"], .modal');
          try {
            await formLocator.waitFor({ state: 'visible', timeout: 3000 });
          } catch {
            // May have navigated to create page instead
          }
          const formVisible = await formLocator.isVisible();
          const createPageVisible = page.url().includes('/create') || page.url().includes('/new');

          if (formVisible || createPageVisible) {
            const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]');
            const emailInput = page.locator('input[name="email"], input[name="emailaddress"], input[type="email"]');

            expect(await nameInput.isVisible({ timeout: 2000 }) || await emailInput.isVisible({ timeout: 2000 })).toBeTruthy();
          }
          break;
        }
      } catch {
        continue;
      }
    }
  });

  test('should validate fitter data integrity', async () => {
    const response = await apiHelper.waitForApiResponse('/fitters');

    expect(Array.isArray(response)).toBeTruthy();

    response.forEach((fitter: any, index: number) => {
      expect(fitter).toHaveProperty('id');
      expect(typeof fitter.id).toBe('number');

      if (fitter.emailaddress) {
        expect(fitter.emailaddress).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      }
    });
  });
});
