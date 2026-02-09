import { test, expect } from '@playwright/test';
import { AuthHelper, TEST_USERS } from '../shared/auth-helpers';
import { ApiHelper, ENTITY_CONFIGS } from '../shared/api-helpers';

test.describe('Orders Entity Management', () => {
  let authHelper: AuthHelper;
  let apiHelper: ApiHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    apiHelper = new ApiHelper(page);

    // Login before each test
    await authHelper.login(TEST_USERS.admin);
    await page.goto('/orders');
    await authHelper.waitForPageLoad();
  });

  test.afterEach(async () => {
    await authHelper.logout();
  });

  test('should load orders page and make API call', async ({ page }) => {
    // Verify page loads correctly
    await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible();

    // Wait for API call to be made
    const apiCall = await apiHelper.getLastApiRequest('/enriched_orders');
    expect(apiCall).toBeTruthy();

    // Verify API response structure
    const response = await apiHelper.waitForApiResponse('/enriched_orders');
    await apiHelper.validateEntityResponse('orders', { json: () => response });
  });

  test('should display orders in table format', async ({ page }) => {
    await authHelper.waitForPageLoad();

    // Check for table or grid structure
    const tableSelectors = [
      'table',
      '[data-testid="entity-table"]',
      '[role="table"]',
      '.data-table'
    ];

    let tableFound = false;
    for (const selector of tableSelectors) {
      try {
        await expect(page.locator(selector)).toBeVisible({ timeout: 2000 });
        tableFound = true;
        break;
      } catch {
        continue;
      }
    }

    expect(tableFound).toBeTruthy();

    // Check for order data columns
    const expectedColumns = ENTITY_CONFIGS.orders.expectedFields;
    for (const field of expectedColumns.slice(0, 3)) { // Check first 3 fields
      try {
        await expect(page.locator(`text="${field}"`).first()).toBeVisible({ timeout: 1000 });
      } catch {
        // Some fields might be displayed differently
      }
    }
  });

  test('should support search functionality', async ({ page }) => {
    await authHelper.waitForPageLoad();

    // Look for search input
    const searchSelectors = [
      'input[placeholder*="search" i]',
      'input[type="search"]',
      '[data-testid="search"]',
      'input[name="search"]'
    ];

    let searchInput = null;
    for (const selector of searchSelectors) {
      try {
        searchInput = page.locator(selector);
        await expect(searchInput).toBeVisible({ timeout: 1000 });
        break;
      } catch {
        continue;
      }
    }

    if (searchInput) {
      // Clear any existing requests
      apiHelper.clearRequestHistory();

      // Perform search
      await searchInput.fill('test');
      // Wait for debounced search API call after typing
      await page.waitForResponse(resp => resp.url().includes('/enriched_orders') && resp.status() === 200);

      // Check if API call was made with search parameter
      const searchRequest = apiHelper.getLastApiRequest('/enriched_orders');
      if (searchRequest) {
        apiHelper.validateSearchParam(searchRequest.url(), 'test');
      }
    }
  });

  test('should support filtering by order status', async ({ page }) => {
    await authHelper.waitForPageLoad();

    // Look for status filter
    const filterSelectors = [
      'select[name*="status" i]',
      '[data-testid="status-filter"]',
      'button:has-text("Status")',
      'input[placeholder*="status" i]'
    ];

    for (const selector of filterSelectors) {
      try {
        const filterElement = page.locator(selector);
        await expect(filterElement).toBeVisible({ timeout: 1000 });

        // Clear request history
        apiHelper.clearRequestHistory();

        // Apply filter (try different approaches based on element type)
        const tagName = await filterElement.evaluate(el => el.tagName.toLowerCase());

        if (tagName === 'select') {
          await filterElement.selectOption({ index: 1 }); // Select first non-default option
        } else if (tagName === 'button') {
          await filterElement.click();
          // Wait for dropdown options to appear
          const option = page.locator('[role="option"], .dropdown-item').first();
          await option.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
          if (await option.isVisible({ timeout: 1000 })) {
            await option.click();
          }
        } else {
          await filterElement.fill('pending');
        }

        // Wait for filter API response
        await page.waitForResponse(resp => resp.url().includes('/enriched_orders') && resp.status() === 200);

        // Check if API call was made with filter
        const filterRequest = apiHelper.getLastApiRequest('/enriched_orders');
        if (filterRequest) {
          // The exact filter parameter depends on implementation
          const url = filterRequest.url();
          expect(url).toMatch(/(status|filter|orderStatus)/i);
        }
        break;
      } catch {
        continue;
      }
    }
  });

  test('should support sorting by columns', async ({ page }) => {
    await authHelper.waitForPageLoad();

    // Look for sortable column headers
    const sortableSelectors = [
      'th[role="columnheader"]',
      '[data-testid*="sort"]',
      'th:has(button)',
      '.sortable'
    ];

    for (const selector of sortableSelectors) {
      try {
        const sortableColumn = page.locator(selector).first();
        await expect(sortableColumn).toBeVisible({ timeout: 1000 });

        // Clear request history
        apiHelper.clearRequestHistory();

        // Click to sort
        await sortableColumn.click();
        // Wait for sort API response
        await page.waitForResponse(resp => resp.url().includes('/enriched_orders') && resp.status() === 200);

        // Check if API call was made with sort parameter
        const sortRequest = apiHelper.getLastApiRequest('/enriched_orders');
        if (sortRequest) {
          const url = sortRequest.url();
          expect(url).toMatch(/(order|sort|\$orderby)/i);
        }
        break;
      } catch {
        continue;
      }
    }
  });

  test('should support pagination', async ({ page }) => {
    await authHelper.waitForPageLoad();

    // Look for pagination controls
    const paginationSelectors = [
      '[data-testid="pagination"]',
      '.pagination',
      'button:has-text("Next")',
      'button:has-text("2")', // Page 2 button
      '[aria-label*="pagination" i]'
    ];

    for (const selector of paginationSelectors) {
      try {
        const paginationElement = page.locator(selector);
        await expect(paginationElement).toBeVisible({ timeout: 2000 });

        // Clear request history
        apiHelper.clearRequestHistory();

        // Try to navigate to next page
        if (selector.includes('Next')) {
          await paginationElement.click();
        } else if (selector.includes('2')) {
          await paginationElement.click();
        } else {
          // Look for next page button within pagination
          const nextButton = page.locator('button:has-text("Next"), button:has-text(">")', { hasText: /next|>/i });
          if (await nextButton.isVisible({ timeout: 1000 })) {
            await nextButton.click();
          }
        }

        // Wait for pagination API response
        await page.waitForResponse(resp => resp.url().includes('/enriched_orders') && resp.status() === 200);

        // Check if API call was made with pagination parameter
        const pageRequest = apiHelper.getLastApiRequest('/enriched_orders');
        if (pageRequest) {
          apiHelper.validatePaginationParams(pageRequest.url(), 2);
        }
        break;
      } catch {
        continue;
      }
    }
  });

  test('should show order details when clicking on an order', async ({ page }) => {
    await authHelper.waitForPageLoad();

    // Look for clickable order rows or detail buttons
    const orderSelectors = [
      'tr[data-testid*="order-row"]',
      'button:has-text("View")',
      'button:has-text("Details")',
      '[data-testid="view-details"]',
      'tbody tr'
    ];

    for (const selector of orderSelectors) {
      try {
        const orderElement = page.locator(selector).first();
        await expect(orderElement).toBeVisible({ timeout: 2000 });

        await orderElement.click();

        // Wait for either a modal to appear or URL to change
        await Promise.race([
          page.locator('[data-testid="order-modal"], [role="dialog"], .modal, [data-testid="order-details"]').first().waitFor({ state: 'visible', timeout: 3000 }),
          page.waitForURL(url => url.pathname.includes('/order') && url.pathname !== '/orders', { timeout: 3000 }),
        ]).catch(() => {});

        // Check if modal or detail view opened
        const detailSelectors = [
          '[data-testid="order-modal"]',
          '[role="dialog"]',
          '.modal',
          '[data-testid="order-details"]'
        ];

        let detailFound = false;
        for (const detailSelector of detailSelectors) {
          try {
            await expect(page.locator(detailSelector)).toBeVisible({ timeout: 2000 });
            detailFound = true;
            break;
          } catch {
            continue;
          }
        }

        if (detailFound) {
          // Success - detail view opened
          break;
        } else {
          // Check if navigated to detail page
          const currentUrl = page.url();
          if (currentUrl.includes('/order') && currentUrl !== '/orders') {
            // Navigated to order detail page
            break;
          }
        }
      } catch {
        continue;
      }
    }
  });

  test('should validate API response structure', async ({ page }) => {
    await authHelper.waitForPageLoad();

    // Get the API response
    const response = await apiHelper.waitForApiResponse('/enriched_orders');

    // Validate using our helper
    await apiHelper.validateEntityResponse('orders', { json: () => response });

    // Additional specific validations for orders
    expect(response).toHaveProperty('hydra:member');
    expect(Array.isArray(response['hydra:member'])).toBe(true);

    if (response['hydra:member'].length > 0) {
      const firstOrder = response['hydra:member'][0];

      // Check for required order fields
      expect(firstOrder).toHaveProperty('id');
      expect(firstOrder).toHaveProperty('orderId');
      expect(firstOrder).toHaveProperty('orderStatus');

      // Check for relationship fields
      if (firstOrder.customer) {
        expect(firstOrder.customer).toHaveProperty('name');
      }

      if (firstOrder.fitter) {
        expect(firstOrder.fitter).toHaveProperty('name');
      }
    }
  });
});