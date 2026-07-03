// Add custom jest matchers for testing-library
import '@testing-library/jest-dom';
import React from 'react';

// Add custom Jest matchers for API tests
import { setupMatchers } from './tests/api/shared/matchers';
setupMatchers();

// Polyfill fetch for Node.js environment
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);

// Set up Jest DOM matchers explicitly
expect.extend({
  toHaveClass(received, className) {
    const pass = received.classList.contains(className);
    if (pass) {
      return {
        message: () => `expected ${received} not to have class "${className}"`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to have class "${className}"`,
        pass: false,
      };
    }
  },
});

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    return React.createElement('img', props);
  },
}));

// Suppress console errors during tests
const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning: ReactDOM.render') ||
      args[0].includes('Warning: React.createElement') ||
      args[0].includes('Warning: An update to') ||
      args[0].includes('Warning: validateDOMNesting'))
  ) {
    return;
  }
  originalConsoleError(...args);
};
