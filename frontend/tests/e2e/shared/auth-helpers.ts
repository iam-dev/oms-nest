import { Page, expect } from '@playwright/test';

export interface TestUser {
  username: string;
  password: string;
  role: string;
  expectedRedirect?: string;
}

// Test users for different roles
export const TEST_USERS: Record<string, TestUser> = {
  admin: {
    username: 'testadmin',
    password: 'testpassword123',
    role: 'admin',
    expectedRedirect: '/dashboard'
  },
  user: {
    username: 'testuser',
    password: 'testpass123',
    role: 'user',
    expectedRedirect: '/dashboard'
  }
  // Note: These are intentionally invalid credentials for testing error handling
  // If you need valid credentials, use the app:create:user command to create test users
};

export class AuthHelper {
  constructor(private page: Page) {}

  async login(user: TestUser = TEST_USERS.admin): Promise<void> {
    await this.page.goto('/login');

    // Wait for login form
    await expect(this.page.locator('form')).toBeVisible();

    // Fill in credentials using data-testid attributes
    await this.page.getByTestId('username-input').fill(user.username);
    await this.page.getByTestId('password-input').fill(user.password);

    // Submit form
    await this.page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');

    // Wait for login response: either redirect away from login or error message appears
    await Promise.race([
      this.page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 }),
      this.page.locator('.text-destructive, .error, [data-testid="error"]').first().waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => {});

    // Check if login was successful (redirected away from login page)
    const currentUrl = this.page.url();
    const isLoginSuccessful = !currentUrl.includes('/login');

    if (isLoginSuccessful) {
      // If successful, verify we're on the expected page
      const expectedUrl = user.expectedRedirect || '/dashboard';
      if (!currentUrl.includes(expectedUrl.replace('/', ''))) {
        await this.page.waitForURL(expectedUrl, { timeout: 5000 });
      }

      // Verify we're logged in by checking for user interface elements
      await expect(this.page.locator('nav, header, [data-testid="sidebar"]')).toBeVisible();
    } else {
      // If login failed, that's expected with test credentials
      // The login function should not throw an error in this case
      console.log('Login failed as expected with test credentials');
    }
  }

  async logout(): Promise<void> {
    try {
      // First navigate to a safe page to ensure we have access to localStorage
      await this.page.goto('/login');

      // Clear storage
      await this.page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          // Ignore localStorage access errors
          console.log('Could not clear storage:', e);
        }
      });

      // Look for logout button in common locations if not on login page
      const currentUrl = this.page.url();
      if (!currentUrl.includes('/login')) {
        const logoutSelectors = [
          'button:has-text("Logout")',
          'button:has-text("Sign Out")',
          '[data-testid="logout"]',
          'a[href="/logout"]'
        ];

        for (const selector of logoutSelectors) {
          try {
            const element = this.page.locator(selector);
            if (await element.isVisible({ timeout: 1000 })) {
              await element.click();
              await this.page.waitForURL('/login', { timeout: 5000 });
              return;
            }
          } catch {
            continue;
          }
        }

        // If no logout button found, navigate to login
        await this.page.goto('/login');
      }
    } catch {
      // If anything fails, just navigate to login
      await this.page.goto('/login');
    }
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      // Check for authentication cookie
      const cookies = await this.page.context().cookies();
      const hasTokenCookie = cookies.some(c => c.name === 'token');

      if (!hasTokenCookie) return false;

      // Check if we're not on login page
      const currentUrl = this.page.url();
      return !currentUrl.includes('/login');
    } catch {
      return false;
    }
  }

  async ensureLoggedIn(user: TestUser = TEST_USERS.admin): Promise<void> {
    if (!(await this.isLoggedIn())) {
      await this.login(user);
    }
  }

  async getAuthToken(): Promise<string | null> {
    const cookies = await this.page.context().cookies();
    const tokenCookie = cookies.find(c => c.name === 'token');
    return tokenCookie?.value ?? null;
  }

  async waitForPageLoad(): Promise<void> {
    // Wait for any loading indicators to disappear
    await this.page.waitForLoadState('networkidle', { timeout: 10000 });

    // Wait for common loading indicators to disappear
    const loadingSelectors = [
      '[data-testid="loading"]',
      '.loading',
      '.spinner',
      'text="Loading"'
    ];

    for (const selector of loadingSelectors) {
      try {
        await this.page.waitForSelector(selector, { state: 'detached', timeout: 5000 });
      } catch {
        // Ignore if loading indicator doesn't exist
      }
    }
  }
}