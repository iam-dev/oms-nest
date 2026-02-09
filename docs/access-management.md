# Access Management

Comprehensive reference for the OMS role-based access control system, covering backend API enforcement, frontend screen permissions, and Row Level Security.

## Role Definitions

| ID | Enum Name | Display Name | Description |
|----|-----------|-------------|-------------|
| 1 | `fitter` | Fitter | Saddle fitters who measure customers and manage their own orders/customers |
| 2 | `admin` | Administrator | Full management access to all business entities |
| 3 | `factory` | Factory (Supplier) | Factory/supplier users who manage their own factory and employees |
| 4 | `customsaddler` | Custom Saddler | Custom saddle makers (limited access, similar to fitter) |
| 5 | `supervisor` | Supervisor | Highest privilege role with account management capabilities |
| 6 | `user` | User | Basic read-only access to dashboard and orders |

Roles are defined in `backend/src/roles/roles.enum.ts`.

## Role Hierarchy

```
SUPERVISOR (5) ── highest privilege, full system access + account management
    |
  ADMIN (2) ── full business entity management
    |
  FITTER (1) / FACTORY (3) / CUSTOMSADDLER (4) ── scoped access
    |
  USER (6) ── minimal access
```

- **Supervisor** inherits all admin permissions and adds account management (user CRUD, warehouses, access filter groups, country managers).
- **Admin** can manage all business entities but cannot manage user accounts.
- **Fitter** can access customers, orders, saddle-stock, enriched orders, comments, and order-product-saddles.
- **Factory** can access factories, factory-employees, and saddles.
- **User** has minimal access (dashboard only in frontend).

## Role Naming: Backend vs Frontend

| Backend (`RoleEnum`) | Frontend (`UserRole`) | Notes |
|----------------------|-----------------------|-------|
| `factory` (3) | `SUPPLIER` | The frontend displays "Factory" but uses `SUPPLIER` enum internally |
| `fitter` (1) | `FITTER` | Same naming |
| `admin` (2) | `ADMIN` | Same naming |
| `supervisor` (5) | `SUPERVISOR` | Same naming |
| `user` (6) | `USER` | Same naming |
| `customsaddler` (4) | — | Not referenced in frontend permissions |

## Role Resolution

A user's role is determined by the `getUserRole()` method in `backend/src/users/users.service.ts`:

1. **`is_supervisor = 1`** in `credentials` table → **supervisor** (overrides `user_type`)
2. **`user_type = 2`** → **admin**
3. **`user_type = 3`** → **factory**
4. **`user_type = 4`** → **customsaddler**
5. **`user_type = 1`** → **fitter** (verified against `fitters` table)
6. Fallback: check `fitters` table for legacy cases
7. Default: **user**

## API Endpoint Access Matrix

Based on `@Roles()` decorator on each controller. All endpoints require `@UseGuards(AuthGuard("jwt"))`.

| Controller / Endpoint | Admin | Supervisor | Fitter | Factory | User |
|----------------------|:-----:|:----------:|:------:|:-------:|:----:|
| `/api/v1/customers` | Y | Y | Y | - | - |
| `/api/v1/orders` | Y | Y | Y | - | - |
| `/api/v1/order-lines` | Y | Y | Y | - | - |
| `/api/v1/fitters` | Y | Y | - | - | - |
| `/api/v1/factories` | Y | Y | - | Y | - |
| `/api/v1/factory-employees` | Y | Y | - | Y | - |
| `/api/v1/saddles` | Y | Y | Y | Y | - |
| `/api/v1/saddle-stock` | Y | Y | Y | - | - |
| `/api/v1/enriched_orders` | Y | Y | Y | - | - |
| `/api/v1/comments` | Y | Y | Y | - | - |
| `/api/v1/order-product-saddles` | Y | Y | Y | - | - |
| `/api/v1/users` | Y | Y | - | - | - |
| `/api/v1/brands` | Y | Y | - | - | - |
| `/api/v1/options` | Y | Y | - | - | - |
| `/api/v1/options-items` | Y | Y | - | - | - |
| `/api/v1/extras` | Y | Y | - | - | - |
| `/api/v1/leathertypes` | Y | Y | - | - | - |
| `/api/v1/presets` | Y | Y | - | - | - |
| `/api/v1/warehouses` | Y | Y | - | - | - |
| `/api/v1/saddle-extras` | Y | Y | - | - | - |
| `/api/v1/saddle-leathers` | Y | Y | - | - | - |
| `/api/v1/saddle-options-items` | Y | Y | - | - | - |
| `/api/v1/country-managers` | Y | Y | - | - | - |
| `/api/v1/access-filter-groups` | Y | Y | - | - | - |
| `/api/v1/audit-logs` | Y | Y | - | - | - |
| `/api/v1/database-query-logs` | Y | Y | - | - | - |
| `/api/v1/cache` | Y | Y | - | - | - |
| `/api/v1/metrics` | Y | Y | - | - | - |

**Legend:** Y = allowed, - = denied (returns 401/403)

## Frontend Screen Permissions

Defined in `frontend/utils/rolePermissions.ts`. The frontend `UserRole.SUPPLIER` maps to the backend `factory` role.

### Navigation

| Screen | User | Fitter | Supplier | Admin | Supervisor |
|--------|:----:|:------:|:--------:|:-----:|:----------:|
| Dashboard | Y | Y | Y | Y | Y |
| Orders | Y | Y | - | Y | Y |
| Customers | - | Y | - | Y | Y |
| Fitters | - | - | - | Y | Y |
| Reports | - | - | - | Y | Y |

### Saddle Modeling

| Screen | User | Fitter | Supplier | Admin | Supervisor |
|--------|:----:|:------:|:--------:|:-----:|:----------:|
| Brands | Y | - | - | Y | Y |
| Models | Y | - | - | Y | Y |
| Leather Types | Y | - | - | Y | Y |
| Options | Y | - | - | Y | Y |
| Extras | Y | - | - | Y | Y |
| Presets | Y | - | - | Y | Y |
| Suppliers | - | - | Y | Y | Y |

### Account Management (Supervisor Only)

| Screen | User | Fitter | Supplier | Admin | Supervisor |
|--------|:----:|:------:|:--------:|:-----:|:----------:|
| User Management | - | - | - | - | Y |
| Warehouse Management | - | - | - | - | Y |
| User Permissions View | - | - | - | - | Y |
| Access Filter Groups | - | - | - | - | Y |
| Country Managers | - | - | - | - | Y |

### Entity Actions

| Action | User | Fitter | Supplier | Admin | Supervisor |
|--------|:----:|:------:|:--------:|:-----:|:----------:|
| Order Create | Y | Y | - | Y | Y |
| Order Edit | - | - | - | Y | Y |
| Order Delete | - | - | - | Y | Y |
| Customer Create | - | Y | - | Y | Y |
| Customer Edit | - | Y | - | Y | Y |
| Customer Delete | - | - | - | Y | Y |
| Fitter CRUD | - | - | - | Y | Y |
| Supplier CRUD | - | - | - | Y | Y |
| User CRUD | - | - | - | - | Y |
| Warehouse CRUD | - | - | - | - | Y |

### Saddle Stock

| Screen | User | Fitter | Supplier | Admin | Supervisor |
|--------|:----:|:------:|:--------:|:-----:|:----------:|
| Repairs | Y | Y | - | Y | Y |
| My Saddle Stock | - | Y | - | - | - |
| Available Saddle Stock | - | Y | - | - | - |
| All Saddle Stock | - | - | - | Y | Y |

## Row Level Security (RLS)

PostgreSQL RLS policies provide data isolation at the database level, managed by `backend/src/rls/rls.service.ts`.

### How It Works

1. On each authenticated request, the `RlsGuard` calls `RlsService.setUserContext()`.
2. Session variables are set on the PostgreSQL connection:
   - `rls.user_id` — current user's UUID
   - `rls.user_role` — role ID from `RoleEnum`
   - `rls.factory_id` — factory ID (for factory users)
   - `rls.fitter_id` — fitter ID (for fitter users)
3. RLS policies on tables use these variables to filter rows.

### Data Visibility by Role

| Role | Data Scope |
|------|------------|
| Supervisor | All data (no filtering) |
| Admin | All data (no filtering) |
| Fitter | Only their own customers and orders (filtered by `fitter_id`) |
| Factory | Only their own factory and employees (filtered by `factory_id`) |
| User | Minimal data access |

### Audit Trail Protection

- Audit logs are read-only for non-supervisors.
- Only supervisor and admin roles can access `audit-logs` and `database-query-logs` endpoints.

## Test User Credentials

These users are created by the seed service (`backend/src/database/seeds/relational/user/user-seed.service.ts`) in non-production environments.

| Role | Email / Username | Password | user_type | is_supervisor |
|------|-----------------|----------|-----------|---------------|
| Admin | `admin@omsaddle.com` | `AdminPass123!` | 2 | 0 |
| Supervisor | `supervisor@omsaddle.com` | `SupervisorPass123!` | 2 | 1 |
| Fitter | `sarah.thompson@fitters.com` | `FitterPass123!` | 1 | 0 |
| Factory | `factory-test@omsaddle.com` | `FactoryPass123!` | 3 | 0 |
| User | `testuser` | `TestUser123!` | 6 | 0 |

Environment variables can override these in CI:

| Variable | Default |
|----------|---------|
| `TEST_ADMIN_EMAIL` | `admin@omsaddle.com` |
| `TEST_ADMIN_PASSWORD` | `AdminPass123!` |
| `TEST_SUPERVISOR_EMAIL` | `supervisor@omsaddle.com` |
| `TEST_SUPERVISOR_PASSWORD` | `SupervisorPass123!` |
| `TEST_FITTER_EMAIL` | `sarah.thompson@fitters.com` |
| `TEST_FITTER_PASSWORD` | `FitterPass123!` |
| `TEST_FACTORY_EMAIL` | `factory-test@omsaddle.com` |
| `TEST_FACTORY_PASSWORD` | `FactoryPass123!` |
| `TEST_USER_EMAIL` | `testuser` |
| `TEST_USER_PASSWORD` | `TestUser123!` |

## How to Run Access Tests

```bash
# Run role-based access tests locally
cd e2e && npx playwright test tests/role-access.spec.ts

# Run with a specific browser
cd e2e && npx playwright test tests/role-access.spec.ts --project=chromium

# Run against staging
cd e2e && ENVIRONMENT=staging npx playwright test tests/role-access.spec.ts

# Run all security-tagged tests
cd e2e && npx playwright test --grep @security
```

## Adding a New Role-Protected Endpoint

1. Add `@Roles(RoleEnum.admin, RoleEnum.supervisor, ...)` decorator to the controller
2. Ensure `@UseGuards(AuthGuard("jwt"))` is present on the controller class
3. Add the endpoint to `ENDPOINT_ACCESS` in `e2e/tests/role-access.spec.ts`
4. Update the API Endpoint Access Matrix table above
5. If the endpoint has a frontend screen, update `SCREEN_PERMISSIONS` in `frontend/utils/rolePermissions.ts`
