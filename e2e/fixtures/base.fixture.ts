import { test as base } from '@playwright/test';
import { applyWriteProtection } from '../guards/write-protection.guard';

export const test = base.extend({
  page: async ({ page }, use) => {
    await applyWriteProtection(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
