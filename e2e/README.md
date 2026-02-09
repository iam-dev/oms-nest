xf# 🧪 OMS E2E Tests - NestJS Backend Integration

Comprehensive End-to-End testing suite for the OMS (Order Management System) application using Playwright with **NestJS backend integration**.

## 🎯 Overview

This E2E test suite provides automated testing for the complete OMS application stack, focusing on:

- **NestJS Backend Integration**: Testing against the new NestJS API architecture
- **Frontend-Backend Integration**: Testing the complete user journey
- **API Validation**: Direct backend API testing without UI layer
- **Security Testing**: Authentication, authorization, and data protection
- **Performance Testing**: Response times and concurrent operations
- **Cross-Browser Compatibility**: Testing across major browsers and devices

## 🏗️ Architecture

```
e2e/
├── auth/              # Authentication flow tests
├── entities/          # CRUD operations for all entities (updated for NestJS)
│   ├── customers.spec.ts
│   ├── orders.spec.ts
│   ├── products.spec.ts (NEW - Product entities)
│   └── suppliers.spec.ts
├── fixtures/          # Test data and mock responses
├── shared/            # Shared utilities and helpers (updated)
├── tests/             # Main test scenarios (API-focused)
├── utils/             # Global setup and teardown (NestJS compatible)
└── playwright.config.ts # Playwright configuration (updated)
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- **NestJS Backend API** running (port 3001)
- OMS Frontend running (port 3000)
- **PostgreSQL database** (port 5433) with test data
- Redis (optional, for caching)

### Installation

```bash
npm install
npx playwright install --with-deps
```

### Database Setup

```bash
# Start PostgreSQL container (if needed)
docker run --rm -v oms_db-data12-backup:/var/lib/postgresql/data \
  -e POSTGRES_DB=oms_nest \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5433:5432 postgres:17.6-alpine

# Run migrations and seed data (from backend directory)
cd ../backend
npm run migration:run
npm run seed:run:relational
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in headed mode (see browser)
npm run test:headed

# Run specific test suites
npm run test:smoke        # Critical functionality
npm run test:critical     # Core business logic
npm run test:regression   # Full regression suite

# Run tests against different environments
npm run test:staging
npm run test:production

# Debug mode
npm run test:debug

# Generate test report
npm run report
```

## 🎪 Test Environments

### Local Development

```bash
ENVIRONMENT=local npm test
```
- Starts NestJS backend and Next.js frontend automatically
- Uses PostgreSQL database (port 5433)
- Full CRUD operations enabled
- Test user creation and cleanup

### Staging Environment

```bash
ENVIRONMENT=staging npm test
```
- Tests against staging NestJS deployment
- Limited data modification
- Performance validation

### Production Environment

```bash
ENVIRONMENT=production npm test
```
- Read-only testing
- Health checks only
- No data modifications

## 📊 Test Categories

### 🔐 Authentication Tests (`@auth`)

Updated for NestJS authentication:

```typescript
// Email/Username login support
const loginResponse = await apiContext.post('/auth/email/login', {
  data: {
    email: 'admin@example.com',  // or username
    password: 'secret'
  }
});

// JWT token validation
expect(loginData).toHaveProperty('token');
expect(loginData).toHaveProperty('user');
```

### 🏢 Entity Tests (`@entities`)

Testing CRUD operations for **all NestJS entities**:

- **✅ Implemented Entities**:
  - **Orders**: Core business entity with complex workflows
  - **Customers**: Customer management and relationships
  - **Fitters**: Professional saddle fitters
  - **Suppliers**: Product suppliers and manufacturers
  - **Users**: System user management with role-based access
  - **EnrichedOrders**: Advanced order views with caching

- **🆕 Product Entities** (newly implemented):
  - **Brands**: Saddle brand management (Tack, Custom, etc.)
  - **Models**: Product models linked to brands
  - **Leathertypes**: Leather material options (Calfskin, Buffalo, etc.)
  - **Options**: Product configuration options (stirrups, flaps, etc.)
  - **Extras**: Additional saddle features and add-ons
  - **Presets**: Saved saddle configurations
  - **Products**: Master product entity with relationships

### 🔌 API Tests (`@api`)

Updated for NestJS REST API:

```typescript
// Standard REST endpoints
GET    /orders              # List orders with pagination
POST   /orders              # Create new order
GET    /orders/:id          # Get order by ID
PATCH  /orders/:id          # Update order (partial)
DELETE /orders/:id          # Delete order

// Enhanced responses
{
  "data": [...],           # Array of entities
  "meta": {                # Pagination metadata
    "page": 1,
    "limit": 10,
    "total": 100
  }
}
```

### 🎨 UI Tests (`@ui`)

- User interface interactions
- Form submissions with NestJS validation
- Navigation flows
- Visual regression testing

## 🛡️ Security Testing

### Authentication Security

```typescript
test('should handle NestJS authentication correctly @critical @api', async () => {
  // Test valid email login
  const validLogin = await apiContext.post('/auth/email/login', {
    data: { email: 'admin@example.com', password: 'secret' }
  });
  expect(validLogin.ok()).toBeTruthy();

  // Test username login (supported)
  const usernameLogin = await apiContext.post('/auth/email/login', {
    data: { email: 'adminuser', password: 'secret' }  // Field name is 'email' but accepts username
  });
  expect(usernameLogin.ok()).toBeTruthy();

  // Test invalid credentials
  const invalidLogin = await apiContext.post('/auth/email/login', {
    data: { email: 'invalid@test.com', password: 'wrong' }
  });
  expect(invalidLogin.status()).toBe(422);
});
```

### Authorization Testing

```typescript
test('should enforce role-based access with NestJS guards @security', async () => {
  // Note: Guards are currently disabled in some controllers
  // This test validates when they are re-enabled

  const protectedResponse = await unauthenticatedContext.get('/orders');
  expect(protectedResponse.status()).toBe(401);
});
```

## 📈 Performance Testing

### Response Time Validation

```typescript
test('should meet NestJS performance requirements @performance', async () => {
  const startTime = Date.now();
  const response = await apiContext.get('/orders?limit=10');
  const responseTime = Date.now() - startTime;

  expect(response.ok()).toBeTruthy();
  expect(responseTime).toBeLessThan(100); // 100ms target for NestJS

  // Validate pagination structure
  const data = await response.json();
  expect(data).toHaveProperty('data');
  expect(data).toHaveProperty('meta');
  expect(data.meta).toHaveProperty('total');
});
```

### Product Entity Performance

```typescript
test('should efficiently handle product entity queries @performance @products', async () => {
  const endpoints = [
    '/brands',
    '/models',
    '/leathertypes',
    '/options',
    '/extras',
    '/presets',
    '/products'
  ];

  for (const endpoint of endpoints) {
    const startTime = Date.now();
    const response = await apiContext.get(`${endpoint}?limit=20`);
    const responseTime = Date.now() - startTime;

    expect(response.ok()).toBeTruthy();
    expect(responseTime).toBeLessThan(150); // 150ms for product catalogs
  }
});
```

## 🔧 Configuration

### Environment Variables

```bash
# Test Environment
ENVIRONMENT=local|staging|production

# Service URLs
E2E_BASE_URL=http://localhost:3000
E2E_API_URL=http://localhost:3001

# Database Configuration (for NestJS backend)
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=oms_nest

# JWT Configuration
JWT_ACCESS_TOKEN_SECRET=test-jwt-secret-key-for-e2e
JWT_REFRESH_TOKEN_SECRET=test-jwt-refresh-secret-for-e2e

# Test Credentials (matching NestJS seeds)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secret
USER_EMAIL=user@example.com
USER_PASSWORD=secret
FITTER_EMAIL=fitter@example.com
FITTER_PASSWORD=secret
```

### NestJS Backend Startup

The E2E configuration automatically starts the NestJS backend:

```typescript
// playwright.config.ts - webServer configuration
{
  command: 'cd ../backend && npm run start:dev',
  port: 3001,
  env: {
    NODE_ENV: 'test',
    DATABASE_HOST: 'localhost',
    DATABASE_PORT: '5433',
    DATABASE_USERNAME: 'postgres',
    DATABASE_PASSWORD: 'postgres',
    DATABASE_NAME: 'oms_nest',
    JWT_ACCESS_TOKEN_SECRET: 'test-jwt-secret-key-for-e2e'
  }
}
```

## 📊 Test Data Management

### NestJS Seed Data

```typescript
// Test users are created via NestJS seeds
export const TEST_USERS = {
  admin: {
    username: 'admin@example.com',
    password: 'secret',
    role: 'admin'
  },
  user: {
    username: 'user@example.com',
    password: 'secret',
    role: 'user'
  },
  fitter: {
    username: 'fitter@example.com',
    password: 'secret',
    role: 'fitter'
  }
};
```

### Product Entity Test Data

```typescript
// fixtures/product-data.ts
export const TEST_BRANDS = [
  { name: 'Test Brand', description: 'E2E test brand' }
];

export const TEST_MODELS = [
  { name: 'Test Model', brandId: 1, description: 'E2E test model' }
];

export const TEST_LEATHERTYPES = [
  { name: 'Test Leather', description: 'E2E test leather type' }
];
```

## 🆕 New Product Entity Testing

### Brand-Model Relationships

```typescript
test('should validate brand-model relationships @relationships @products', async () => {
  // Create brand
  const brandResponse = await apiContext.post('/brands', {
    data: { name: 'Test Brand', description: 'For relationship testing' }
  });
  const brand = await brandResponse.json();

  // Create model with brand relationship
  const modelResponse = await apiContext.post('/models', {
    data: { name: 'Test Model', brandId: brand.id, description: 'For testing' }
  });
  const model = await modelResponse.json();

  // Verify relationship
  expect(model.brandId).toBe(brand.id);

  // Test model with included brand
  const modelWithBrandResponse = await apiContext.get(`/models/${model.id}?include=brand`);
  const modelWithBrand = await modelWithBrandResponse.json();
  expect(modelWithBrand).toHaveProperty('brand');
  expect(modelWithBrand.brand.id).toBe(brand.id);

  // Cleanup
  await apiContext.delete(`/models/${model.id}`);
  await apiContext.delete(`/brands/${brand.id}`);
});
```

### Product Configuration Testing

```typescript
test('should handle complex product configurations @products @options', async () => {
  // Test options with different types
  const stirrupOption = await apiContext.post('/options', {
    data: { name: 'Test Stirrups', optionType: 'stirrups' }
  });

  const flapOption = await apiContext.post('/options', {
    data: { name: 'Test Flaps', optionType: 'flaps' }
  });

  // Test extras with pricing
  const extraResponse = await apiContext.post('/extras', {
    data: { name: 'Test Extra', price: 99.99 }
  });

  // Test presets with configuration
  const presetResponse = await apiContext.post('/presets', {
    data: {
      name: 'Test Preset',
      configuration: { seatSize: 17.5, leather: 'calfskin' }
    }
  });

  // Verify all entities
  expect(stirrupOption.ok()).toBeTruthy();
  expect(flapOption.ok()).toBeTruthy();
  expect(extraResponse.ok()).toBeTruthy();
  expect(presetResponse.ok()).toBeTruthy();
});
```

## 🔍 API Response Validation

### Standard REST Format

```typescript
// All entity endpoints return consistent format
{
  "data": [
    {
      "id": 1,
      "name": "Entity Name",
      // ... entity-specific fields
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pageCount": 10
  }
}
```

### Entity-Specific Fields

```typescript
// Expected fields per entity type
const ENTITY_CONFIGS = {
  orders: ['id', 'status', 'notes', 'customerId', 'fitterId', 'createdAt'],
  customers: ['id', 'name', 'email', 'phone'],
  brands: ['id', 'name', 'description'],
  models: ['id', 'name', 'brandId', 'brand'],
  options: ['id', 'name', 'description', 'optionType'],
  extras: ['id', 'name', 'description', 'price'],
  presets: ['id', 'name', 'description', 'configuration']
};
```

## 🏆 Best Practices for NestJS Integration

### Test Organization

- **Entity-Focused**: Group tests by NestJS entities
- **Relationship Testing**: Validate entity relationships
- **DTO Validation**: Test request/response data structures
- **Error Scenarios**: Test NestJS validation and error responses

### Authentication Best Practices

```typescript
// Create authenticated context once per test file
let authToken: string;
let apiContext: any;

test.beforeEach(async () => {
  // Login — server sets httpOnly auth cookie via Set-Cookie header
  await apiContext.post('/auth/email/login', {
    data: { email: 'admin@example.com', password: 'secret' }
  });

  // Playwright's APIRequestContext automatically stores and sends cookies
  // No manual Authorization header needed
});
```

### Performance Optimization

- **Use Pagination**: Always test with realistic page sizes
- **Parallel Execution**: Test multiple entities concurrently
- **Database Cleanup**: Clean up test data to maintain performance
- **Connection Pooling**: Rely on NestJS connection management

## 🌟 Advanced NestJS Features

### Filtering and Sorting

```typescript
test('should handle NestJS OData-style filtering @filtering', async () => {
  // Test filtering
  const filteredResponse = await apiContext.get('/orders?status=draft&customerId=1');
  const filteredData = await filteredResponse.json();

  // Verify all returned orders match filter
  filteredData.data.forEach(order => {
    expect(order.status).toBe('draft');
    expect(order.customerId).toBe(1);
  });

  // Test sorting
  const sortedResponse = await apiContext.get('/orders?sortBy=createdAt&sortOrder=desc');
  const sortedData = await sortedResponse.json();

  // Verify sorting
  if (sortedData.data.length > 1) {
    const dates = sortedData.data.map(order => new Date(order.createdAt));
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i].getTime()).toBeGreaterThanOrEqual(dates[i + 1].getTime());
    }
  }
});
```

### Enriched Orders Testing

```typescript
test('should handle enriched orders with caching @enriched-orders', async () => {
  const enrichedResponse = await apiContext.get('/enriched-orders');
  expect(enrichedResponse.ok()).toBeTruthy();

  const enrichedData = await enrichedResponse.json();
  expect(enrichedData).toHaveProperty('data');

  // Verify enriched fields
  if (enrichedData.data.length > 0) {
    const firstOrder = enrichedData.data[0];
    expect(firstOrder).toHaveProperty('customer');
    expect(firstOrder).toHaveProperty('fitter');
    expect(firstOrder).toHaveProperty('orderTime');
  }
});
```

## 🚨 Common Test Commands

### Development Commands

```bash
# Run all E2E tests
npm test

# Run tests with browser visible
npm run test:headed

# Run specific test suite
npm run test -- --grep "@products"

# Debug specific test
npm run test:debug -- tests/api.spec.ts

# Run tests in UI mode
npm run test:ui

# Clean and run tests
npm run clean && npm test
```

### Environment-Specific Commands

```bash
# Local testing (default)
ENVIRONMENT=local npm test

# Test against staging
ENVIRONMENT=staging npm run test:staging

# Production health checks
ENVIRONMENT=production npm run test:production
```

## 📞 Support

For questions or issues with NestJS integration:

1. Check NestJS backend documentation in `/backend/README.md`
2. Review Playwright documentation: https://playwright.dev
3. Check CLAUDE.md for project-specific guidance
4. Create an issue in the project repository
5. Contact the development team

## 🔄 Migration Notes

### Key Changes from Legacy PHP Backend

1. **API Base URL**: Changed from `:8888` to `:3001`
2. **Response Format**: Now uses standard REST format with `data`/`meta` instead of Hydra
3. **Authentication**: Uses `/auth/email/login` endpoint
4. **Entity Endpoints**: Direct REST endpoints (e.g., `/orders` instead of `/entity/enriched_orders`)
5. **Product Entities**: All 7 product entities now available for testing

### Updated Test Files

- ✅ `playwright.config.ts` - Updated for NestJS backend
- ✅ `shared/api-helpers.ts` - Updated entity configurations
- ✅ `shared/auth-helpers.ts` - Updated authentication
- ✅ `tests/api.spec.ts` - Updated API test patterns
- ✅ `entities/customers.spec.ts` - Updated response validation
- 🆕 `entities/products.spec.ts` - New product entity tests
- ✅ `utils/global-setup.ts` - Updated for NestJS

---

**Happy Testing with NestJS!** 🎉

*Updated for NestJS backend integration - January 2024*