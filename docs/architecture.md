# System Architecture

This document describes the architecture of the OMS (Order Management System), a monorepo for saddle manufacturing order management in the equestrian industry.

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
├─────────────────────────────────────────────────────────────┤
│  Web Browser (Next.js)  │  API Clients (Postman/Swagger)   │
└────────────┬────────────┴──────────────┬────────────────────┘
             │                           │
             ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│              NGINX Ingress Controller                       │
│    SSL Termination · cert-manager (Let's Encrypt)           │
└────────────┬────────────┬──────────────────────────────────-┘
             │            │
             ▼            ▼
┌────────────────┐  ┌────────────────┐
│   Frontend     │  │   Backend API  │
│   Next.js 15   │  │   NestJS 11    │
│   Port: 3000   │  │   Port: 3001   │
└────────────────┘  └───────┬────────┘
                            │
                    ┌───────┴────────┐
                    │                │
                    ▼                ▼
             ┌────────────┐  ┌────────────┐
             │ PostgreSQL  │  │   Redis    │
             │     17      │  │     7      │
             │ Port: 5432  │  │ Port: 6379 │
             └────────────┘  └────────────┘
```

## Technology Stack

### Backend

```
NestJS 11 (Node.js)
├── TypeScript
├── TypeORM (PostgreSQL ORM)
├── Passport.js + JWT (Authentication)
├── class-validator / class-transformer (DTOs)
├── @nestjs/terminus (Health checks)
├── Redis (ioredis) — Cache + sessions
├── Swagger/OpenAPI — API docs at /docs
├── Jest — Unit + integration tests
└── Docker — Containerization
```

### Frontend

```
Next.js 15 (App Router, Turbopack, React 19)
├── TypeScript (strict mode)
├── Tailwind CSS 4 — Utility-first styling
├── shadcn/ui + Radix UI — 50+ accessible components
├── Jotai — Atomic state management
├── React Hook Form + Zod — Form handling + validation
├── TanStack React Table — Headless table logic
├── jose + jsonwebtoken — JWT handling
├── Recharts — Charts
├── exceljs / jspdf — Export to Excel/PDF
├── Sonner — Toast notifications
├── Jest + React Testing Library — Component tests
└── Playwright — E2E tests
```

### Infrastructure

```
DigitalOcean DOKS (Kubernetes)
├── NGINX Ingress Controller
├── cert-manager (Let's Encrypt TLS)
├── Bitnami SealedSecrets (encrypted secrets in Git)
├── Horizontal Pod Autoscaling
├── Network Policies
├── GitHub Actions (CI/CD)
├── GHCR (Container Registry)
└── Helm Charts (deployment templates)
```

## Backend Architecture

### Hexagonal Architecture

Every business entity follows this structure:

```
backend/src/[entity]/
├── domain/
│   └── [entity].ts                    # Pure domain model (no infrastructure deps)
├── infrastructure/persistence/relational/
│   ├── entities/[entity].entity.ts    # TypeORM entity
│   ├── repositories/[entity].repository.ts
│   ├── mappers/[entity].mapper.ts
│   └── relational-persistence.module.ts
├── dto/
│   ├── create-[entity].dto.ts
│   ├── update-[entity].dto.ts
│   └── query-[entity].dto.ts
├── [entity].service.ts                # Business logic
├── [entity].controller.ts             # HTTP layer
└── [entity].module.ts                 # NestJS module
```

### Modules

The `AppModule` registers ~47 modules. Key modules by category:

**Core Business:**
- `orders/` — Central order management
- `order-lines/` — Order line items (orders_info)
- `customers/` — Customer management
- `fitters/` — Saddle fitters
- `factories/` — Manufacturing facilities
- `factory-employees/` — Factory staff
- `users/` — User management

**Product Catalog:**
- `brands/` — Saddle brands (Custom, Icon, Wolfgang)
- `saddles/` — Master product entity
- `leathertypes/` — Material options
- `options/` — Configuration categories
- `options-items/` — Specific choices within options
- `extras/` — Additional product features (UUID PKs)
- `saddle-extras/` — Saddle-extras relationships
- `saddle-leathers/` — Saddle-leather combinations
- `saddle-options-items/` — Saddle-option relationships
- `presets/` — Saved configurations
- `saddle-stock/` — Stock queries (Hydra format, raw SQL)
- `order-product-saddles/` — Order-product-saddle links

**System:**
- `auth/` — Authentication (Passport.js, JWT, account lockout)
- `roles/` — Role definitions and guards
- `rls/` — PostgreSQL Row Level Security
- `cache/` — Redis caching (production cache service, warming, metrics, invalidation)
- `enriched-orders/` — Materialized view queries with caching
- `audit-logging/` — Audit trail + database query logging
- `health/` — Health check endpoints
- `monitoring/` — Metrics collection
- `session/` — Session management
- `mail/` / `mailer/` — Email services
- `files/` — File management
- `comments/` — Comments system
- `statuses/` — Order status definitions
- `access-filter-groups/` — Access control groups
- `country-managers/` — Country management

### Global Interceptors

Registered in `app.module.ts` and `main.ts`:

| Interceptor | Scope | Purpose |
|-------------|-------|---------|
| `AuditLogInterceptor` | Global (`APP_INTERCEPTOR`) | Logs mutations (POST, PUT, PATCH, DELETE) with entity type, action, user, and order status changes. Uses `@AuditLog()` decorator metadata. |
| `ResolvePromisesInterceptor` | Global (`main.ts`) | Resolves nested promises in response objects before serialization |
| `ClassSerializerInterceptor` | Global (`main.ts`) | Applies class-transformer serialization (excludes `@Exclude()` fields) |
| `CacheInterceptor` | Per-controller | Caches GET responses in Redis with configurable TTL and key |
| `MonitoringInterceptor` | Per-controller | Records HTTP request metrics (method, route, status, duration) |

### Authentication & Authorization

**Auth Flow:**

1. `POST /api/v1/auth/email/login` — Submit email/username + password
2. `AuthService.validateLogin()` → `usersService.findByEmailOrUsername()` (dual login)
3. Password validation via bcrypt
4. Account lockout check (`failedLoginAttempts`, `lockedUntil`)
5. JWT token generation (access + refresh tokens)
6. Audit log of login action

**Guards (applied per-controller):**

```typescript
@UseGuards(JwtAuthGuard, RlsGuard, RolesGuard)
@Roles(RoleEnum.admin, RoleEnum.supervisor)
```

| Guard | Purpose |
|-------|---------|
| `JwtAuthGuard` | Validates JWT from Authorization header, sets `request.user` |
| `RolesGuard` | Checks `@Roles()` decorator metadata against `request.user.role.id` |
| `RlsGuard` | Sets PostgreSQL session variables for Row Level Security context |

**Roles** (defined in `roles/roles.enum.ts`):

| ID | Role | Description |
|----|------|-------------|
| 1 | `fitter` | Professional saddle fitters |
| 2 | `admin` | System administration |
| 3 | `factory` | Manufacturing and fulfillment |
| 4 | `customsaddler` | Custom saddle specialists |
| 5 | `supervisor` | Approval and oversight (highest) |
| 6 | `user` | Basic user access |

Hierarchy: SUPERVISOR > ADMIN > FITTER/FACTORY > USER

### Row Level Security (RLS)

PostgreSQL-level data isolation. The `RlsService` sets session variables used by RLS policies:

- `rls.user_id` — Current user's UUID
- `rls.user_role` — Role ID from `RoleEnum`
- `rls.factory_id` — Factory ID (factory users only)
- `rls.fitter_id` — Fitter ID (fitter users only)

RLS policies automatically filter queries based on these variables without application code changes.

### Materialized Views

Two materialized views for pre-computed order data (created in migration `1737000000000-CreateEnrichedOrderViews`):

**`enriched_order_view`** — Pre-joins orders with customers, fitters, factories, saddles, leather types, statuses. Includes computed `total_price`. Supports `CONCURRENT REFRESH` via unique index on `order_id`.

**`order_edit_view`** — Aggregates order configuration details for editing UI.

Queried by `EnrichedOrdersService` using raw SQL, cached in Redis with 5-minute TTL.

### Caching

Redis-based caching with multiple components in `cache/`:

| Component | Purpose |
|-----------|---------|
| `ProductionCacheService` | Main cache get/set/delete operations |
| `CacheInvalidationService` | TTL management, automatic invalidation on mutations |
| `CacheWarmingService` | Pre-populates cache on application startup |
| `CacheMetricsService` | Tracks cache hit/miss ratios |
| `CacheManagementController` | Admin endpoints for cache management |
| `@Cache()` decorator | Method-level caching configuration |
| `CacheInterceptor` | Automatic HTTP response caching for GET requests |

Default TTL: 5 minutes. Invalidation on mutations (POST, PUT, PATCH, DELETE).

### Health Endpoints

Four endpoints via `@nestjs/terminus` (`health/health.controller.ts`):

| Endpoint | Purpose | Checks |
|----------|---------|--------|
| `GET /health` | General health | DB, Redis, Memory (150 MB), Disk (90%) |
| `GET /health/ready` | K8s readiness probe | DB only |
| `GET /health/live` | K8s liveness probe | Memory (200 MB), Disk (95%) |
| `GET /health/detailed` | Comprehensive report | All checks + metadata (version, env, timestamp) |

### API Response Formats

Different endpoints return different shapes:

| Pattern | Endpoints | Shape |
|---------|-----------|-------|
| Paginated | customers, fitters, factories, orders | `{ data: T[], total, pages }` |
| Order search | enriched orders search | `{ orders: T[], total, page, limit, hasNext, hasPrev }` |
| Hydra | saddle-stock, enriched-orders | `{ hydra:member, hydra:totalItems, hydra:view }` |
| Simple array | active, urgent, overdue endpoints | `T[]` |

### Database

**ID Strategy:**
- Legacy entities use integer primary keys (`SERIAL`) matching the original MySQL schema
- New entities (extras, files) use UUID (`@PrimaryGeneratedColumn("uuid")`)
- Only `User` has a dual ID system (`id` UUID + `legacyId` integer)

**TypeORM Configuration** (`database/typeorm-config.service.ts`):
- Connection pooling via `database.maxConnections`
- Conditional SSL with certificate support
- Logging enabled in development, disabled in production
- Entities auto-discovered via `src/**/*.entity{.ts,.js}` pattern
- Migrations in `src/database/migrations/`

**Migrations:** 18 TypeORM migrations covering initial schema (21 legacy tables), RLS policies, enriched order views, search indexes, seat sizes JSONB column, extras/audit tables, and user email population. See [Production Data Migration](./production-data-migration.md) for details.

## Frontend Architecture

### App Router Structure

Next.js 15 App Router with 37 route segments:

```
frontend/
├── app/                              # Route segments
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Redirects to /dashboard
│   ├── login/                        # Authentication
│   ├── dashboard/                    # Main dashboard
│   ├── orders/                       # Order management
│   ├── customers/                    # Customer management
│   ├── fitters/                      # Fitter management
│   ├── factories/                    # Factory management
│   ├── brands/, leathertypes/, options/, extras/
│   ├── models/, products/, product-stocks/
│   ├── saddle-stock/, my-saddle-stock/
│   ├── repairs/, reports/
│   ├── users/, user-permissions/, warehouses/
│   └── ...
├── components/
│   ├── ui/                           # 50+ shadcn/ui components (Radix-based)
│   ├── shared/                       # Reusable business components
│   │   ├── EntityTable.tsx           # Generic table for all entities
│   │   ├── DataTable.tsx             # Core table (TanStack React Table)
│   │   ├── TableHeaderFilter.tsx     # OData-compatible filtering
│   │   ├── [Entity]DetailModal.tsx   # View modals
│   │   ├── [Entity]EditModal.tsx     # Edit modals
│   │   ├── forms/                    # Entity form components
│   │   └── filters/                  # Filter implementations
│   ├── providers/                    # Context/state providers
│   └── SaddleModelling/              # Saddle modeling UI
├── context/
│   └── AuthContext.tsx               # Auth state (Jotai atoms)
├── services/
│   ├── api.ts                        # Centralized API (auth headers, OData filters)
│   ├── auth/
│   │   └── withPageRequiredAuth.tsx   # Route protection HOC
│   └── [entity].ts                   # 30+ entity-specific services
├── store/
│   └── auth.ts                       # Jotai atoms (token, user, loading)
├── hooks/
│   ├── useEntities.ts                # Generic data fetching
│   ├── useEntityData.ts              # Pagination + filtering
│   ├── usePagination.ts              # Pagination logic
│   ├── useTableFilters.ts            # Table filter state
│   ├── useToken.ts                   # Token management
│   └── useUserRole.ts               # Role checking
├── types/                            # TypeScript interfaces
│   ├── Role.ts, Order.ts, Customer.ts, etc.
│   └── EnrichedOrder.ts
└── middleware.ts                      # Edge middleware (route protection)
```

### State Management (Jotai)

Atomic state management for auth and per-entity data:

```
tokenAtom (localStorage) → isAuthenticatedAtom (derived)
userAtom (memory)        → userBasicInfoAtom (localStorage fallback)
isAuthLoadingAtom        → loading states
```

### Authentication (Two-Layer)

1. **Edge Middleware** (`middleware.ts`) — Checks JWT in cookies/headers, validates role against route map, sets `x-user-id` and `x-user-role` headers
2. **Component HOC** (`withPageRequiredAuth`) — Client-side check after hydration, redirects to `/login` if unauthenticated

### EntityTable Pattern

Generic, reusable table component (`components/shared/EntityTable.tsx`) used by all entity pages:

- Generic `<T extends { id?: string | number }>` typing
- Supports 15+ entity types
- Built on DataTable (TanStack React Table) + action buttons (View, Edit, Delete, Approve)
- OData-compatible header filters
- Pagination, search, loading/error states

### API Service Layer

Centralized in `services/api.ts`:
- Bearer token from Jotai store with localStorage/cookie fallback
- OData-style filter building with `escapeODataString()`
- Base URL: `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`)
- 30+ entity-specific service files for CRUD operations

### Configuration

`next.config.ts`:
- `output: 'standalone'` — Optimized for Docker
- Security headers: HSTS, X-Frame-Options (DENY), X-Content-Type-Options (nosniff), CSP
- Image optimization: webp, avif formats, 60s cache TTL
- Compression enabled

## Infrastructure

### Kubernetes

Shared DigitalOcean DOKS cluster (AMS3 region) with two namespaces:

| | Staging | Production |
|---|---------|------------|
| Namespace | `oms-nest-staging` | `oms-nest-production` |
| Frontend URL | `next-staging.ordermysaddle.com` | `nest-production.ordermysaddle.com` |
| Backend URL | `api-nest-staging.ordermysaddle.com` | `api-nest-production.ordermysaddle.com` |
| Backend replicas | 2 (HPA: 2–6) | 3 (HPA: 3–10) |
| Frontend replicas | 1 (HPA: 1–4) | 2 (HPA: 2–6) |
| Redis persistence | No | Yes (2 Gi `do-block-storage`) |
| Maildev | Enabled | Disabled |
| Secrets | Bitnami SealedSecrets | Template-based |

Manifests in `kubernetes/staging-v2/` (7 files) and `kubernetes/production/` (6 files).

### Helm Charts

Located in `kube/helm/oms-nest/` with 19 templates:

- Deployments: backend, frontend, maildev, redis
- HPAs: backend, frontend
- Services: backend, frontend
- Networking: ingress, network policies
- Secrets: sealed-secrets, registry-secret, RBAC
- Jobs: migration job
- Monitoring: Prometheus rules, ServiceMonitor
- Values: `values.yaml`, `values-staging.yaml`, `values-production.yaml`

### Docker

**Backend:**
- `Dockerfile` — Development (Node 22-alpine, hot reload)
- `Dockerfile.production` — Multi-stage build (Node 20-alpine, dumb-init, non-root user, healthcheck)

**Frontend:**
- `Dockerfile` — Production (Node 20-alpine, multi-stage, standalone output)
- `Dockerfile.dev` — Development

### Docker Compose (Local Development)

Root `docker-compose.yml` runs the full stack:

| Service | Port | Image |
|---------|------|-------|
| Backend API | 3001 | Local build |
| Frontend | 3000 | Local build |
| PostgreSQL | 5432 | postgres:17.6-alpine |
| Redis | 6379 | redis:7-alpine |
| Maildev | 1080 | Email testing UI |
| Adminer | 8080 | Database admin UI |

Additional compose files: `backend/docker-compose.yaml` (backend-only), `docker-compose.relational.test.yaml` (tests), `docker-compose.relational.ci.yaml` (CI).

### CI/CD (GitHub Actions)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci-cd.yml` | Push to main/staging, PRs, daily schedule | Security scans (GitLeaks, Trivy, CodeQL), dependency audit, Docker build + push to GHCR |
| `pr-checks.yml` | PRs to main/staging | Lint, type-check, coverage tests, CodeQL |
| `staging-deployment.yml` | Push to staging branch, manual dispatch | Build images, push to GHCR, deploy to K8s (`oms-nest-staging`) |
| `codeql.yml` | Push to main/staging, PRs, weekly | CodeQL advanced security analysis |

Container images pushed to GHCR:
- `ghcr.io/iam-dev/oms-nest-backend`
- `ghcr.io/iam-dev/oms-nest-frontend`

## Architectural Decisions

### NestJS + Hexagonal Architecture

Chosen for built-in TypeScript support, dependency injection, modular architecture, and the guards/interceptors/pipes ecosystem. Hexagonal architecture separates domain logic from infrastructure, making entities testable and portable.

### TypeORM

Mature ORM with NestJS integration, migration system, complex query builder, and support for both entity mapping and raw SQL (used by enriched-orders and saddle-stock).

### Jotai (Frontend State)

Atomic state management with less boilerplate than Redux. `atomWithStorage` provides persistence. Derived atoms compute auth state without re-renders.

### Monorepo

Enables shared context between backend/frontend/e2e packages. Unified CI/CD pipeline. Each package has its own `CLAUDE.md`, `package.json`, and test configuration.

### Integer PKs for Legacy Data

Legacy tables retain `SERIAL` integer primary keys matching the original MySQL schema. This allows direct joins in materialized views and raw SQL queries without UUID mapping overhead. Only new entities (extras, files) and the User entity use UUIDs.

## Related Documentation

- **[API Reference](./api-reference.md)** — Endpoint documentation
- **[Deployment Guide](./deployment.md)** — Infrastructure and deployment
- **[Staging Deployment](./staging-deployment.md)** — Staging environment
- **[Production Data Migration](./production-data-migration.md)** — Data migration tooling
- **[Development Workflow](./development-workflow.md)** — Development practices
- **[Getting Started](./getting-started.md)** — Setup guide
