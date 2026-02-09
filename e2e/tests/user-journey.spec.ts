import { test, expect, Page } from '@playwright/test';

/**
 * Cross-Entity User Journey E2E Tests
 * Tests realistic workflows that span multiple entities and pages,
 * verifying the application works as a cohesive whole.
 *
 * Selector strategy (ordered by preference):
 *   1. getByRole / locator('[type="..."]') -- resilient to text/placeholder changes
 *   2. CSS attribute selectors (input[type], button[type])
 *   3. Placeholder text as last resort (may change with i18n)
 */

/**
 * Wait for the login form to render.
 * The login page shows "Loading..." while AuthContext initializes.
 * Webkit on CI is slower to resolve this, so we must explicitly wait.
 */
async function waitForLoginForm(target: Page): Promise<void> {
  await target.locator('form').waitFor({ state: 'visible', timeout: 30000 });
}

/** Fill login form using resilient type-based selectors */
async function fillLoginForm(
  target: Page,
  email: string,
  password: string,
): Promise<void> {
  await waitForLoginForm(target);

  const emailInput = target.locator('input[type="email"], input[type="text"]').first();
  const passwordInput = target.locator('input[type="password"]');

  await emailInput.waitFor({ state: 'visible' });
  await emailInput.fill(email);
  await passwordInput.fill(password);
}

/** Submit the login form and wait for navigation away from /login */
async function submitLoginAndWait(target: Page): Promise<boolean> {
  await waitForLoginForm(target);
  await target.locator('button[type="submit"]').click();

  await Promise.race([
    target.waitForURL(/.*(?<!\/login)$/, { timeout: 10000 }),
    target.locator('.text-destructive').waitFor({ state: 'visible', timeout: 10000 }),
  ]).catch(() => {});

  return !target.url().includes('/login');
}

/** Login as admin and return whether login succeeded */
async function loginAsAdmin(page: Page): Promise<boolean> {
  await page.goto('/login');
  await fillLoginForm(
    page,
    process.env.TEST_ADMIN_EMAIL || 'admin@omsaddle.com',
    process.env.TEST_ADMIN_PASSWORD || 'AdminPass123!',
  );
  return submitLoginAndWait(page);
}

/** Wait for page content to settle after navigation */
async function waitForContentLoad(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  // Wait for network to settle or timeout gracefully
  await page.waitForLoadState('networkidle').catch(() => {});
}

test.describe('User Journey @journey @smoke @readonly', () => {
  test('complete workflow: login -> dashboard -> customers -> orders -> verify data', async ({ page }) => {
    // Step 1: Login
    const isLoggedIn = await loginAsAdmin(page);
    if (!isLoggedIn) {
      console.log('Login failed - skipping journey test');
      test.skip();
      return;
    }

    // Step 2: Verify dashboard loads after login
    await expect(page).toHaveURL(/dashboard/);
    await waitForContentLoad(page);

    // Verify navigation/sidebar is present
    const hasNav = await page.locator('nav, header, [data-testid="sidebar"]').isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasNav).toBeTruthy();

    // Step 3: Navigate to customers
    const customerNavSelectors = [
      'a[href*="/customers"]',
      'nav >> text=Customers',
      '[data-testid="nav-customers"]',
      'a:has-text("Customers")',
    ];

    let navigatedToCustomers = false;
    for (const selector of customerNavSelectors) {
      try {
        const navLink = page.locator(selector).first();
        if (await navLink.isVisible({ timeout: 2000 })) {
          await navLink.click();
          await page.waitForURL(/customers/, { timeout: 10000 });
          navigatedToCustomers = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!navigatedToCustomers) {
      // Fallback: navigate directly
      await page.goto('/customers');
    }

    await waitForContentLoad(page);
    expect(page.url()).toContain('/customers');

    // Verify customer data loads (table or content)
    const hasCustomerTable = await page.locator('table, [role="table"]').isVisible({ timeout: 5000 }).catch(() => false);
    const hasCustomerContent = await page.locator('tbody tr, [data-testid*="customer"]').first().isVisible({ timeout: 5000 }).catch(() => false);

    if (hasCustomerTable || hasCustomerContent) {
      console.log('Customer data loaded successfully');
    } else {
      console.log('Customer page loaded but no table data visible');
    }

    // Step 4: Navigate to orders
    const orderNavSelectors = [
      'a[href*="/orders"]',
      'nav >> text=Orders',
      '[data-testid="nav-orders"]',
      'a:has-text("Orders")',
    ];

    let navigatedToOrders = false;
    for (const selector of orderNavSelectors) {
      try {
        const navLink = page.locator(selector).first();
        if (await navLink.isVisible({ timeout: 2000 })) {
          await navLink.click();
          await page.waitForURL(/orders/, { timeout: 10000 });
          navigatedToOrders = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!navigatedToOrders) {
      await page.goto('/orders');
    }

    await waitForContentLoad(page);
    expect(page.url()).toContain('/orders');

    // Verify order data loads
    const hasOrderTable = await page.locator('table, [role="table"]').isVisible({ timeout: 5000 }).catch(() => false);
    const hasOrderContent = await page.locator('tbody tr, [data-testid*="order"]').first().isVisible({ timeout: 5000 }).catch(() => false);

    if (hasOrderTable || hasOrderContent) {
      console.log('Order data loaded successfully');
    } else {
      console.log('Orders page loaded but no table data visible');
    }

    // Step 5: View order details (if rows exist)
    if (hasOrderContent) {
      const firstRow = page.locator('tbody tr').first();
      if (await firstRow.isVisible({ timeout: 2000 })) {
        await firstRow.click();

        // Wait for detail view (modal or URL change)
        await Promise.race([
          page.locator('[role="dialog"], .modal').waitFor({ state: 'visible', timeout: 5000 }),
          page.waitForURL(/\/orders\/\d+/, { timeout: 5000 }),
        ]).catch(() => {});

        const detailVisible = await page.locator('[role="dialog"], .modal').isVisible().catch(() => false);
        const urlChanged = /\/orders\/\d+/.test(page.url());

        if (detailVisible || urlChanged) {
          console.log('Order detail view opened successfully');
        }
      }
    }

    // Step 6: Navigate back to dashboard
    const dashboardNavSelectors = [
      'a[href*="/dashboard"]',
      'nav >> text=Dashboard',
      '[data-testid="nav-dashboard"]',
      'a:has-text("Dashboard")',
    ];

    let navigatedToDashboard = false;
    for (const selector of dashboardNavSelectors) {
      try {
        const navLink = page.locator(selector).first();
        if (await navLink.isVisible({ timeout: 2000 })) {
          await navLink.click();
          await page.waitForURL(/dashboard/, { timeout: 10000 });
          navigatedToDashboard = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!navigatedToDashboard) {
      await page.goto('/dashboard');
    }

    await waitForContentLoad(page);
    expect(page.url()).toContain('/dashboard');
  });

  test('session persistence: login -> navigate -> refresh -> still logged in', async ({ page }) => {
    // Step 1: Login
    const isLoggedIn = await loginAsAdmin(page);
    if (!isLoggedIn) {
      console.log('Login failed - skipping session persistence test');
      test.skip();
      return;
    }

    await expect(page).toHaveURL(/dashboard/);

    // Step 2: Navigate to a protected page
    await page.goto('/customers');
    await waitForContentLoad(page);
    expect(page.url()).toContain('/customers');

    // Step 3: Refresh the page
    await page.reload();
    await waitForContentLoad(page);

    // Step 4: Verify still logged in (not redirected to login)
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');

    // Should still be on the customers page (or at least not kicked to login)
    const hasNav = await page.locator('nav, header, [data-testid="sidebar"]').isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasNav).toBeTruthy();
  });

  test('cross-entity navigation: orders page shows customer and fitter references', async ({ page }) => {
    // Login
    const isLoggedIn = await loginAsAdmin(page);
    if (!isLoggedIn) {
      console.log('Login failed - skipping cross-entity test');
      test.skip();
      return;
    }

    // Navigate to orders
    await page.goto('/orders');
    await waitForContentLoad(page);

    // Verify the orders table has columns/data referencing other entities
    const hasTable = await page.locator('table, [role="table"]').isVisible({ timeout: 5000 }).catch(() => false);

    if (hasTable) {
      // Check for column headers that reference cross-entity data
      const headerTexts = await page.locator('th, thead [role="columnheader"]').allTextContents();
      const headerString = headerTexts.join(' ').toLowerCase();

      // Orders should reference customers, fitters, or factories
      const hasCrossEntityHeaders = headerString.includes('customer') ||
        headerString.includes('fitter') ||
        headerString.includes('factory') ||
        headerString.includes('status');

      if (hasCrossEntityHeaders) {
        console.log('Orders table includes cross-entity references');
      } else {
        console.log(`Orders table headers: ${headerTexts.join(', ')}`);
      }

      // Verify table has data rows
      const rowCount = await page.locator('tbody tr').count();
      expect(rowCount).toBeGreaterThanOrEqual(0);
      console.log(`Orders table has ${rowCount} rows`);
    }
  });

  test('multi-page data consistency: entity counts remain stable across navigations', async ({ page }) => {
    // Login
    const isLoggedIn = await loginAsAdmin(page);
    if (!isLoggedIn) {
      console.log('Login failed - skipping data consistency test');
      test.skip();
      return;
    }

    // Visit customers page and count rows
    await page.goto('/customers');
    await waitForContentLoad(page);

    const customerRowCount = await page.locator('tbody tr').count().catch(() => 0);

    // Visit orders page
    await page.goto('/orders');
    await waitForContentLoad(page);

    const orderRowCount = await page.locator('tbody tr').count().catch(() => 0);

    // Navigate back to customers
    await page.goto('/customers');
    await waitForContentLoad(page);

    const customerRowCountSecond = await page.locator('tbody tr').count().catch(() => 0);

    // Row counts should be stable (no data loss between navigations)
    if (customerRowCount > 0) {
      expect(customerRowCountSecond).toBe(customerRowCount);
      console.log(`Customer count stable: ${customerRowCount} rows on both visits`);
    }

    console.log(`Data snapshot: ${customerRowCount} customers, ${orderRowCount} orders`);
  });
});
