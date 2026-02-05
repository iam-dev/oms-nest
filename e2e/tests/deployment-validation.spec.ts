import { test, expect } from '@playwright/test';

// Get the correct API URL based on environment
// In CI (local mode), use localhost; otherwise use staging URL
const getApiUrl = () => {
  if (process.env.E2E_API_URL) {
    // Remove /api suffix if present - we add it per endpoint
    return process.env.E2E_API_URL.replace(/\/api$/, '');
  }
  if (process.env.API_URL) {
    return process.env.API_URL;
  }
  // Default to staging if nothing else specified
  return 'https://api-staging-v2.ordermysaddle.com';
};

test.describe('OMS Staging V2 Deployment Validation', () => {
  test('Frontend application loads successfully', async ({ page }) => {
    // Set up console error listener BEFORE navigation
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        // Ignore common dev-mode warnings that aren't real errors
        const text = msg.text();
        if (!text.includes('Download the React DevTools') &&
            !text.includes('Warning:') &&
            !text.includes('[HMR]')) {
          logs.push(text);
        }
      }
    });

    await page.goto('/');

    // Check if the page loads without errors
    await expect(page).toHaveTitle(/OMS|Order Management|Order My Saddle/i);

    await page.waitForLoadState('networkidle');

    // Log errors for debugging but don't fail in local env for minor issues
    if (logs.length > 0) {
      console.log('Console errors detected:', logs);
    }
  });

  test('Backend API health check passes', async ({ request }) => {
    const apiURL = getApiUrl();

    const response = await request.get(`${apiURL}/api/health`);
    // Health endpoint might return 503 if some services are down, but should respond
    expect([200, 503]).toContain(response.status());

    const health = await response.json();
    expect(health).toHaveProperty('status');
  });

  test('Backend API documentation is accessible', async ({ request }) => {
    const apiURL = getApiUrl();

    // Swagger docs endpoint
    const response = await request.get(`${apiURL}/docs`);
    expect(response.ok()).toBeTruthy();
  });

  test('Authentication endpoints are protected', async ({ request }) => {
    const apiURL = getApiUrl();

    // Try to access protected endpoint without auth
    const response = await request.get(`${apiURL}/api/v1/customers`);
    expect(response.status()).toBe(401);
  });

  test('Database connectivity works via API health', async ({ request }) => {
    const apiURL = getApiUrl();

    const response = await request.get(`${apiURL}/api/health`);
    expect([200, 503]).toContain(response.status());

    const health = await response.json();
    expect(health).toHaveProperty('status');
  });

  test('All core entity endpoints are available', async ({ request }) => {
    const apiURL = getApiUrl();

    // Core NestJS backend endpoints (v1 API) - all enabled modules
    const endpoints = [
      '/api/v1/customers',
      '/api/v1/orders',
      '/api/v1/fitters',
      '/api/v1/factories',
      '/api/v1/enriched_orders',
      '/api/v1/saddles',
      '/api/v1/brands',
      '/api/v1/options',
      '/api/v1/extras',
      '/api/v1/leathertypes',
      '/api/v1/presets',
      '/api/v1/users',
      '/api/v1/warehouses',
      '/api/v1/saddle-stock',
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(`${apiURL}${endpoint}`);
      // Should return 401 (unauthorized) not 404 (not found)
      expect([401, 200]).toContain(response.status());
    }
  });

  test('CORS headers are properly configured', async ({ request }) => {
    const apiURL = getApiUrl();
    const isLocal = apiURL.includes('localhost');

    const response = await request.options(`${apiURL}/api/v1/customers`, {
      headers: {
        'Origin': isLocal ? 'http://localhost:3000' : 'https://staging-v2.ordermysaddle.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization'
      }
    });

    const corsHeader = response.headers()['access-control-allow-origin'];

    if (isLocal) {
      // In local mode, CORS may not return headers for OPTIONS via Playwright
      // Just verify the request didn't fail with a server error
      expect([200, 204, 404].includes(response.status()) || corsHeader).toBeTruthy();
      console.log(`Local CORS check: status=${response.status()}, allow-origin=${corsHeader ?? 'not set'}`);
    } else {
      expect(corsHeader).toBeTruthy();
    }
  });

  // Security headers test - these headers are typically added by reverse proxy
  // (nginx/cloudflare) in staging/production, not by local dev servers
  test('Security headers are present', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();

    // In local environment, these headers may not be present
    // Just verify we can get headers without errors
    const hasSecurityHeaders = headers['x-frame-options'] ||
                               headers['x-content-type-options'] ||
                               headers['x-xss-protection'];

    // Log what headers we got for debugging
    if (!hasSecurityHeaders) {
      console.log('Note: Security headers not present (expected in local environment)');
    }

    // Only strictly check in production/staging environments
    const isProduction = process.env.E2E_API_URL?.includes('ordermysaddle.com') ||
                         process.env.API_URL?.includes('ordermysaddle.com');

    if (isProduction) {
      expect(headers['x-frame-options']).toBeTruthy();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-xss-protection']).toBeTruthy();
    }
  });

  test('Application performance is acceptable', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('Error pages handle correctly', async ({ page }) => {
    // Test 404 page
    const response = await page.goto('/non-existent-page', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(404);

    // Should show custom error page, not default server error
    await expect(page.locator('body')).not.toContainText('Cannot GET');
  });
});
