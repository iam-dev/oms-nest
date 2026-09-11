import { test, expect } from '@playwright/test';
import {
  API_CONTEXT_HEADERS,
  ROLE_CREDENTIALS,
  resolveApiUrl,
} from '../shared/auth-state';
import { loginApiWithRetry } from '../shared/api-login';

const API_URL = resolveApiUrl();

test.describe('Debug API Tests @smoke @readonly', () => {

  test('should authenticate with absolute URLs', async ({ playwright }) => {
    // Create API request context with no baseURL
    const apiContext = await playwright.request.newContext({
      extraHTTPHeaders: { ...API_CONTEXT_HEADERS },
      ignoreHTTPSErrors: true,
    });

    // Test health endpoint with absolute URL
    console.log('Testing health endpoint...');
    const healthResponse = await apiContext.get(`${API_URL}/api/health`);
    console.log('Health status:', healthResponse.status());

    // Test login with absolute URL
    console.log('Testing login...');
    const loginResponse = await loginApiWithRetry(
      apiContext,
      API_URL,
      ROLE_CREDENTIALS.admin.email,
      ROLE_CREDENTIALS.admin.password,
    );

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
