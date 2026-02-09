import { test, expect, request } from '@playwright/test';

/**
 * Product Entities E2E Tests
 * Testing all product-related entities (Saddles, Brands, Options, Extras, Leathertypes, Presets)
 * NestJS backend API validation
 *
 * All product entity modules are now enabled in the NestJS backend:
 * - BrandModule
 * - LeathertypeModule
 * - OptionModule
 * - ExtraModule
 * - PresetModule
 * - SaddleModule
 *
 * Available endpoints:
 * - /api/v1/saddles - Saddle models
 * - /api/v1/brands - Brands
 * - /api/v1/options - Options
 * - /api/v1/extras - Extras
 * - /api/v1/leathertypes - Leather types
 * - /api/v1/presets - Presets
 */

test.describe('Product Entities API @products @critical', () => {
  let apiContext: any;
  let authToken: string;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'OMS-E2E-Tests/1.0.0'
      },
      ignoreHTTPSErrors: true,
    });
  });

  test.beforeEach(async ({ playwright }) => {
    const loginResponse = await apiContext.post('http://localhost:3001/api/v1/auth/email/login', {
      data: {
        email: 'admin@omsaddle.com',
        password: 'AdminPass123!'
      }
    });

    if (!loginResponse.ok()) {
      console.log('Login failed. Status:', loginResponse.status());
      console.log('Response text:', await loginResponse.text());
    }

    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    authToken = loginData.token;

    apiContext = await playwright.request.newContext({
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': `token=${authToken}`,
        'User-Agent': 'OMS-E2E-Tests/1.0.0'
      },
      ignoreHTTPSErrors: true,
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  // ==================== Brands ====================

  test('should list brands via API @brands @critical', async () => {
    const brandsResponse = await apiContext.get('http://localhost:3001/api/v1/brands');
    expect(brandsResponse.ok()).toBeTruthy();

    const brandsData = await brandsResponse.json();

    if (Array.isArray(brandsData)) {
      console.log(`Brands returned: ${brandsData.length}`);
      if (brandsData.length > 0) {
        expect(brandsData[0]).toHaveProperty('id');
        expect(brandsData[0]).toHaveProperty('brandName');
      }
    } else if (brandsData.data) {
      console.log(`Brands returned: ${brandsData.data.length}`);
      expect(Array.isArray(brandsData.data)).toBeTruthy();
      if (brandsData.data.length > 0) {
        expect(brandsData.data[0]).toHaveProperty('id');
        expect(brandsData.data[0]).toHaveProperty('brandName');
      }
    }
  });

  test('should get active brands @brands @api', async () => {
    const activeResponse = await apiContext.get('http://localhost:3001/api/v1/brands/active');
    expect(activeResponse.ok()).toBeTruthy();

    const activeData = await activeResponse.json();
    expect(Array.isArray(activeData)).toBeTruthy();

    console.log(`Active brands: ${activeData.length}`);
  });

  // ==================== Saddles ====================

  test('should list saddles (models) via API @saddles @critical', async () => {
    const listResponse = await apiContext.get('http://localhost:3001/api/v1/saddles?page=1&limit=10');
    expect(listResponse.ok()).toBeTruthy();

    const listData = await listResponse.json();
    expect(listData).toHaveProperty('data');
    expect(listData).toHaveProperty('total');
    expect(listData).toHaveProperty('pages');
    expect(Array.isArray(listData.data)).toBeTruthy();

    console.log(`Saddles returned: ${listData.data.length} of ${listData.total} total`);

    if (listData.data.length > 0) {
      const saddle = listData.data[0];
      expect(saddle).toHaveProperty('id');
      expect(saddle).toHaveProperty('brand');
      expect(saddle).toHaveProperty('modelName');
      expect(saddle).toHaveProperty('sequence');
      expect(typeof saddle.id).toBe('number');
    }
  });

  test('should get active saddles @saddles @api', async () => {
    const activeResponse = await apiContext.get('http://localhost:3001/api/v1/saddles/active');
    expect(activeResponse.ok()).toBeTruthy();

    const activeData = await activeResponse.json();
    expect(Array.isArray(activeData)).toBeTruthy();

    console.log(`Active saddles: ${activeData.length}`);

    activeData.forEach((saddle: any) => {
      expect(saddle.isActive).toBe(true);
    });
  });

  test('should get unique brands from saddles @saddles @api', async () => {
    const brandsResponse = await apiContext.get('http://localhost:3001/api/v1/saddles/brands');
    expect(brandsResponse.ok()).toBeTruthy();

    const brands = await brandsResponse.json();
    expect(Array.isArray(brands)).toBeTruthy();

    console.log(`Unique brands: ${brands.length}`);
  });

  // ==================== Leathertypes ====================

  test('should list leathertypes via API @leathertypes @critical', async () => {
    const leathertypesResponse = await apiContext.get('http://localhost:3001/api/v1/leathertypes');
    expect(leathertypesResponse.ok()).toBeTruthy();

    const leathertypesData = await leathertypesResponse.json();

    if (leathertypesData.data) {
      expect(Array.isArray(leathertypesData.data)).toBeTruthy();
      console.log(`Leathertypes returned: ${leathertypesData.data.length}`);
    } else if (Array.isArray(leathertypesData)) {
      console.log(`Leathertypes returned: ${leathertypesData.length}`);
    }
  });

  // ==================== Options ====================

  test('should list options via API @options @critical', async () => {
    const optionsResponse = await apiContext.get('http://localhost:3001/api/v1/options');
    expect(optionsResponse.ok()).toBeTruthy();

    const optionsData = await optionsResponse.json();

    if (optionsData.data) {
      expect(Array.isArray(optionsData.data)).toBeTruthy();
      console.log(`Options returned: ${optionsData.data.length}`);
      if (optionsData.data.length > 0) {
        expect(optionsData.data[0]).toHaveProperty('id');
        expect(optionsData.data[0]).toHaveProperty('name');
      }
    } else if (Array.isArray(optionsData)) {
      console.log(`Options returned: ${optionsData.length}`);
    }
  });

  // ==================== Extras ====================

  test('should list extras via API @extras @critical', async () => {
    const extrasResponse = await apiContext.get('http://localhost:3001/api/v1/extras');
    expect(extrasResponse.ok()).toBeTruthy();

    const extrasData = await extrasResponse.json();

    if (extrasData.data) {
      expect(Array.isArray(extrasData.data)).toBeTruthy();
      console.log(`Extras returned: ${extrasData.data.length}`);
      if (extrasData.data.length > 0) {
        expect(extrasData.data[0]).toHaveProperty('id');
        expect(extrasData.data[0]).toHaveProperty('name');
      }
    } else if (Array.isArray(extrasData)) {
      console.log(`Extras returned: ${extrasData.length}`);
    }
  });

  test('should get active extras @extras @api', async () => {
    const activeResponse = await apiContext.get('http://localhost:3001/api/v1/extras/active');
    expect(activeResponse.ok()).toBeTruthy();

    const activeData = await activeResponse.json();
    expect(Array.isArray(activeData)).toBeTruthy();

    console.log(`Active extras: ${activeData.length}`);
  });

  // ==================== Presets ====================

  test('should list presets via API @presets @critical', async () => {
    const presetsResponse = await apiContext.get('http://localhost:3001/api/v1/presets');
    expect(presetsResponse.ok()).toBeTruthy();

    const presetsData = await presetsResponse.json();

    if (presetsData.data) {
      expect(Array.isArray(presetsData.data)).toBeTruthy();
      console.log(`Presets returned: ${presetsData.data.length}`);
    } else if (Array.isArray(presetsData)) {
      console.log(`Presets returned: ${presetsData.length}`);
    }
  });

  // ==================== Pagination & Filtering ====================

  test('should handle saddles pagination @pagination @api', async () => {
    const saddlesResponse = await apiContext.get('http://localhost:3001/api/v1/saddles?page=1&limit=10');
    expect(saddlesResponse.ok()).toBeTruthy();

    const saddlesData = await saddlesResponse.json();
    expect(saddlesData).toHaveProperty('data');
    expect(saddlesData).toHaveProperty('total');
    expect(saddlesData).toHaveProperty('pages');
    expect(Array.isArray(saddlesData.data)).toBeTruthy();
    expect(saddlesData.data.length).toBeLessThanOrEqual(10);

    console.log(`Saddles pagination: page 1, ${saddlesData.data.length} items, ${saddlesData.total} total`);
  });

  test('should handle saddles filtering by brand @filtering @api', async () => {
    const brandsResponse = await apiContext.get('http://localhost:3001/api/v1/saddles/brands');
    const brands = await brandsResponse.json();

    if (brands.length > 0) {
      const brandName = brands[0];
      const saddlesResponse = await apiContext.get(`http://localhost:3001/api/v1/saddles?page=1&limit=10&brand=${encodeURIComponent(brandName)}`);
      expect(saddlesResponse.ok()).toBeTruthy();

      const saddlesData = await saddlesResponse.json();
      expect(saddlesData).toHaveProperty('data');
      expect(Array.isArray(saddlesData.data)).toBeTruthy();

      console.log(`Saddles with brand "${brandName}": ${saddlesData.data.length}`);
    }
  });

  test('should handle saddles active-only filter @filtering @api', async () => {
    const activeResponse = await apiContext.get('http://localhost:3001/api/v1/saddles?page=1&limit=10&activeOnly=true');
    expect(activeResponse.ok()).toBeTruthy();

    const activeData = await activeResponse.json();
    expect(activeData).toHaveProperty('data');
    expect(Array.isArray(activeData.data)).toBeTruthy();

    activeData.data.forEach((saddle: any) => {
      expect(saddle.isActive).toBe(true);
    });
  });
});
