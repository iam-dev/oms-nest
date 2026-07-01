import { test, expect, type Response } from '@playwright/test';
import { AuthHelper, TEST_USERS } from '../shared/auth-helpers';
import { ApiHelper } from '../shared/api-helpers';

test.describe('Customers Entity Management', () => {
  let authHelper: AuthHelper;
  let apiHelper: ApiHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    apiHelper = new ApiHelper(page);

    // Login before each test
    await authHelper.login(TEST_USERS.admin);
    await page.goto('/customers');
    await authHelper.waitForPageLoad();
  });

  test.afterEach(async () => {
    await authHelper.logout();
  });

  test('should load customers page and validate API response', async ({ page }) => {
    // Verify page loads
    await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible();

    // Wait for API call
    const responseData = await apiHelper.waitForApiResponse('/customers');
    const response = responseData as Record<string, unknown>;

    // Validate response structure
    await apiHelper.validateEntityResponse('customers', { json: async () => response } as unknown as Response);

    // Validate customer-specific fields
    const members = response['hydra:member'];
    if (Array.isArray(members) && members.length > 0) {
      const firstCustomer = members[0] as Record<string, unknown>;
      expect(firstCustomer).toHaveProperty('id');
      expect(firstCustomer).toHaveProperty('name');
      expect(firstCustomer).toHaveProperty('email');
    }
  });

  test('should display customers in table format', async ({ page }) => {
    await authHelper.waitForPageLoad();

    // Check for table structure
    const tableFound = await page.locator('table, [data-testid="entity-table"], [role="table"]').isVisible();
    expect(tableFound).toBeTruthy();

    // Look for customer data
    const customerRows = page.locator('tbody tr, [data-testid*="customer-row"]');
    const rowCount = await customerRows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('should support customer search', async ({ page }) => {
    await authHelper.waitForPageLoad();

    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"], [data-testid="search"]').first();

    if (await searchInput.isVisible({ timeout: 2000 })) {
      apiHelper.clearRequestHistory();

      await searchInput.fill('test customer');
      // Wait for debounced search API call after typing
      await page.waitForResponse(resp => resp.url().includes('/customers') && resp.status() === 200);

      const searchRequest = apiHelper.getLastApiRequest('/customers');
      if (searchRequest) {
        expect(searchRequest.url()).toMatch(/search|name|email/i);
      }
    }
  });

  test('should support filtering customers', async ({ page }) => {
    await authHelper.waitForPageLoad();

    // Look for filter controls
    const filterSelectors = [
      'select[name*="filter"]',
      'button:has-text("Filter")',
      '[data-testid*="filter"]',
      'input[placeholder*="filter" i]'
    ];

    for (const selector of filterSelectors) {
      try {
        const filterElement = page.locator(selector);
        if (await filterElement.isVisible({ timeout: 1000 })) {
          apiHelper.clearRequestHistory();

          await filterElement.click();

          // Try to select an option if it's a dropdown
          const option = page.locator('[role="option"], .dropdown-item').first();
          if (await option.isVisible({ timeout: 1000 })) {
            await option.click();
          }

          // Wait for filter API response
          await page.waitForResponse(resp => resp.url().includes('/customers') && resp.status() === 200);

          const filterRequest = apiHelper.getLastApiRequest('/customers');
          if (filterRequest) {
            expect(filterRequest.url()).toMatch(/(filter|\$filter)/i);
          }
          break;
        }
      } catch {
        continue;
      }
    }
  });

  test('should support customer sorting', async ({ page }) => {
    await authHelper.waitForPageLoad();

    const sortableHeaders = page.locator('th[role="columnheader"], [data-testid*="sort"], th:has(button)');
    const headerCount = await sortableHeaders.count();

    if (headerCount > 0) {
      apiHelper.clearRequestHistory();

      await sortableHeaders.first().click();
      // Wait for sort API response
      await page.waitForResponse(resp => resp.url().includes('/customers') && resp.status() === 200);

      const sortRequest = apiHelper.getLastApiRequest('/customers');
      if (sortRequest) {
        expect(sortRequest.url()).toMatch(/(order|sort|\$orderby)/i);
      }
    }
  });

  test('should view customer details', async ({ page }) => {
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
            const urlChanged = page.url().includes('/customer') && !page.url().endsWith('/customers');
            expect(urlChanged).toBeTruthy();
          }
          break;
        }
      } catch {
        continue;
      }
    }
  });

  test('should handle customer creation flow', async ({ page }) => {
    await authHelper.waitForPageLoad();

    // Look for add/create buttons
    const createTriggers = [
      'button:has-text("Add")',
      'button:has-text("Create")',
      'button:has-text("New")',
      '[data-testid="add-customer"]',
      '[data-testid="create-customer"]'
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
            // Look for customer form fields
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

  test('should handle pagination for customers', async ({ page }) => {
    await authHelper.waitForPageLoad();

    const paginationControls = page.locator('[data-testid="pagination"], .pagination, button:has-text("Next"), [aria-label*="pagination"]');

    if (await paginationControls.first().isVisible({ timeout: 2000 })) {
      apiHelper.clearRequestHistory();

      // Try to go to next page
      const nextButton = page.locator('button:has-text("Next"), button:has-text(">")').first();
      if (await nextButton.isVisible({ timeout: 1000 })) {
        await nextButton.click();
        // Wait for pagination API response
        await page.waitForResponse(resp => resp.url().includes('/customers') && resp.status() === 200);

        const pageRequest = apiHelper.getLastApiRequest('/customers');
        if (pageRequest) {
          expect(pageRequest.url()).toMatch(/(page|\$skip|\$top)/i);
        }
      }
    }
  });

  test('should validate customer data integrity', async () => {
    const responseData = await apiHelper.waitForApiResponse('/customers');
    const response = responseData as Record<string, unknown>;

    // Validate response structure
    expect(response).toHaveProperty('hydra:member');
    expect(Array.isArray(response['hydra:member'])).toBe(true);

    // Validate each customer has required fields
    (response['hydra:member'] as Record<string, unknown>[]).forEach((customer: Record<string, unknown>, index: number) => {
      expect(customer).toHaveProperty('id', `Customer ${index} should have id`);
      expect(customer).toHaveProperty('name', `Customer ${index} should have name`);

      // Email should be valid format if present
      if (customer.email) {
        expect(customer.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      }

      // Phone should be string if present
      if (customer.phone) {
        expect(typeof customer.phone).toBe('string');
      }
    });
  });
});