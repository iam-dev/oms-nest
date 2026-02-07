import { test, expect, request } from '@playwright/test';

const getApiUrl = () => {
  if (process.env.STAGING_API_URL && process.env.ENVIRONMENT === 'staging') {
    return process.env.STAGING_API_URL;
  }
  if (process.env.E2E_API_URL) {
    return process.env.E2E_API_URL.replace(/\/api$/, '');
  }
  return 'http://localhost:3001';
};

const API_URL = getApiUrl();

test.describe('Debug API Tests', () => {

  test('should authenticate with absolute URLs', async ({ playwright }) => {
    // Create API request context with no baseURL
    const apiContext = await playwright.request.newContext({
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      ignoreHTTPSErrors: true,
    });

    // Test health endpoint with absolute URL
    console.log('Testing health endpoint...');
    const healthResponse = await apiContext.get(`${API_URL}/api/health`);
    console.log('Health status:', healthResponse.status());

    // Test login with absolute URL
    console.log('Testing login...');
    const loginResponse = await apiContext.post(`${API_URL}/api/v1/auth/email/login`, {
      data: {
        email: 'admin@omsaddle.com',
        password: 'AdminPass123!'
      }
    });

    console.log('Login status:', loginResponse.status());
    if (!loginResponse.ok()) {
      console.log('Login error:', await loginResponse.text());
    }

    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    expect(loginData).toHaveProperty('token');
    expect(loginData).toHaveProperty('user');

    await apiContext.dispose();
  });

});
