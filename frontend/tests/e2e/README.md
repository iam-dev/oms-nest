# E2E Testing for OrderMySaddle API Integration

This directory contains comprehensive end-to-end tests for the OrderMySaddle Next.js application, focusing on API integration with the PHP/Symfony backend.

## Test Structure

```
tests/e2e/
├── auth/                    # Authentication flow tests
│   └── login.spec.ts       # Login, logout, role-based access
├── entities/               # Business entity tests
│   ├── orders.spec.ts     # Order management (complex filtering, search)
│   ├── customers.spec.ts  # Customer CRUD operations
│   └── suppliers.spec.ts  # Supplier management
├── setup/                  # Test configuration and utilities
│   ├── global-setup.ts    # Global test setup (API health checks)
│   └── verify-setup.spec.ts # Setup verification tests
├── shared/                 # Shared utilities and helpers
│   ├── auth-helpers.ts    # Authentication helper functions
│   └── api-helpers.ts     # API validation utilities
└── README.md              # This file
```

## Prerequisites

Before running the tests, ensure the following services are running:

1. **Backend API** (PHP/Symfony): `http://localhost:8888`
2. **Frontend** (Next.js): `http://localhost:3000`
3. **Database** (PostgreSQL): Accessible via backend

### Starting Services

```bash
# From the root project directory
docker-compose up

# Or start services individually
cd api && composer install && php -S localhost:8888  # Backend
cd next-ui && npm run dev                              # Frontend
```

## Test Commands

### Run All E2E Tests
```bash
npm run test:e2e
```

### Run Specific Test Suites
```bash
npm run test:e2e:auth        # Authentication tests only
npm run test:e2e:entities    # Entity management tests only
```

### Interactive Test Mode
```bash
npm run test:e2e:ui          # Opens Playwright UI
```

### Custom Test Runner
```bash
npm run test:e2e:run         # Uses our custom test runner with prerequisites check
```

## Test Configuration

### Authentication
Tests use credentials from environment variables. Update credentials in `shared/auth-helpers.ts` or via `.env` if needed.

### API Endpoints Tested

| Entity | Endpoint | Features Tested |
|--------|----------|----------------|
| Orders | `/enriched_orders` | Filtering, search, pagination, complex data |
| Customers | `/customers` | CRUD operations, search, validation |
| Suppliers | `/suppliers` | CRUD operations, search |
| Users | `/users` | User management, role-based access |
| Fitters | `/fitters` | Fitter management |
| Warehouses | `/warehouses` | Warehouse operations |
| Models | `/models` | Product configuration |
| Brands | `/brands` | Brand management |
| Leathertypes | `/leathertypes` | Material options |
| Options | `/options` | Product options |
| Extras | `/extras` | Additional features |
| Presets | `/presets` | Saved configurations |

## Test Features

### Authentication Testing
- ✅ Valid login flow
- ✅ Invalid credentials handling
- ✅ Logout functionality
- ✅ Protected route access
- ✅ Session persistence
- ✅ Role-based permissions

### API Integration Testing
- ✅ Response structure validation (Hydra/API Platform)
- ✅ Pagination support (`hydra:totalItems`, `hydra:view`)
- ✅ OData-style filtering (`$filter`, `$orderby`)
- ✅ Search functionality
- ✅ Sorting capabilities
- ✅ Error handling
- ✅ Authentication headers

### Entity Management Testing
- ✅ Table display and data loading
- ✅ CRUD operations (Create, Read, Update, Delete)
- ✅ Search and filtering
- ✅ Sorting by columns
- ✅ Pagination controls
- ✅ Detail view modals
- ✅ Data validation

## Utilities and Helpers

### AuthHelper Class
Provides authentication functionality:
- `login(user)` - Login with test user
- `logout()` - Logout functionality
- `isLoggedIn()` - Check authentication state
- `ensureLoggedIn(user)` - Ensure user is authenticated
- `getAuthToken()` - Retrieve JWT token

### ApiHelper Class
Provides API testing functionality:
- `validateEntityResponse()` - Validate API response structure
- `validateODataParams()` - Check OData query parameters
- `validateSearchParam()` - Verify search functionality
- `validateFilterParam()` - Check filtering
- `validateSortParam()` - Verify sorting
- `waitForApiCall()` - Wait for specific API requests
- `mockApiResponse()` - Mock API responses for testing

## Adding New Tests

### Creating Entity Tests
1. Create new file: `tests/e2e/entities/[entity].spec.ts`
2. Follow existing pattern:
   ```typescript
   import { test, expect } from '@playwright/test';
   import { AuthHelper, TEST_USERS } from '../shared/auth-helpers';
   import { ApiHelper } from '../shared/api-helpers';

   test.describe('[Entity] Management', () => {
     let authHelper: AuthHelper;
     let apiHelper: ApiHelper;

     test.beforeEach(async ({ page }) => {
       authHelper = new AuthHelper(page);
       apiHelper = new ApiHelper(page);
       await authHelper.login(TEST_USERS.admin);
       await page.goto('/[entity]');
     });

     // Add your tests here
   });
   ```

### Adding New API Configurations
Update `shared/api-helpers.ts` with new entity configurations:
```typescript
export const ENTITY_CONFIGS: Record<string, EntityTestConfig> = {
  newEntity: {
    endpoint: '/new_entities',
    entityName: 'NewEntity',
    expectedFields: ['id', 'name', 'description'],
    searchable: true,
    filterable: true,
    sortable: true,
    pagination: true
  }
};
```

## Troubleshooting

### Common Issues

1. **Backend not accessible**
   ```bash
   # Check if backend is running
   curl http://localhost:8888/health

   # Start backend if needed
   docker-compose up api
   ```

2. **Frontend not accessible**
   ```bash
   # Check if frontend is running
   curl http://localhost:3000

   # Start frontend if needed
   npm run dev
   ```

3. **Database connection issues**
   ```bash
   # Restore local database
   ./restore_local_db.sh

   # Check database status
   docker-compose ps database
   ```

4. **Authentication failures**
   - Verify test user credentials in database
   - Check if user roles are correctly set
   - Ensure JWT tokens are properly configured

### Debug Mode
Run tests with debug output:
```bash
DEBUG=pw:api npm run test:e2e
```

### Test Reports
After running tests, view detailed reports:
- HTML Report: `playwright-report/index.html`
- JSON Report: `test-results.json`

## Best Practices

1. **Test Independence**: Each test should be independent and not rely on other tests
2. **Cleanup**: Tests should clean up after themselves
3. **Resilient Selectors**: Use data-testid attributes when possible
4. **API Validation**: Always validate API responses and error handling
5. **Performance**: Keep tests focused and avoid unnecessary delays
6. **Documentation**: Document complex test scenarios and expected behaviors

## Contributing

When adding new tests:
1. Follow existing naming conventions
2. Add proper error handling
3. Include comprehensive API validation
4. Update this README if adding new test categories
5. Ensure tests pass in CI environment

## Related Documentation

- [Playwright Documentation](https://playwright.dev/)
- [API Platform Testing](https://api-platform.com/docs/core/testing/)
- [Next.js Testing](https://nextjs.org/docs/testing)
- [OrderMySaddle API Documentation](../../../api/README.md)