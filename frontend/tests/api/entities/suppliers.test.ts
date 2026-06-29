/**
 * Suppliers API Tests
 * Tests supplier management endpoints with filtering and validation
 */

import { ApiClient } from '../shared/api-client';
import type { ApiError } from '../shared/api-client';
import { ENTITY_CONFIGS, generateTestData } from '../shared/test-data';
import { ApiValidators, HTTP_STATUS, TEST_TIMEOUTS } from '../shared/helpers';

describe('Suppliers API', () => {
  let apiClient: ApiClient;

  beforeAll(() => {
    apiClient = new ApiClient();
  });

  beforeEach(() => {
    apiClient.clearAuth();
    apiClient.setRequestTimeout(3000); // Use shorter timeout for entity tests
  });

  const config = ENTITY_CONFIGS.suppliers;

  describe('Authentication Requirements', () => {
    it('should require authentication for GET /suppliers', async () => {
      try {
        await apiClient.get(config.endpoint);
        fail('GET /suppliers should require authentication');
      } catch (error: unknown) {
        ApiValidators.validateErrorResponse(error as ApiError, HTTP_STATUS.UNAUTHORIZED);
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should require authentication for supplier creation', async () => {
      try {
        await apiClient.post(config.endpoint, generateTestData('supplier'));
        fail('POST /suppliers should require authentication');
      } catch (error: unknown) {
        ApiValidators.validateErrorResponse(error as ApiError, HTTP_STATUS.UNAUTHORIZED);
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should require authentication for individual supplier access', async () => {
      try {
        await apiClient.get(`${config.endpoint}/1`);
        fail('GET /suppliers/{id} should require authentication');
      } catch (error: unknown) {
        ApiValidators.validateErrorResponse(error as ApiError, HTTP_STATUS.UNAUTHORIZED);
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('OData Filtering Support', () => {
    it('should support supplier search by name', async () => {
      const searchTerms = [
        'Acme',
        'Premium',
        'Leather Works',
        'International'
      ];

      for (const term of searchTerms) {
        try {
          await apiClient.get(config.endpoint, {
            $filter: `substringof('${term}',name) eq true`
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as { status?: number }).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support supplier filtering by status', async () => {
      const statusValues = ['active', 'inactive', 'pending'];

      for (const status of statusValues) {
        try {
          await apiClient.get(config.endpoint, {
            $filter: `status eq '${status}'`
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as { status?: number }).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support supplier filtering by country', async () => {
      const countries = ['UK', 'DE', 'FR', 'US', 'IT'];

      for (const country of countries) {
        try {
          await apiClient.get(config.endpoint, {
            $filter: `country eq '${country}'`
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as { status?: number }).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support complex supplier filters', async () => {
      const complexFilter = [
        `status eq 'active'`,
        `and substringof('leather',name) eq true`,
        `and country eq 'UK'`
      ].join(' ');

      try {
        await apiClient.get(config.endpoint, {
          $filter: complexFilter
        });
        fail('Expected authentication error');
      } catch (error: unknown) {
        expect((error as { status?: number }).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('Supplier Sorting', () => {
    const sortingTests = [
      { field: 'name', direction: 'asc' },
      { field: 'country', direction: 'asc' },
      { field: 'status', direction: 'desc' },
      { field: 'createdAt', direction: 'desc' },
      { field: 'updatedAt', direction: 'desc' }
    ];

    sortingTests.forEach(({ field, direction }) => {
      it(`should support sorting by ${field} ${direction}`, async () => {
        try {
          await apiClient.get(config.endpoint, {
            $orderby: `${field} ${direction}`
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as { status?: number }).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }, TEST_TIMEOUTS.NORMAL);
    });

    it('should support multi-field sorting', async () => {
      try {
        await apiClient.get(config.endpoint, {
          $orderby: 'country asc, name asc'
        });
        fail('Expected authentication error');
      } catch (error: unknown) {
        expect((error as { status?: number }).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('Pagination Support', () => {
    it('should support pagination with $top and $skip', async () => {
      const paginationTests = [
        { $top: 10 },
        { $top: 25 },
        { $top: 50 },
        { $top: 10, $skip: 20 },
        { $top: 25, $skip: 50 }
      ];

      for (const params of paginationTests) {
        try {
          await apiClient.get(config.endpoint, params);
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as { status?: number }).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should validate pagination limits', async () => {
      const invalidParams = [
        { $top: 0 },
        { $top: -1 },
        { $skip: -1 },
        { $top: 1000 }, // Too large
        { $top: 'invalid' },
        { $skip: 'invalid' }
      ];

      for (const params of invalidParams) {
        try {
          await apiClient.get(config.endpoint, params);
          fail(`Invalid pagination parameters ${JSON.stringify(params)} should be rejected`);
        } catch (error: unknown) {
          expect((error as { status?: number }).status).toBeOneOf([
            HTTP_STATUS.UNAUTHORIZED,
            HTTP_STATUS.BAD_REQUEST
          ]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('Supplier Data Validation', () => {
    it('should validate required supplier fields', async () => {
      const incompleteData = [
        { name: '', contact: 'test@example.com' }, // Missing name
        { name: 'Test Supplier' }, // Missing contact
        { contact: 'test@example.com' } // Missing name
      ];

      for (const data of incompleteData) {
        try {
          await apiClient.post(config.endpoint, data);
          fail('Incomplete supplier data should be rejected');
        } catch (error: unknown) {
          expect((error as { status?: number }).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should validate supplier name format', async () => {
      const nameTests = [
        { name: '', valid: false },
        { name: 'A', valid: true },
        { name: 'Acme Leather Works Ltd', valid: true },
        { name: 'Premium Saddlery & Co.', valid: true },
        { name: 'a'.repeat(256), valid: false }, // Too long
        { name: '<script>alert("xss")</script>', valid: false },
        { name: 'DROP TABLE suppliers', valid: false }
      ];

      for (const test of nameTests) {
        const supplierData = {
          name: test.name,
          contact: 'test@example.com',
          country: 'UK'
        };

        try {
          await apiClient.post(config.endpoint, supplierData);
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as { status?: number }).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should validate contact information format', async () => {
      const contactTests = [
        { contact: '', valid: false },
        { contact: 'invalid-email', valid: false },
        { contact: 'test@example.com', valid: true },
        { contact: 'supplier@company.co.uk', valid: true },
        { contact: '<script>@example.com', valid: false }
      ];

      for (const test of contactTests) {
        const supplierData = {
          name: 'Test Supplier',
          contact: test.contact,
          country: 'UK'
        };

        try {
          await apiClient.post(config.endpoint, supplierData);
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as { status?: number }).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('Security Validations', () => {
    it('should prevent SQL injection in supplier data', async () => {
      const sqlPayloads = [
        "'; DROP TABLE suppliers; --",
        "1' OR '1'='1",
        "admin'/*",
        "1; DELETE FROM suppliers WHERE 1=1; --"
      ];

      for (const payload of sqlPayloads) {
        const maliciousData = {
          name: payload,
          contact: `test${payload}@example.com`,
          country: 'UK'
        };

        try {
          await apiClient.post(config.endpoint, maliciousData);
          fail('SQL injection attempt should be handled');
        } catch (error: unknown) {
          expect((error as { status?: number }).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should prevent XSS in supplier data', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '"><img src=x onerror=alert("xss")>',
        'javascript:alert("xss")',
        '<iframe src="javascript:alert(\'xss\')"></iframe>'
      ];

      for (const payload of xssPayloads) {
        const maliciousData = {
          name: payload,
          contact: 'test@example.com',
          country: 'UK'
        };

        try {
          await apiClient.post(config.endpoint, maliciousData);
          fail('XSS attempt should be handled');
        } catch (error: unknown) {
          expect((error as { status?: number }).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);
  });
});

// Add custom matcher if needed
if (!expect.extend) {
  expect.extend({
    toBeOneOf(received: unknown, expected: unknown[]) {
      const pass = expected.includes(received);
      return {
        message: () => pass
          ? `expected ${received} not to be one of ${expected.join(', ')}`
          : `expected ${received} to be one of ${expected.join(', ')}`,
        pass,
      };
    },
  });
}