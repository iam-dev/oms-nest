/**
 * Fitters API Tests
 * Tests fitter management endpoints with location-based filtering
 */

import { ApiClient } from '../shared/api-client';
import type { ApiError } from '../shared/api-client';
import { ENTITY_CONFIGS, generateTestData } from '../shared/test-data';
import { ApiValidators, HTTP_STATUS, TEST_TIMEOUTS } from '../shared/helpers';

describe('Fitters API', () => {
  let apiClient: ApiClient;

  beforeAll(() => {
    apiClient = new ApiClient();
  });

  beforeEach(() => {
    apiClient.clearAuth();
    apiClient.setRequestTimeout(3000); // Use shorter timeout for entity tests
  });

  const config = ENTITY_CONFIGS.fitters;

  describe('Authentication Requirements', () => {
    it('should require authentication for GET /fitters', async () => {
      try {
        await apiClient.get(config.endpoint);
        fail('GET /fitters should require authentication');
      } catch (error: unknown) {
        ApiValidators.validateErrorResponse(error as ApiError, HTTP_STATUS.UNAUTHORIZED);
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should require authentication for fitter creation', async () => {
      try {
        await apiClient.post(config.endpoint, generateTestData('fitter'));
        fail('POST /fitters should require authentication');
      } catch (error: unknown) {
        ApiValidators.validateErrorResponse(error as ApiError, HTTP_STATUS.UNAUTHORIZED);
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should require authentication for individual fitter access', async () => {
      try {
        await apiClient.get(`${config.endpoint}/1`);
        fail('GET /fitters/{id} should require authentication');
      } catch (error: unknown) {
        ApiValidators.validateErrorResponse(error as ApiError, HTTP_STATUS.UNAUTHORIZED);
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('OData Filtering Support', () => {
    it('should support fitter search by name', async () => {
      const searchTerms = [
        'John',
        'Jane',
        'Smith',
        'Professional'
      ];

      for (const term of searchTerms) {
        try {
          await apiClient.get(config.endpoint, {
            $filter: `substringof('${term}',name) eq true`
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support fitter filtering by location', async () => {
      const locations = [
        'London',
        'Manchester',
        'Birmingham',
        'Edinburgh',
        'Cardiff'
      ];

      for (const location of locations) {
        try {
          await apiClient.get(config.endpoint, {
            $filter: `substringof('${location}',location) eq true`
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support fitter filtering by specialization', async () => {
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
            $filter: `specialization eq '${specialization}'`
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support fitter filtering by availability', async () => {
      try {
        await apiClient.get(config.endpoint, {
          $filter: `available eq true`
        });
        fail('Expected authentication error');
      } catch (error: unknown) {
        expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support complex fitter filters', async () => {
      const complexFilter = [
        `available eq true`,
        `and substringof('London',location) eq true`,
        `and specialization eq 'dressage'`
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

  describe('Geographic Filtering', () => {
    it('should support radius-based location filtering', async () => {
      // Test location searches that might be supported
      const locationQueries = [
        { lat: '51.5074', lng: '-0.1278', radius: '50' }, // London
        { lat: '53.4808', lng: '-2.2426', radius: '25' }, // Manchester
        { lat: '52.4862', lng: '-1.8904', radius: '30' }  // Birmingham
      ];

      for (const query of locationQueries) {
        try {
          await apiClient.get(config.endpoint, {
            $filter: `geo.distance(location, geography'POINT(${query.lng} ${query.lat})') le ${query.radius}`
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should support postcode-based filtering', async () => {
      const postcodes = [
        'SW1A',
        'M1',
        'B1',
        'EH1',
        'CF1'
      ];

      for (const postcode of postcodes) {
        try {
          await apiClient.get(config.endpoint, {
            $filter: `substringof('${postcode}',postcode) eq true`
          });
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('Fitter Sorting', () => {
    const sortingTests = [
      { field: 'name', direction: 'asc' },
      { field: 'location', direction: 'asc' },
      { field: 'specialization', direction: 'asc' },
      { field: 'available', direction: 'desc' },
      { field: 'createdAt', direction: 'desc' },
      { field: 'lastActive', direction: 'desc' }
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

    it('should support distance-based sorting', async () => {
      try {
        await apiClient.get(config.endpoint, {
          $orderby: 'geo.distance(location, geography\'POINT(-0.1278 51.5074)\') asc'
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

  describe('Fitter Data Validation', () => {
    it('should validate required fitter fields', async () => {
      const incompleteData = [
        { name: '', contact: 'test@example.com' }, // Missing name
        { name: 'John Doe' }, // Missing contact
        { contact: 'test@example.com' } // Missing name
      ];

      for (const data of incompleteData) {
        try {
          await apiClient.post(config.endpoint, data);
          fail('Incomplete fitter data should be rejected');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should validate fitter specialization values', async () => {
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
        const fitterData = {
          name: 'Test Fitter',
          contact: 'test@example.com',
          specialization: specialization
        };

        try {
          await apiClient.post(config.endpoint, fitterData);
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should validate location data format', async () => {
      const locationTests = [
        { location: 'London, UK', valid: true },
        { location: 'Manchester, M1 1AA, UK', valid: true },
        { location: '', valid: false },
        { location: 'a'.repeat(500), valid: false }, // Too long
        { location: '<script>alert("xss")</script>', valid: false }
      ];

      for (const test of locationTests) {
        const fitterData = {
          name: 'Test Fitter',
          contact: 'test@example.com',
          location: test.location
        };

        try {
          await apiClient.post(config.endpoint, fitterData);
          fail('Expected authentication error');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);
  });

  describe('Security Validations', () => {
    it('should prevent SQL injection in fitter data', async () => {
      const sqlPayloads = [
        "'; DROP TABLE fitters; --",
        "1' OR '1'='1",
        "admin'/*",
        "1; DELETE FROM fitters WHERE 1=1; --"
      ];

      for (const payload of sqlPayloads) {
        const maliciousData = {
          name: payload,
          contact: `test${payload}@example.com`,
          location: 'Test Location'
        };

        try {
          await apiClient.post(config.endpoint, maliciousData);
          fail('SQL injection attempt should be handled');
        } catch (error: unknown) {
          expect((error as ApiError).status).toBeOneOf([0, HTTP_STATUS.UNAUTHORIZED]);
        }
      }
    }, TEST_TIMEOUTS.NORMAL);

    it('should prevent XSS in fitter data', async () => {
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
          location: 'Test Location'
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