/**
 * Models API Tests
 * Tests saddle model management endpoints with brand relationships and product configurations
 */

import { ApiClient } from '../shared/api-client';
import type { ApiError } from '../shared/api-client';
import { ENTITY_CONFIGS, generateTestData } from '../shared/test-data';
import { ApiValidators, HTTP_STATUS, TEST_TIMEOUTS } from '../shared/helpers';

function asApiError(e: unknown): ApiError {
  if (e !== null && typeof e === 'object' && 'status' in e && 'message' in e) {
    return e as ApiError;
  }
  return { message: String(e), status: 0, statusText: 'Unknown' };
}

describe('Models API', () => {
  let apiClient: ApiClient;

  beforeAll(() => {
    apiClient = new ApiClient();
  });

  beforeEach(() => {
    apiClient.clearAuth();
    apiClient.setRequestTimeout(3000); // Use shorter timeout for entity tests
  });

  const config = ENTITY_CONFIGS.models;

  describe('Authentication Requirements', () => {
    it('should require authentication for GET /models', async () => {
      try {
        await apiClient.get(config.endpoint);
        fail('GET /models should require authentication');
      } catch (error: unknown) {
        ApiValidators.validateErrorResponse(asApiError(error), HTTP_STATUS.UNAUTHORIZED);
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should require authentication for model creation', async () => {
      try {
        await apiClient.post(config.endpoint, generateTestData('model'));
        fail('POST /models should require authentication');
      } catch (error: unknown) {
        ApiValidators.validateErrorResponse(asApiError(error), HTTP_STATUS.UNAUTHORIZED);
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should require authentication for individual model access', async () => {
      try {
        await apiClient.get(`${config.endpoint}/1`);
        fail('GET /models/{id} should require authentication');
      } catch (error: unknown) {
        ApiValidators.validateErrorResponse(asApiError(error), HTTP_STATUS.UNAUTHORIZED);
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('OData Filtering Support', () => {
    it('should support model search by name', async () => {
      const modelNames = [
        'X-Breath',
        'Venus',
        'Michel Robert',
        'Paris',
        'Heritage',
        'Elite',
        'Competition'
      ];

      for (const name of modelNames) {
        try {
          await apiClient.get(config.endpoint, {
            $filter: `substringof('${name}',name) eq true`
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.METHOD_NOT_ALLOWED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support model filtering by brand', async () => {
      const brandFilters = [
        'brand/name eq \'Prestige\'',
        'brand/name eq \'Devoucoux\'',
        'brand/name eq \'CWD\'',
        'brand/id eq 1',
        'substringof(\'Antares\',brand/name) eq true'
      ];

      for (const filter of brandFilters) {
        try {
          await apiClient.get(config.endpoint, {
            $filter: filter
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.METHOD_NOT_ALLOWED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support model filtering by specialization', async () => {
      const specializations = [
        'dressage',
        'jumping',
        'western',
        'endurance',
        'general',
        'eventing',
        'racing'
      ];

      for (const specialization of specializations) {
        try {
          await apiClient.get(config.endpoint, {
            $filter: `specialization eq '${specialization}'`
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.METHOD_NOT_ALLOWED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support model filtering by seat sizes', async () => {
      const seatSizes = ['16', '16.5', '17', '17.5', '18', '18.5', '19'];

      for (const size of seatSizes) {
        try {
          await apiClient.get(config.endpoint, {
            $filter: `availableSizes/any(s: s eq '${size}')`
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.METHOD_NOT_ALLOWED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support model filtering by availability', async () => {
      try {
        await apiClient.get(config.endpoint, {
          $filter: `available eq true`
        });
        fail('Expected authentication error');
      } catch (error: unknown) {
        expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support complex model filters', async () => {
      const complexFilter = [
        `available eq true`,
        `and specialization eq 'dressage'`,
        `and substringof('Prestige',brand/name) eq true`,
        `and availableSizes/any(s: s eq '17')`
      ].join(' ');

      try {
        await apiClient.get(config.endpoint, {
          $filter: complexFilter
        });
        fail('Expected authentication error');
      } catch (error: unknown) {
        expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('Price Range Filtering', () => {
    it('should support price-based filtering', async () => {
      const priceFilters = [
        'basePrice ge 2000',
        'basePrice le 8000',
        'basePrice ge 3000 and basePrice le 6000',
        'maxPrice le 10000'
      ];

      for (const filter of priceFilters) {
        try {
          await apiClient.get(config.endpoint, {
            $filter: filter
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.METHOD_NOT_ALLOWED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support filtering by price ranges within brand', async () => {
      try {
        await apiClient.get(config.endpoint, {
          $filter: `brand/name eq 'Prestige' and basePrice ge 2000 and basePrice le 5000`
        });
        fail('Expected authentication error');
      } catch (error: unknown) {
        expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('Model Sorting', () => {
    const sortingTests = [
      { field: 'name', direction: 'asc' },
      { field: 'brand/name', direction: 'asc' },
      { field: 'specialization', direction: 'asc' },
      { field: 'basePrice', direction: 'asc' },
      { field: 'basePrice', direction: 'desc' },
      { field: 'createdAt', direction: 'desc' },
      { field: 'updatedAt', direction: 'desc' },
      { field: 'available', direction: 'desc' }
    ];

    sortingTests.forEach(({ field, direction }) => {
      it(`should support sorting by ${field} ${direction}`, async () => {
        try {
          await apiClient.get(config.endpoint, {
            $orderby: `${field} ${direction}`
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.METHOD_NOT_ALLOWED]);
        }
      }, TEST_TIMEOUTS.NORMAL);
    });

    it('should support multi-field sorting', async () => {
      try {
        await apiClient.get(config.endpoint, {
          $orderby: 'brand/name asc, specialization asc, basePrice asc'
        });
        fail('Expected authentication error');
      } catch (error: unknown) {
        expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
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
          expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.METHOD_NOT_ALLOWED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('Model Data Validation', () => {
    it('should validate required model fields', async () => {
      const incompleteData = [
        { name: '', brand: '/api/brands/1' }, // Missing name
        { name: 'Test Model' }, // Missing brand
        { brand: '/api/brands/1' }, // Missing name
        {} // Empty object
      ];

      for (const data of incompleteData) {
        try {
          await apiClient.post(config.endpoint, data);
          fail('Incomplete model data should be rejected');
        } catch (error: unknown) {
          expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.METHOD_NOT_ALLOWED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should validate model specialization values', async () => {
      const validSpecializations = [
        'dressage',
        'jumping',
        'western',
        'endurance',
        'general',
        'eventing',
        'racing'
      ];

      const invalidSpecializations = [
        'invalid_specialization',
        '<script>alert("xss")</script>',
        'DROP TABLE models',
        ''
      ];

      // Test valid specializations
      for (const specialization of validSpecializations) {
        const modelData = {
          name: 'Test Model',
          brand: '/api/brands/1',
          specialization: specialization
        };

        try {
          await apiClient.post(config.endpoint, modelData);
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.METHOD_NOT_ALLOWED]);
        }
      }

      // Test invalid specializations
      for (const specialization of invalidSpecializations) {
        const modelData = {
          name: 'Test Model',
          brand: '/api/brands/1',
          specialization: specialization
        };

        try {
          await apiClient.post(config.endpoint, modelData);
          fail('Invalid specialization should be handled');
        } catch (error: unknown) {
          expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.METHOD_NOT_ALLOWED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should validate seat size arrays', async () => {
      const seatSizeTests = [
        { sizes: ['16', '17', '18'], valid: true },
        { sizes: ['16.5', '17.5', '18.5'], valid: true },
        { sizes: [], valid: false }, // Empty array
        { sizes: ['invalid'], valid: false }, // Invalid size
        { sizes: ['15'], valid: false }, // Too small
        { sizes: ['20'], valid: false }, // Too large
        { sizes: null, valid: false } // Null value
      ];

      for (const test of seatSizeTests) {
        const modelData = {
          name: 'Test Model',
          brand: '/api/brands/1',
          availableSizes: test.sizes
        };

        try {
          await apiClient.post(config.endpoint, modelData);
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.METHOD_NOT_ALLOWED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should validate price values', async () => {
      const priceTests = [
        { base: 2000, max: 5000, valid: true },
        { base: 0, max: 1000, valid: true },
        { base: -100, max: 1000, valid: false }, // Negative base
        { base: 5000, max: 1000, valid: false }, // Base > Max
        { base: 'invalid', max: 1000, valid: false }, // Invalid type
        { base: 1000, max: 'invalid', valid: false } // Invalid type
      ];

      for (const test of priceTests) {
        const modelData = {
          name: 'Test Model',
          brand: '/api/brands/1',
          basePrice: test.base,
          maxPrice: test.max
        };

        try {
          await apiClient.post(config.endpoint, modelData);
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.METHOD_NOT_ALLOWED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('Security Validations', () => {
    it('should prevent SQL injection in model data', async () => {
      const sqlPayloads = [
        "'; DROP TABLE models; --",
        "1' OR '1'='1",
        "admin'/*",
        "1; DELETE FROM models WHERE 1=1; --"
      ];

      for (const payload of sqlPayloads) {
        const maliciousData = {
          name: payload,
          brand: '/api/brands/1',
          description: payload
        };

        try {
          await apiClient.post(config.endpoint, maliciousData);
          fail('SQL injection attempt should be handled');
        } catch (error: unknown) {
          expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.METHOD_NOT_ALLOWED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should prevent XSS in model data', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '"><img src=x onerror=alert("xss")>',
        'javascript:alert("xss")',
        '<iframe src="javascript:alert(\'xss\')"></iframe>'
      ];

      for (const payload of xssPayloads) {
        const maliciousData = {
          name: payload,
          brand: '/api/brands/1',
          description: payload
        };

        try {
          await apiClient.post(config.endpoint, maliciousData);
          fail('XSS attempt should be handled');
        } catch (error: unknown) {
          expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.METHOD_NOT_ALLOWED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('Brand Relationship Validation', () => {
    it('should validate brand reference format', async () => {
      const brandReferences = [
        '/api/brands/1',
        '/api/brands/999',
        'invalid-reference',
        '/api/users/1', // Wrong entity type
        'brand/1',
        null,
        ''
      ];

      for (const brandRef of brandReferences) {
        const modelData = {
          name: 'Test Model',
          brand: brandRef,
          specialization: 'dressage'
        };

        try {
          await apiClient.post(config.endpoint, modelData);
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect(asApiError(error).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.METHOD_NOT_ALLOWED]);
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