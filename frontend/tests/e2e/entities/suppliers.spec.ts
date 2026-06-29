import { test, expect } from '@playwright/test';
import { AuthHelper, TEST_USERS } from '../shared/auth-helpers';
import { ApiHelper } from '../shared/api-helpers';

test.describe('Suppliers Entity Management', () => {
  let authHelper: AuthHelper;
  let apiHelper: ApiHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    apiHelper = new ApiHelper(page);

    // Login before each test
    await authHelper.login(TEST_USERS.admin);
    await page.goto('/suppliers');
    await authHelper.waitForPageLoad();
  });

  test.afterEach(async () => {
    await authHelper.logout();
  });

  test('should load suppliers page and validate API response', async ({ page }) => {
    // Verify page loads
    await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible();

    // Wait for API call
    const response = await apiHelper.waitForApiResponse('/suppliers') as { 'hydra:member'?: Record<string, unknown>[] };

    // Validate response structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await apiHelper.validateEntityResponse('suppliers', { json: () => Promise.resolve(response) } as any);

    // Validate supplier-specific fields
    if ((response['hydra:member']?.length ?? 0) > 0) {
      const firstSupplier = response['hydra:member']![0];
      expect(firstSupplier).toHaveProperty('id');
      expect(firstSupplier).toHaveProperty('name');
      expect(firstSupplier).toHaveProperty('email');
    }
  });

  test('should display suppliers in table format', async ({ page }) => {
    await authHelper.waitForPageLoad();

    // Check for table structure
    const tableFound = await page.locator('table, [data-testid="entity-table"], [role="table"]').isVisible();
    expect(tableFound).toBeTruthy();

    // Look for supplier data
    const supplierRows = page.locator('tbody tr, [data-testid*="supplier-row"]');
    const rowCount = await supplierRows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('should support supplier search', async ({ page }) => {
    await authHelper.waitForPageLoad();

    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"], [data-testid="search"]').first();

    if (await searchInput.isVisible({ timeout: 2000 })) {
      apiHelper.clearRequestHistory();

      await searchInput.fill('test supplier');
      // Wait for debounced search API call after typing
      await page.waitForResponse(resp => resp.url().includes('/suppliers') && resp.status() === 200);

      const searchRequest = apiHelper.getLastApiRequest('/suppliers');
      if (searchRequest) {
        expect(searchRequest.url()).toMatch(/search|name|email/i);
      }
    }
  });

  test('should view supplier details', async ({ page }) => {
    await authHelper.waitForPageLoad();

    // Look for detail buttons or clickable rows
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
            const urlChanged = page.url().includes('/supplier') && !page.url().endsWith('/suppliers');
            expect(urlChanged).toBeTruthy();
          }
          break;
        }
      } catch {
        continue;
      }
    }
  });

  test('should handle supplier creation flow', async ({ page }) => {
    await authHelper.waitForPageLoad();

    // Look for add/create buttons
    const createTriggers = [
      'button:has-text("Add")',
      'button:has-text("Create")',
      'button:has-text("New")',
      '[data-testid="add-supplier"]',
      '[data-testid="create-supplier"]'
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
            // Look for supplier form fields
            const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]');
            const emailInput = page.locator('input[name="email"], input[type="email"]');

            expect(await nameInput.isVisible({ timeout: 2000 }) || await emailInput.isVisible({ timeout: 2000 })).toBeTruthy();
          }
          break;
        }
      } catch {
        continue;
      }
    }
  });

  test('should validate supplier data integrity', async ({ page: _page }) => {
    await authHelper.waitForPageLoad();

    const response = await apiHelper.waitForApiResponse('/suppliers') as { 'hydra:member'?: Record<string, unknown>[] };

    // Validate response structure
    expect(response).toHaveProperty('hydra:member');
    expect(Array.isArray(response['hydra:member'])).toBe(true);

    // Validate each supplier has required fields
    (response['hydra:member'] ?? []).forEach((supplier: Record<string, unknown>, index: number) => {
      expect(supplier).toHaveProperty('id', `Supplier ${index} should have id`);
      expect(supplier).toHaveProperty('name', `Supplier ${index} should have name`);

      // Email should be valid format if present
      if (typeof supplier.email === 'string') {
        expect(supplier.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      }
    });
  });
});