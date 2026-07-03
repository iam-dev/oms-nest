import { FullConfig } from '@playwright/test';

// Add Node.js polyfills for Playwright
if (typeof globalThis.TransformStream === 'undefined') {
  // @ts-expect-error polyfilling TransformStream with minimal stub
  globalThis.TransformStream = class TransformStream {
    readable: unknown;
    writable: unknown;

    constructor(_transformer?: unknown, _writableStrategy?: unknown, _readableStrategy?: unknown) {
      this.readable = { getReader: () => ({}) };
      this.writable = { getWriter: () => ({}) };
    }
  };
}

async function globalSetup(_config: FullConfig) {
  console.log('Global setup: Starting...');

  // Check if backend API is available using the NestJS health endpoint
  try {
    const response = await fetch('http://localhost:3001/health', {
      method: 'GET',
      // Note: Node.js fetch doesn't support timeout option, using AbortController
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.warn(`Backend API health check failed (${response.status}), but continuing...`);
    } else {
      const healthData = await response.json();
      console.log('Backend API is available:', healthData);
    }
  } catch (error) {
    console.warn('Backend API not available, tests may fail:', error);
  }

  console.log('Global setup: Complete');
}

export default globalSetup;