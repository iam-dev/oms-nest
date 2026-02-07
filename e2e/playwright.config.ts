import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Environment configuration for Ralph Loop automation
const ENVIRONMENT = process.env.ENVIRONMENT || 'local';

const environmentConfig = {
  local: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    apiURL: process.env.E2E_API_URL || 'http://localhost:3001/api',
  },
  staging: {
    baseURL: process.env.STAGING_BASE_URL || 'https://next-staging.ordermysaddle.com',
    apiURL: process.env.STAGING_API_URL || 'https://api-nest-staging.ordermysaddle.com',
  },
  production: {
    baseURL: process.env.PRODUCTION_BASE_URL || 'https://ordermysaddle.com',
    apiURL: process.env.PRODUCTION_API_URL || 'https://api.ordermysaddle.com',
  },
};

const config = environmentConfig[ENVIRONMENT];

/**
 * 🚀 Enhanced Playwright configuration for OMS E2E testing
 * 🔄 Fully automated DevSecOps pipeline compatible
 * 🔐 Security-first approach with environment-based testing
 * 🎯 Ralph Loop automation ready with zero interventions
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-output',

  /* Run tests in files in parallel for faster execution */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry configuration for reliability */
  retries: process.env.CI ? 3 : 1,

  /* Workers configuration for CI/CD optimization */
  workers: process.env.CI ? 2 : undefined,

  /* Comprehensive reporter configuration for Ralph Loop integration */
  reporter: [
    ['html', {
      outputFolder: './test-results/html-report',
      open: 'never' // Never open browser in automated environment
    }],
    ['json', {
      outputFile: './test-results/results.json'
    }],
    ['junit', {
      outputFile: './test-results/junit.xml'
    }],
    ['blob', {
      outputFile: './test-results/blob-report.zip'
    }],
    // CI-specific reporters
    ...(process.env.CI ? [
      ['github'],
      ['list', { printSteps: true }]
    ] : [
      ['list']
    ])
  ],

  /* Shared settings for all projects - security enhanced */
  use: {
    /* Environment-based base URL */
    baseURL: config.baseURL,

    /* Security headers for testing */
    extraHTTPHeaders: {
      'X-API-Base-URL': config.apiURL,
      'X-Test-Environment': ENVIRONMENT,
      'X-Test-Runner': 'Playwright',
      'User-Agent': 'OMS-E2E-Tests/1.0.0'
    },

    /* Tracing configuration for debugging */
    trace: 'retain-on-failure',

    /* Video recording for failure analysis */
    video: 'retain-on-failure',

    /* Screenshot configuration */
    screenshot: 'only-on-failure',

    /* Timeout settings optimized for real-world scenarios */
    actionTimeout: 15000,
    navigationTimeout: 30000,

    /* Accept downloads for file testing */
    acceptDownloads: true,

    /* Ignore HTTPS errors for staging/local environments */
    ignoreHTTPSErrors: ENVIRONMENT !== 'production',

    /* Viewport configuration */
    viewport: { width: 1280, height: 720 },
  },

  /* Comprehensive browser matrix for thorough testing */
  projects: [
    // 🖥️ Desktop browsers - Primary testing targets
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        extraHTTPHeaders: {
          'X-Test-Environment': ENVIRONMENT,
          'X-Browser': 'Chrome'
        },
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        extraHTTPHeaders: {
          'X-Test-Environment': ENVIRONMENT,
          'X-Browser': 'Firefox'
        },
      },
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        extraHTTPHeaders: {
          'X-Test-Environment': ENVIRONMENT,
          'X-Browser': 'Safari'
        },
      },
    },

    // 📱 Mobile testing for responsive design validation
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        extraHTTPHeaders: {
          'X-Test-Environment': ENVIRONMENT,
          'X-Browser': 'Mobile-Chrome'
        },
      },
    },

    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
        extraHTTPHeaders: {
          'X-Test-Environment': ENVIRONMENT,
          'X-Browser': 'Mobile-Safari'
        },
      },
    },

    // 🖥️ Branded browsers for compatibility testing
    {
      name: 'Microsoft Edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        extraHTTPHeaders: {
          'X-Test-Environment': ENVIRONMENT,
          'X-Browser': 'Edge'
        },
      },
    },

    {
      name: 'Google Chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        extraHTTPHeaders: {
          'X-Test-Environment': ENVIRONMENT,
          'X-Browser': 'Chrome-Stable'
        },
      },
    },
  ],

  /* Global setup and teardown for test environment preparation */
  globalSetup: require.resolve('./utils/global-setup'),
  globalTeardown: require.resolve('./utils/global-teardown'),

  /* Web Server configuration for automated local testing */
  webServer: ENVIRONMENT === 'local' ? [
    {
      command: 'cd ../backend && npm run start:dev',
      port: 3001,
      reuseExistingServer: true,
      timeout: 120 * 1000,
      env: {
        NODE_ENV: 'test',
        DATABASE_HOST: 'localhost',
        DATABASE_PORT: '5433',
        DATABASE_USERNAME: 'postgres',
        DATABASE_PASSWORD: 'postgres',
        DATABASE_NAME: 'oms_nest',
        JWT_ACCESS_TOKEN_SECRET: 'test-jwt-secret-key-for-e2e',
        JWT_REFRESH_TOKEN_SECRET: 'test-jwt-refresh-secret-for-e2e',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        PORT: '3001'
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'cd ../frontend && npm run dev',
      port: 3000,
      reuseExistingServer: true,
      timeout: 120 * 1000,
      env: {
        NODE_ENV: 'test',
        NEXT_PUBLIC_API_URL: config.apiURL,
        NEXTAUTH_URL: config.baseURL,
        PORT: '3000'
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ] : undefined,

  /* Test file patterns for organized test discovery */
  testMatch: [
    '**/*.spec.ts',
    '**/*.test.ts',
    '**/tests/**/*.{js,ts}',
    '**/specs/**/*.{js,ts}'
  ],

  /* Timeout settings for reliable test execution */
  timeout: 90 * 1000, // 90 seconds for complex e2e workflows

  expect: {
    /* Timeout for expect() assertions */
    timeout: 20 * 1000, // 20 seconds for UI state changes

    /* Soft assertions to continue test execution */
    toMatchSnapshot: {
      /* Threshold for visual regression testing */
      threshold: 0.2,
      mode: 'strict'
    }
  },

  /* Test metadata for comprehensive reporting */
  metadata: {
    project: 'OMS - Order Management System',
    version: process.env.npm_package_version || '1.0.0',
    environment: ENVIRONMENT,
    testSuite: 'E2E-Comprehensive',
    automation: 'Ralph-Loop-Compatible',
    security: 'DevSecOps-Enabled'
  },
});