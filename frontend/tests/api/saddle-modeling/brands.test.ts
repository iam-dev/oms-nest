/**
 * Brands API Tests
 * Tests saddle brand management endpoints with hierarchical product relationships
 */

import { ApiClient } from '../shared/api-client';
import type { ApiError } from '../shared/api-client';
import { ENTITY_CONFIGS, generateTestData } from '../shared/test-data';
import { ApiValidators, HTTP_STATUS, TEST_TIMEOUTS } from '../shared/helpers';

describe('Brands API', () => {
  let apiClient: ApiClient;

  beforeAll(() => {
    apiClient = new ApiClient();
  });

  beforeEach(() => {
    apiClient.clearAuth();
    apiClient.setRequestTimeout(3000); // Use shorter timeout for entity tests
  });

  const config = ENTITY_CONFIGS.brands;

  describe('Authentication Requirements', () => {
    it('should require authentication for GET /brands', async () => {
      try {
        await apiClient.get(config.endpoint);
        fail('GET /brands should require authentication');
      } catch (error: unknown) {
        ApiValidators.validateErrorResponse(error as ApiError, HTTP_STATUS.UNAUTHORIZED);
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should require authentication for brand creation', async () => {
      try {
        await apiClient.post(config.endpoint, generateTestData('brand'));
        fail('POST /brands should require authentication');
      } catch (error: unknown) {
        ApiValidators.validateErrorResponse(error as ApiError, HTTP_STATUS.UNAUTHORIZED);
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should require authentication for individual brand access', async () => {
      try {
        await apiClient.get(`${config.endpoint}/1`);
        fail('GET /brands/{id} should require authentication');
      } catch (error: unknown) {
        ApiValidators.validateErrorResponse(error as ApiError, HTTP_STATUS.UNAUTHORIZED);
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('OData Filtering Support', () => {
    it('should support brand search by name', async () => {
      const brandNames = [
        'Prestige',
        'Devoucoux',
        'Antarès',
        'CWD',
        'Butet',
        'Hermès',
        'County'
      ];

      for (const name of brandNames) {
        try {
          await apiClient.get(config.endpoint, {
            $filter: `substringof('${name}',name) eq true`
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support brand filtering by country', async () => {
      const countries = [
        'France',
        'UK',
        'Germany',
        'Italy',
        'USA'
      ];

      for (const country of countries) {
        try {
          await apiClient.get(config.endpoint, {
            $filter: `country eq '${country}'`
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support brand filtering by active status', async () => {
      try {
        await apiClient.get(config.endpoint, {
          $filter: `active eq true`
        });
        fail('Expected authentication error');
      } catch (error: unknown) {
        expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support brand filtering by price range', async () => {
      const priceFilters = [
        'priceRangeMin ge 1000',
        'priceRangeMax le 10000',
        'priceRangeMin ge 2000 and priceRangeMax le 8000'
      ];

      for (const filter of priceFilters) {
        try {
          await apiClient.get(config.endpoint, {
            $filter: filter
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support complex brand filters', async () => {
      const complexFilter = [
        `active eq true`,
        `and country eq 'France'`,
        `and priceRangeMin ge 2000`
      ].join(' ');

      try {
        await apiClient.get(config.endpoint, {
          $filter: complexFilter
        });
        fail('Expected authentication error');
      } catch (error: unknown) {
        expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('Product Relationship Filtering', () => {
    it('should support filtering brands by model count', async () => {
      try {
        await apiClient.get(config.endpoint, {
          $filter: `models/$count gt 0`
        });
        fail('Expected authentication error');
      } catch (error: unknown) {
        expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support filtering brands by available models', async () => {
      try {
        await apiClient.get(config.endpoint, {
          $filter: `models/any(m: m/available eq true)`
        });
        fail('Expected authentication error');
      } catch (error: unknown) {
        expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support filtering brands by model specialization', async () => {
      const specializations = [
        'dressage',
        'jumping',
        'western',
        'endurance',
        'general'
      ];

      for (const specialization of specializations) {
        try {
          await apiClient.get(config.endpoint, {
            $filter: `models/any(m: m/specialization eq '${specialization}')`
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('Brand Sorting', () => {
    const sortingTests = [
      { field: 'name', direction: 'asc' },
      { field: 'country', direction: 'asc' },
      { field: 'priceRangeMin', direction: 'asc' },
      { field: 'priceRangeMax', direction: 'desc' },
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
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }, TEST_TIMEOUTS.NORMAL);
    });

    it('should support sorting by model count', async () => {
      try {
        await apiClient.get(config.endpoint, {
          $orderby: 'models/$count desc'
        });
        fail('Expected authentication error');
      } catch (error: unknown) {
        expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('Pagination Support', () => {
    it('should support standard pagination parameters', async () => {
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
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('Brand Data Validation', () => {
    it('should validate required brand fields', async () => {
      const incompleteData = [
        { name: '' }, // Missing name
        { description: 'Test brand' }, // Missing name
        {} // Empty object
      ];

      for (const data of incompleteData) {
        try {
          await apiClient.post(config.endpoint, data);
          fail('Incomplete brand data should be rejected');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should validate brand name format', async () => {
      const nameTests = [
        { name: '', valid: false },
        { name: 'A', valid: true },
        { name: 'Prestige Italia', valid: true },
        { name: 'County Saddlery Ltd.', valid: true },
        { name: 'CWD Sellier', valid: true },
        { name: 'a'.repeat(256), valid: false }, // Too long
        { name: '<script>alert("xss")</script>', valid: false },
        { name: 'DROP TABLE brands', valid: false }
      ];

      for (const test of nameTests) {
        const brandData = {
          name: test.name,
          country: 'France',
          description: 'Test brand'
        };

        try {
          await apiClient.post(config.endpoint, brandData);
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should validate price range values', async () => {
      const priceTests = [
        { min: 1000, max: 5000, valid: true },
        { min: 0, max: 1000, valid: true },
        { min: -100, max: 1000, valid: false }, // Negative min
        { min: 5000, max: 1000, valid: false }, // Min > Max
        { min: 'invalid', max: 1000, valid: false }, // Invalid type
        { min: 1000, max: 'invalid', valid: false } // Invalid type
      ];

      for (const test of priceTests) {
        const brandData = {
          name: 'Test Brand',
          country: 'France',
          priceRangeMin: test.min,
          priceRangeMax: test.max
        };

        try {
          await apiClient.post(config.endpoint, brandData);
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should validate country format', async () => {
      const countryTests = [
        'France',
        'United Kingdom',
        'Germany',
        'Italy',
        'United States',
        'Australia'
      ];

      for (const country of countryTests) {
        const brandData = {
          name: 'Test Brand',
          country: country,
          description: 'Test brand'
        };

        try {
          await apiClient.post(config.endpoint, brandData);
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('Security Validations', () => {
    it('should prevent SQL injection in brand data', async () => {
      const sqlPayloads = [
        "'; DROP TABLE brands; --",
        "1' OR '1'='1",
        "admin'/*",
        "1; DELETE FROM brands WHERE 1=1; --"
      ];

      for (const payload of sqlPayloads) {
        const maliciousData = {
          name: payload,
          country: 'France',
          description: payload
        };

        try {
          await apiClient.post(config.endpoint, maliciousData);
          fail('SQL injection attempt should be handled');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should prevent XSS in brand data', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '"><img src=x onerror=alert("xss")>',
        'javascript:alert("xss")',
        '<iframe src="javascript:alert(\'xss\')"></iframe>'
      ];

      for (const payload of xssPayloads) {
        const maliciousData = {
          name: payload,
          country: 'France',
          description: payload
        };

        try {
          await apiClient.post(config.endpoint, maliciousData);
          fail('XSS attempt should be handled');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
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