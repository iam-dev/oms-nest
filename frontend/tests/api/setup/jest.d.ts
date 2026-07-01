/**
 * Custom Jest matchers for API tests
 */

declare namespace jest {
  interface Matchers<R> {
    /**
     * Checks if received value is one of the expected values
     */
    toBeOneOf(expected: Array<unknown>): R;
  }
}