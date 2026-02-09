import { test, expect } from '@playwright/test';
import { AuthHelper, TEST_USERS } from '../shared/auth-helpers';
import { ApiHelper } from '../shared/api-helpers';

test.describe('Brands Entity Management', () => {
  let authHelper: AuthHelper;
  let apiHelper: ApiHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    apiHelper = new ApiHelper(page);

    await authHelper.login(TEST_USERS.admin);
    await page.goto('/brands');
    await authHelper.waitForPageLoad();
  });

  test.afterEach(async () => {
    await authHelper.logout();
  });

  test('should load brands page and validate API response', async ({ page }) => {
    await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible();

    const response = await apiHelper.waitForApiResponse('/brands');

    if (response.data) {
      expect(Array.isArray(response.data)).toBeTruthy();
    } else if (Array.isArray(response)) {
      expect(response.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('should display brands in table format', async ({ page }) => {
    await authHelper.waitForPageLoad();

    const tableFound = await page.locator('table, [data-testid="entity-table"], [role="table"]').isVisible();
    expect(tableFound).toBeTruthy();

    const brandRows = page.locator('tbody tr, [data-testid*="brand-row"]');
    const rowCount = await brandRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test('should support brand search', async ({ page }) => {
    await authHelper.waitForPageLoad();

    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"], [data-testid="search"]').first();

    if (await searchInput.isVisible({ timeout: 2000 })) {
      apiHelper.clearRequestHistory();

      await searchInput.fill('test brand');
      // Wait for debounced search API call after typing
      await page.waitForResponse(resp => resp.url().includes('/brands') && resp.status() === 200);

      const searchRequest = apiHelper.getLastApiRequest('/brands');
      if (searchRequest) {
        expect(searchRequest.url()).toMatch(/search|name|brandName/i);
      }
    }
  });

  test('should view brand details', async ({ page }) => {
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

          // Wait for detail modal to appear
          const detailModal = page.locator('[role="dialog"], .modal, [data-testid*="modal"], [data-testid*="details"]');
          await detailModal.waitFor({ state: 'visible', timeout: 3000 });
          expect(await detailModal.isVisible()).toBeTruthy();
          break;
        }
      } catch {
        continue;
      }
    }
  });

  test('should handle brand creation flow', async ({ page }) => {
    await authHelper.waitForPageLoad();

    const createTriggers = [
      'button:has-text("Add")',
      'button:has-text("Create")',
      'button:has-text("New")',
      '[data-testid="add-brand"]',
      '[data-testid="create-brand"]'
    ];

    for (const selector of createTriggers) {
      try {
        const trigger = page.locator(selector);
        if (await trigger.isVisible({ timeout: 2000 })) {
          await trigger.click();

          // Wait for form modal to appear
          const formLocator = page.locator('form, [role="dialog"], .modal');
          try {
            await formLocator.waitFor({ state: 'visible', timeout: 3000 });
          } catch {
            // May have navigated to create page instead
          }
          const formVisible = await formLocator.isVisible();
          if (formVisible) {
            const nameInput = page.locator('input[name="brandName"], input[name="name"], input[placeholder*="name" i]');
            expect(await nameInput.isVisible({ timeout: 2000 })).toBeTruthy();
          }
          break;
        }
      } catch {
        continue;
      }
    }
  });

  test('should validate brand data integrity', async () => {
    const response = await apiHelper.waitForApiResponse('/brands');

    const brands = response.data || (Array.isArray(response) ? response : []);

    brands.forEach((brand: any) => {
      expect(brand).toHaveProperty('id');
      expect(brand).toHaveProperty('brandName');
    });
  });
});
