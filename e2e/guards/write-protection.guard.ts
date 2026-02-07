import { Page } from '@playwright/test';

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const WHITELISTED_PATHS = ['/auth/email/login', '/health'];

export async function applyWriteProtection(page: Page): Promise<void> {
  const environment = process.env.ENVIRONMENT || 'local';

  if (!['staging', 'production'].includes(environment)) {
    return; // No protection needed for local/CI
  }

  console.log(`Write protection active for ${environment} environment`);

  await page.route('**/api/**', async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    // Allow whitelisted paths
    if (WHITELISTED_PATHS.some(path => url.includes(path))) {
      return route.continue();
    }

    // Block write methods
    if (WRITE_METHODS.includes(method)) {
      console.warn(`BLOCKED: ${method} ${url} (write protection active in ${environment})`);
      return route.abort('blockedbyclient');
    }

    return route.continue();
  });
}
