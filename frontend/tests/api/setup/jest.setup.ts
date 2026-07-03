/**
 * Jest setup for API tests
 */

import { TextEncoder, TextDecoder } from 'util';
// @ts-expect-error -- node-fetch v2 ships no declaration file; @types/node-fetch is not installed
import fetch, { Headers, Request, Response } from 'node-fetch';

// Add missing globals for Jest environment
Object.assign(global, {
  TextEncoder,
  TextDecoder,
});

// Simple fetch polyfill for Jest test environment
Object.assign(global, {
  fetch,
  Headers,
  Request,
  Response,
});

// Set test timeout
jest.setTimeout(30000);

// Global test configuration
global.API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';

// Console configuration for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress expected console errors during tests unless in debug mode
  if (!process.env.DEBUG_TESTS) {
    console.error = (...args: unknown[]) => {
      // Still show authentication and important API errors
      const message = args.join(' ');
      if (message.includes('authentication') || message.includes('ECONNREFUSED') || message.includes('500')) {
        originalConsoleError(...args);
      }
    };

    console.warn = (...args: unknown[]) => {
      // Suppress most warnings unless they're critical
      const message = args.join(' ');
      if (message.includes('deprecated') === false) {
        originalConsoleWarn(...args);
      }
    };
  }
});

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

afterEach(async () => {
  // Clean up any active API requests after each test to prevent Jest warnings
  try {
    // Dynamically import and clean up the API client to avoid circular dependencies
    const mod = await import('../shared/api-client');
    const client = (mod as { apiClient?: { cleanup?: () => void } }).apiClient;
    if (client && typeof client.cleanup === 'function') {
      client.cleanup();
    }
  } catch {
    // Ignore cleanup errors - just ensure we don't leave hanging requests
  }
});

// Global test utilities
declare global {
  var API_BASE_URL: string;
}

// Add custom Jest matchers
import { setupMatchers } from '../shared/matchers';
setupMatchers();
