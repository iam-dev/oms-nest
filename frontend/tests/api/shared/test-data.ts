/**
 * Test Data and User Configurations for API Tests
 */

export interface TestUser {
  username: string;
  password: string;
  role: string;
  email?: string;
  expectedRedirect?: string;
}

/**
 * Test users - these should match actual users in the test database
 * Note: These are for testing authentication flows, not necessarily valid login credentials
 */
export const TEST_USERS: Record<string, TestUser> = {
  // Test admin user (will attempt creation if doesn't exist)
  admin: {
    username: 'testadmin',
    password: 'testpassword123',
    role: 'admin',
    email: 'testadmin@example.com',
    expectedRedirect: '/dashboard'
  },

  // Test regular user
  user: {
    username: 'testuser',
    password: 'testpass123',
    role: 'user',
    email: 'testuser@example.com',
    expectedRedirect: '/dashboard'
  },

  // Test fitter
  fitter: {
    username: 'testfitter',
    password: 'testfitter123',
    role: 'fitter',
    email: 'testfitter@example.com'
  },

  // Test supplier
  supplier: {
    username: 'testsupplier',
    password: 'testsupplier123',
    role: 'supplier',
    email: 'testsupplier@example.com'
  },

  // Invalid user for testing error cases
  invalid: {
    username: 'nonexistent_user_12345',
    password: 'definitely_wrong_password_12345',
    role: 'none'
  }
};

/**
 * Entity configurations for API testing
 * These match the actual API Platform endpoints and structure
 */
export interface EntityConfig {
  endpoint: string;
  entityName: string;
  expectedFields: string[];
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  pagination?: boolean;
  requiredFields?: string[];
  testData?: Record<string, unknown>;
}

export const ENTITY_CONFIGS: Record<string, EntityConfig> = {
  orders: {
    endpoint: '/api/v1/enriched-orders',
    entityName: 'Order',
    expectedFields: ['id', 'orderStatus', 'customer', 'fitter', 'orderTime'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true,
    requiredFields: ['customerId', 'orderStatus']
  },

  customers: {
    endpoint: '/api/v1/customers',
    entityName: 'Customer',
    expectedFields: ['id', 'name', 'email'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true,
    requiredFields: ['name', 'email'],
    testData: {
      name: 'Test Customer API',
      email: 'test.customer.api@example.com',
      phone: '+1234567890'
    }
  },

  suppliers: {
    endpoint: '/api/v1/suppliers',
    entityName: 'Supplier',
    expectedFields: ['id', 'name', 'email'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true,
    requiredFields: ['name', 'email'],
    testData: {
      name: 'Test Supplier API',
      email: 'test.supplier.api@example.com'
    }
  },

  users: {
    endpoint: '/api/v1/users',
    entityName: 'User',
    expectedFields: ['id', 'username', 'email'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true,
    requiredFields: ['username', 'email']
  },

  fitters: {
    endpoint: '/api/v1/fitters',
    entityName: 'Fitter',
    expectedFields: ['id', 'name', 'email'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true,
    requiredFields: ['name', 'email'],
    testData: {
      name: 'Test Fitter API',
      email: 'test.fitter.api@example.com'
    }
  },

  // Note: The following product entities exist but may not be properly configured
  // They are commented out until backend modules are fully operational
  /*
  brands: {
    endpoint: '/api/v1/brands',
    entityName: 'Brand',
    expectedFields: ['id', 'name'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true,
    requiredFields: ['name'],
    testData: {
      name: 'Test Brand API'
    }
  },

  models: {
    endpoint: '/api/v1/models',
    entityName: 'Model',
    expectedFields: ['id', 'name'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true,
    requiredFields: ['name'],
    testData: {
      name: 'Test Model API'
    }
  },

  leathertypes: {
    endpoint: '/api/v1/leathertypes',
    entityName: 'Leathertype',
    expectedFields: ['id', 'name'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true,
    requiredFields: ['name'],
    testData: {
      name: 'Test Leather API'
    }
  },

  options: {
    endpoint: '/api/v1/options',
    entityName: 'Option',
    expectedFields: ['id', 'name'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true,
    requiredFields: ['name'],
    testData: {
      name: 'Test Option API'
    }
  },

  extras: {
    endpoint: '/api/v1/extras',
    entityName: 'Extra',
    expectedFields: ['id', 'name'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true,
    requiredFields: ['name'],
    testData: {
      name: 'Test Extra API'
    }
  },

  presets: {
    endpoint: '/api/v1/presets',
    entityName: 'Preset',
    expectedFields: ['id', 'name'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true,
    requiredFields: ['name'],
    testData: {
      name: 'Test Preset API'
    }
  }
  */
};

/**
 * Common test patterns and utilities
 */
export const TEST_PATTERNS = {
  // Pagination patterns
  pagination: {
    defaultPageSize: 30,
    maxPageSize: 100,
    testSizes: [10, 25, 50]
  },

  // Search patterns
  search: {
    validTerms: ['test', 'api', 'saddle'],
    invalidTerms: ['<script>', 'DROP TABLE', '"; DELETE FROM'],
    minLength: 1,
    maxLength: 100
  },

  // OData filter patterns
  odata: {
    operators: ['eq', 'ne', 'gt', 'ge', 'lt', 'le'],
    functions: ['substringof', 'startswith', 'endswith'],
    logicalOperators: ['and', 'or', 'not']
  }
};

/**
 * Helper to generate random test data
 */
export function generateTestData(type: 'customer' | 'supplier' | 'fitter' | 'brand' | 'model' | 'user' | 'order' | 'leathertype' | 'option' | 'extra' | 'preset', customFields: Record<string, unknown> = {}) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  const uniqueId = `${timestamp}_${random}`;

  const baseData = {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  switch (type) {
    case 'customer':
      return {
        ...baseData,
        name: `Test Customer ${uniqueId}`,
        email: `customer.${uniqueId}@test-api.example.com`,
        phone: `+1${random}1234567`,
        address: `Test Address ${uniqueId}`,
        postcode: `TE${Math.floor(random / 10)}T ${random % 10}XX`,
        ...customFields
      };

    case 'supplier':
      return {
        ...baseData,
        name: `Test Supplier ${uniqueId}`,
        email: `supplier.${uniqueId}@test-api.example.com`,
        contact: `supplier.${uniqueId}@test-api.example.com`,
        phone: `+44${random}123456`,
        country: ['UK', 'DE', 'FR', 'IT', 'US'][random % 5],
        status: ['active', 'inactive', 'pending'][random % 3],
        ...customFields
      };

    case 'fitter':
      return {
        ...baseData,
        name: `Test Fitter ${uniqueId}`,
        email: `fitter.${uniqueId}@test-api.example.com`,
        contact: `fitter.${uniqueId}@test-api.example.com`,
        phone: `+44${random}123456`,
        location: `Test Location ${uniqueId}`,
        specialization: ['dressage', 'jumping', 'western', 'endurance', 'general'][random % 5],
        available: random % 2 === 0,
        ...customFields
      };

    case 'brand':
      return {
        ...baseData,
        name: `Test Brand ${uniqueId}`,
        description: `Test brand description ${uniqueId}`,
        country: ['France', 'UK', 'Germany', 'Italy', 'USA'][random % 5],
        active: random % 4 !== 0, // 75% active
        priceRangeMin: 1000 + (random % 3000),
        priceRangeMax: 5000 + (random % 5000),
        ...customFields
      };

    case 'model':
      return {
        ...baseData,
        name: `Test Model ${uniqueId}`,
        brand: '/api/v1/brands/1',
        description: `Test model description ${uniqueId}`,
        specialization: ['dressage', 'jumping', 'western', 'endurance', 'general'][random % 5],
        available: random % 4 !== 0, // 75% available
        availableSizes: ['16', '17', '18'],
        basePrice: 2000 + (random % 3000),
        maxPrice: 6000 + (random % 2000),
        ...customFields
      };

    case 'user':
      return {
        ...baseData,
        username: `user_${uniqueId}`,
        email: `user.${uniqueId}@test-api.example.com`,
        name: `Test User ${uniqueId}`,
        roles: ['ROLE_USER'],
        enabled: true,
        ...customFields
      };

    case 'order':
      return {
        ...baseData,
        customerId: 1,
        fitterId: 1,
        factoryId: 1,
        orderStatus: ['pending', 'confirmed', 'in_production'][random % 3],
        urgent: random % 3 === 0, // 33% urgent
        seatSize: ['16', '16.5', '17', '17.5', '18', '18.5', '19'][random % 7],
        reference: `REF-${uniqueId}`,
        orderTime: new Date().toISOString(),
        ...customFields
      };

    case 'leathertype':
      return {
        ...baseData,
        name: `Test Leather ${uniqueId}`,
        description: `Test leather description ${uniqueId}`,
        color: ['Black', 'Brown', 'Tan', 'Havana', 'Oak'][random % 5],
        finish: ['Smooth', 'Textured', 'Grain'][random % 3],
        priceModifier: random % 500,
        available: random % 4 !== 0,
        ...customFields
      };

    case 'option':
      return {
        ...baseData,
        name: `Test Option ${uniqueId}`,
        description: `Test option description ${uniqueId}`,
        category: ['Flaps', 'Panels', 'Blocks', 'Stirrups', 'Girth'][random % 5],
        priceModifier: random % 300,
        available: random % 4 !== 0,
        ...customFields
      };

    case 'extra':
      return {
        ...baseData,
        name: `Test Extra ${uniqueId}`,
        description: `Test extra description ${uniqueId}`,
        category: ['Accessories', 'Covers', 'Tools', 'Care'][random % 4],
        price: 50 + (random % 200),
        available: random % 4 !== 0,
        ...customFields
      };

    case 'preset':
      return {
        ...baseData,
        name: `Test Preset ${uniqueId}`,
        description: `Test preset description ${uniqueId}`,
        model: '/api/v1/models/1',
        leathertype: '/api/v1/leathertypes/1',
        options: ['/api/v1/options/1', '/api/v1/options/2'],
        extras: ['/api/v1/extras/1'],
        totalPrice: 3000 + (random % 2000),
        ...customFields
      };

    default:
      throw new Error(`Unknown test data type: ${type}`);
  }
}

/**
 * Generate test data sets for bulk operations
 */
export function generateTestDataSet(entityType: string, count: number, customFields: Record<string, unknown> = {}): Record<string, unknown>[] {
  return Array.from({ length: count }, () => generateTestData(entityType as Parameters<typeof generateTestData>[0], customFields));
}

/**
 * Generate invalid test data for validation testing
 */
export function generateInvalidTestData(entityType: string): Record<string, unknown>[] {
  const invalidDataSets: Record<string, unknown>[] = [];

  // Common invalid patterns
  const commonInvalidData = [
    // XSS attempts
    { name: '<script>alert("xss")</script>' },
    { name: '"><img src=x onerror=alert("xss")>' },
    { description: 'javascript:alert("xss")' },

    // SQL injection attempts
    { name: "'; DROP TABLE test; --" },
    { name: "1' OR '1'='1" },
    { description: "admin'/*" },

    // Invalid formats
    { name: '' }, // Empty string
    { name: ' ' }, // Just spaces
    { name: 'a'.repeat(300) }, // Too long

    // Type confusion
    { name: null },
    { name: undefined },
    { name: {} },
    { name: [] },
    { name: 123 }
  ];

  invalidDataSets.push(...commonInvalidData);

  // Entity-specific invalid data
  switch (entityType) {
    case 'user':
      invalidDataSets.push(
        { email: 'invalid-email' },
        { email: '@domain.com' },
        { email: 'user@' },
        { roles: ['INVALID_ROLE'] },
        { roles: null },
        { username: 'user with spaces' },
        { username: 'user@invalid' }
      );
      break;

    case 'customer':
      invalidDataSets.push(
        { email: 'invalid-email-format' },
        { phone: 'not-a-phone' },
        { phone: '123' }, // Too short
        { phone: '1'.repeat(50) } // Too long
      );
      break;

    case 'order':
      invalidDataSets.push(
        { orderStatus: 'invalid_status' },
        { seatSize: 'invalid_size' },
        { seatSize: '10' }, // Too small
        { seatSize: '25' }, // Too large
        { urgent: 'not-boolean' },
        { customerId: 'not-a-number' },
        { fitterId: -1 }
      );
      break;

    case 'fitter':
    case 'supplier':
      invalidDataSets.push(
        { contact: 'invalid-email' },
        { location: '' },
        { location: 'a'.repeat(500) }
      );
      break;

    case 'brand':
      invalidDataSets.push(
        { priceRangeMin: -100 },
        { priceRangeMax: 'not-a-number' },
        { priceRangeMin: 5000, priceRangeMax: 1000 } // Min > Max
      );
      break;

    case 'model':
      invalidDataSets.push(
        { specialization: 'invalid_specialization' },
        { availableSizes: [] }, // Empty array
        { availableSizes: ['invalid_size'] },
        { basePrice: -100 },
        { maxPrice: 'not-a-number' },
        { brand: 'invalid-brand-reference' }
      );
      break;
  }

  return invalidDataSets;
}

/**
 * Generate test filter parameters for OData testing
 */
export function generateFilterTestCases(entityType: string): Array<{ filter: string; description: string }> {
  const commonFilters = [
    { filter: `substringof('test',name) eq true`, description: 'name substring search' },
    { filter: `name eq 'Test Name'`, description: 'exact name match' },
    { filter: `createdAt ge datetime'${new Date(Date.now() - 86400000).toISOString()}'`, description: 'created in last 24 hours' }
  ];

  const entitySpecificFilters: Record<string, Array<{ filter: string; description: string }>> = {
    users: [
      { filter: `roles/any(r: r eq 'ROLE_USER')`, description: 'has USER role' },
      { filter: `enabled eq true`, description: 'enabled users only' },
      { filter: `substringof('admin',username) eq true`, description: 'username contains admin' }
    ],
    customers: [
      { filter: `substringof('test',email) eq true`, description: 'email contains test' },
      { filter: `substringof('London',address) eq true`, description: 'address contains London' }
    ],
    orders: [
      { filter: `orderStatus eq 'pending'`, description: 'pending orders' },
      { filter: `urgent eq true`, description: 'urgent orders only' },
      { filter: `seatSize eq '17'`, description: 'specific seat size' },
      { filter: `substringof('John',fitter/name) eq true`, description: 'fitter name contains John' }
    ],
    suppliers: [
      { filter: `country eq 'UK'`, description: 'UK suppliers' },
      { filter: `status eq 'active'`, description: 'active suppliers only' }
    ],
    fitters: [
      { filter: `available eq true`, description: 'available fitters' },
      { filter: `specialization eq 'dressage'`, description: 'dressage specialists' },
      { filter: `substringof('London',location) eq true`, description: 'London-based fitters' }
    ],
    brands: [
      { filter: `country eq 'France'`, description: 'French brands' },
      { filter: `active eq true`, description: 'active brands' },
      { filter: `priceRangeMin ge 2000`, description: 'premium price range' }
    ],
    models: [
      { filter: `specialization eq 'jumping'`, description: 'jumping models' },
      { filter: `available eq true`, description: 'available models' },
      { filter: `substringof('Prestige',brand/name) eq true`, description: 'Prestige brand models' },
      { filter: `basePrice le 5000`, description: 'budget-friendly models' }
    ]
  };

  return [
    ...commonFilters,
    ...(entitySpecificFilters[entityType] || [])
  ];
}

/**
 * Generate test sorting parameters
 */
export function generateSortingTestCases(entityType: string): Array<{ orderby: string; description: string }> {
  const commonSorting = [
    { orderby: 'name asc', description: 'name ascending' },
    { orderby: 'name desc', description: 'name descending' },
    { orderby: 'createdAt desc', description: 'newest first' },
    { orderby: 'updatedAt desc', description: 'recently updated first' }
  ];

  const entitySpecificSorting: Record<string, Array<{ orderby: string; description: string }>> = {
    users: [
      { orderby: 'username asc', description: 'username alphabetical' },
      { orderby: 'email asc', description: 'email alphabetical' }
    ],
    customers: [
      { orderby: 'email asc', description: 'email alphabetical' }
    ],
    orders: [
      { orderby: 'orderTime desc', description: 'most recent orders first' },
      { orderby: 'urgent desc, orderTime desc', description: 'urgent first, then by time' },
      { orderby: 'orderStatus asc', description: 'status alphabetical' }
    ],
    suppliers: [
      { orderby: 'country asc, name asc', description: 'country then name' },
      { orderby: 'status desc', description: 'status priority' }
    ],
    fitters: [
      { orderby: 'location asc', description: 'location alphabetical' },
      { orderby: 'specialization asc', description: 'specialization alphabetical' },
      { orderby: 'available desc', description: 'available first' }
    ],
    brands: [
      { orderby: 'country asc, name asc', description: 'country then brand name' },
      { orderby: 'priceRangeMin asc', description: 'price range low to high' }
    ],
    models: [
      { orderby: 'brand/name asc, name asc', description: 'brand then model name' },
      { orderby: 'specialization asc', description: 'specialization alphabetical' },
      { orderby: 'basePrice asc', description: 'price low to high' }
    ]
  };

  return [
    ...commonSorting,
    ...(entitySpecificSorting[entityType] || [])
  ];
}

/**
 * Generate pagination test cases
 */
export function generatePaginationTestCases(): Array<{ params: Record<string, unknown>; description: string }> {
  return [
    { params: { $top: 10 }, description: 'first 10 items' },
    { params: { $top: 25 }, description: 'first 25 items' },
    { params: { $top: 50 }, description: 'first 50 items' },
    { params: { $top: 10, $skip: 10 }, description: 'second page of 10' },
    { params: { $top: 25, $skip: 50 }, description: 'third page of 25' },
    { params: { $top: 100, $skip: 200 }, description: 'large page offset' }
  ];
}

/**
 * Generate invalid pagination test cases
 */
export function generateInvalidPaginationTestCases(): Array<{ params: Record<string, unknown>; description: string }> {
  return [
    { params: { $top: 0 }, description: 'zero items requested' },
    { params: { $top: -1 }, description: 'negative items requested' },
    { params: { $skip: -1 }, description: 'negative skip value' },
    { params: { $top: 1000 }, description: 'excessive items requested' },
    { params: { $top: 'invalid' }, description: 'non-numeric $top' },
    { params: { $skip: 'invalid' }, description: 'non-numeric $skip' }
  ];
}