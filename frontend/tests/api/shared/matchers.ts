/**
 * Custom Jest matchers for API tests and DOM testing
 */

// Import testing library DOM matchers
import '@testing-library/jest-dom';

export const toBeOneOfMatcher = {
  toBeOneOf(received: unknown, expected: Array<unknown>) {
    const pass = expected.includes(received);
    return {
      message: () => pass
        ? `expected ${received} not to be one of ${expected.join(', ')}`
        : `expected ${received} to be one of ${expected.join(', ')}`,
      pass,
    };
  },
};

// Extend Jest expect with the matcher
export const setupMatchers = () => {
  expect.extend(toBeOneOfMatcher);
};