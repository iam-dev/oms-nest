import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config();

/**
 * The frontend middleware verifies the session cookie with JWT_SECRET, which
 * has to be the same secret the backend signs tokens with (AUTH_JWT_SECRET).
 * The backend reads that from backend/.env when started by webServer below, so
 * read it from there too rather than requiring it to be exported by hand.
 */
const frontendJwtSecret =
  process.env.JWT_SECRET ||
  process.env.AUTH_JWT_SECRET ||
  dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env'), processEnv: {} })
    .parsed?.AUTH_JWT_SECRET ||
  '';

// Environment configuration
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

// For staging/production, only run smoke/readonly tests
const grepFilter = ['staging', 'production'].includes(ENVIRONMENT)
  ? /@smoke|@readonly/
  : undefined;

/**
 * 🚀 Enhanced Playwright configuration for OMS E2E testing
 * 🔄 Fully automated DevSecOps pipeline compatible
 * 🔐 Security-first approach with environment-based testing
 * 🎯 Automation ready with zero interventions
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-output',
  grep: grepFilter,

  /* Run tests in files in parallel for faster execution */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry configuration for reliability */
  retries: process.env.CI ? 3 : 1,

  /* Workers configuration for CI/CD optimization */
  workers: process.env.CI ? 2 : undefined,

  /* Comprehensive reporter configuration */
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

    /* NOTE: do NOT set extraHTTPHeaders here. Browser contexts attach them to
       every request the page makes, including the cross-origin fetches the
       frontend sends to the API. Custom headers are not CORS-safelisted, so
       each one must appear in the backend's Access-Control-Allow-Headers or
       the preflight fails and every client-side API call dies — which silently
       logs the app out mid-test. API request contexts set their own headers
       (see shared/auth-state.ts), where CORS does not apply. */

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

  /* Browser matrix — staging/production use chromium only (smoke tests don't
     need cross-browser, and a single project avoids rate-limit issues from
     7 parallel browser contexts hitting auth endpoints simultaneously). */
  projects: ['staging', 'production'].includes(ENVIRONMENT)
    ? [
        {
          name: 'chromium',
          use: {
            ...devices['Desktop Chrome'],
          },
        },
      ]
    : [
        {
          name: 'chromium',
          use: {
            ...devices['Desktop Chrome'],
          },
        },

        {
          name: 'firefox',
          use: {
            ...devices['Desktop Firefox'],
          },
        },

        {
          name: 'webkit',
          use: {
            ...devices['Desktop Safari'],
          },
        },

        {
          name: 'Mobile Chrome',
          use: {
            ...devices['Pixel 5'],
          },
        },

        {
          name: 'Mobile Safari',
          use: {
            ...devices['iPhone 12'],
          },
        },

        {
          name: 'Microsoft Edge',
          use: {
            ...devices['Desktop Edge'],
            channel: 'msedge',
          },
        },

        {
          name: 'Google Chrome',
          use: {
            ...devices['Desktop Chrome'],
            channel: 'chrome',
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
        ...process.env,
        NODE_ENV: 'test',
        PORT: '3001',
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
        ...process.env,
        NODE_ENV: 'test',
        // Frontend code appends /api/v1/... so base URL must NOT include /api
        NEXT_PUBLIC_API_URL: config.apiURL.replace(/\/api$/, ''),
        NEXTAUTH_URL: config.baseURL,
        PORT: '3000',
        // The middleware verifies the session cookie with JWT_SECRET and fails
        // closed when it is unset, redirecting every protected route to /login.
        // It must be the secret the backend signs with, so default it to the
        // backend's AUTH_JWT_SECRET rather than leaving it blank.
        JWT_SECRET: frontendJwtSecret,
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
    automation: 'CI-Compatible',
    security: 'DevSecOps-Enabled'
  },
});