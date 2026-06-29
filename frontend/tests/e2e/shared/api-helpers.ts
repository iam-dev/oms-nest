import { Page, expect, Request, Response } from '@playwright/test';

export interface ApiValidation {
  status?: number;
  contentType?: string;
  hasHydraMembers?: boolean;
  hasPagination?: boolean;
  minItems?: number;
  maxItems?: number;
}

export interface EntityTestConfig {
  endpoint: string;
  entityName: string;
  expectedFields: string[];
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  pagination?: boolean;
}

// Entity configurations for validation
export const ENTITY_CONFIGS: Record<string, EntityTestConfig> = {
  orders: {
    endpoint: '/enriched_orders',
    entityName: 'Order',
    expectedFields: ['id', 'orderId', 'orderStatus', 'customer', 'fitter', 'orderTime'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true
  },
  customers: {
    endpoint: '/customers',
    entityName: 'Customer',
    expectedFields: ['id', 'name', 'email', 'phone'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true
  },
  suppliers: {
    endpoint: '/suppliers',
    entityName: 'Supplier',
    expectedFields: ['id', 'name', 'email'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true
  },
  users: {
    endpoint: '/users',
    entityName: 'User',
    expectedFields: ['id', 'name', 'email', 'roles'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true
  },
  fitters: {
    endpoint: '/fitters',
    entityName: 'Fitter',
    expectedFields: ['id', 'name', 'email'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true
  },
  warehouses: {
    endpoint: '/warehouses',
    entityName: 'Warehouse',
    expectedFields: ['id', 'name'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true
  },
  models: {
    endpoint: '/models',
    entityName: 'Model',
    expectedFields: ['id', 'name', 'brand'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true
  },
  brands: {
    endpoint: '/brands',
    entityName: 'Brand',
    expectedFields: ['id', 'name'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true
  },
  leathertypes: {
    endpoint: '/leathertypes',
    entityName: 'Leathertype',
    expectedFields: ['id', 'name'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true
  },
  options: {
    endpoint: '/options',
    entityName: 'Option',
    expectedFields: ['id', 'name'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true
  },
  extras: {
    endpoint: '/extras',
    entityName: 'Extra',
    expectedFields: ['id', 'name'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true
  },
  presets: {
    endpoint: '/presets',
    entityName: 'Preset',
    expectedFields: ['id', 'name'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true
  }
};

export class ApiHelper {
  private requests: Request[] = [];
  private apiUrl = 'http://localhost:3001';

  constructor(private page: Page) {
    // Track API requests
    this.page.on('request', request => {
      if (request.url().includes(this.apiUrl)) {
        this.requests.push(request);
      }
    });
  }

  async validateApiResponse(response: Response, validation: ApiValidation): Promise<void> {
    if (validation.status) {
      expect(response.status).toBe(validation.status);
    }

    const data = await response.json();

    if (validation.hasHydraMembers) {
      expect(data).toHaveProperty('hydra:member');
      expect(Array.isArray(data['hydra:member'])).toBe(true);
    }

    if (validation.hasPagination) {
      expect(data).toHaveProperty('hydra:totalItems');
      expect(data).toHaveProperty('hydra:view');
    }

    if (validation.minItems !== undefined && data['hydra:member']) {
      expect(data['hydra:member'].length).toBeGreaterThanOrEqual(validation.minItems);
    }

    if (validation.maxItems !== undefined && data['hydra:member']) {
      expect(data['hydra:member'].length).toBeLessThanOrEqual(validation.maxItems);
    }
  }

  async validateEntityResponse(entityType: string, response: Response): Promise<void> {
    const config = ENTITY_CONFIGS[entityType];
    if (!config) {
      throw new Error(`No configuration found for entity type: ${entityType}`);
    }

    const data = await response.json();

    // Check for Hydra collection structure
    expect(data).toHaveProperty('hydra:member');
    expect(Array.isArray(data['hydra:member'])).toBe(true);

    // Validate pagination if expected
    if (config.pagination) {
      expect(data).toHaveProperty('hydra:totalItems');
      expect(typeof data['hydra:totalItems']).toBe('number');
    }

    // Validate entity structure if we have data
    if (data['hydra:member'].length > 0) {
      const firstEntity = data['hydra:member'][0];

      // Check required fields
      for (const field of config.expectedFields) {
        expect(firstEntity).toHaveProperty(field);
      }
    }
  }

  getLastApiRequest(endpoint?: string): Request | undefined {
    if (endpoint) {
      return this.requests
        .filter(req => req.url().includes(endpoint))
        .slice(-1)[0];
    }
    return this.requests.slice(-1)[0];
  }

  getApiRequests(endpoint?: string): Request[] {
    if (endpoint) {
      return this.requests.filter(req => req.url().includes(endpoint));
    }
    return this.requests;
  }

  clearRequestHistory(): void {
    this.requests = [];
  }

  async interceptNextApiCall(endpoint: string): Promise<Request> {
    return new Promise((resolve) => {
      const handler = (request: Request) => {
        if (request.url().includes(endpoint)) {
          this.page.off('request', handler);
          resolve(request);
        }
      };
      this.page.on('request', handler);
    });
  }

  validateODataParams(url: string, expectedParams: Record<string, unknown>): void {
    const urlObj = new URL(url);

    for (const [param, expectedValue] of Object.entries(expectedParams)) {
      const actualValue = urlObj.searchParams.get(param);

      if (expectedValue === null) {
        expect(actualValue).toBeNull();
      } else {
        expect(actualValue).toBe(String(expectedValue));
      }
    }
  }

  validateSearchParam(url: string, searchTerm: string): void {
    const urlObj = new URL(url);
    const searchParam = urlObj.searchParams.get('search');
    expect(searchParam).toBe(searchTerm);
  }

  validateFilterParam(url: string, filterKey: string, filterValue: string): void {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    // Check for direct parameter
    if (params.has(filterKey)) {
      expect(params.get(filterKey)).toBe(filterValue);
      return;
    }

    // Check for OData $filter parameter
    const filter = params.get('$filter');
    if (filter) {
      expect(filter).toContain(filterKey);
      expect(filter).toContain(filterValue);
    }
  }

  validateSortParam(url: string, sortField: string, sortOrder: 'asc' | 'desc' = 'desc'): void {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    // Check for order parameter (API Platform style)
    const orderParam = params.get(`order[${sortField}]`);
    if (orderParam) {
      expect(orderParam).toBe(sortOrder);
      return;
    }

    // Check for OData $orderby parameter
    const orderBy = params.get('$orderby');
    if (orderBy) {
      expect(orderBy).toContain(`${sortField} ${sortOrder}`);
    }
  }

  validatePaginationParams(url: string, page: number): void {
    const urlObj = new URL(url);
    const pageParam = urlObj.searchParams.get('page');
    expect(pageParam).toBe(String(page));
  }

  async mockApiResponse(endpoint: string, responseData: unknown, status = 200): Promise<void> {
    await this.page.route(`**/api/**${endpoint}*`, (route) => {
      route.fulfill({
        status,
        contentType: 'application/ld+json',
        body: JSON.stringify(responseData)
      });
    });
  }

  async waitForApiCall(endpoint: string, timeout = 10000): Promise<Request> {
    return await this.page.waitForRequest(
      request => request.url().includes(endpoint),
      { timeout }
    );
  }

  async waitForApiResponse(endpoint: string, timeout = 10000): Promise<unknown> {
    const response = await this.page.waitForResponse(
      response => response.url().includes(endpoint),
      { timeout }
    );
    return await response.json();
  }
}