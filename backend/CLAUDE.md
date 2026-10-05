# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Order Management System (OMS) for saddle manufacturing. NestJS backend built on brocoders/nestjs-boilerplate with Hexagonal Architecture. Frontend is Next.js 15 in `/frontend`.

## Development Commands

```bash
# Development
npm run start:dev          # Watch mode with hot reload
npm run start:debug        # Debug mode with --watch
npm run build              # Build to dist/
npm run lint               # ESLint
npm run format             # Prettier

# Testing
npm run test               # Run all unit tests
npm run test:watch         # Watch mode
npm run test:cov           # Coverage report
npm run test:unit          # Unit tests only (test/unit/)
npm run test:e2e           # E2E tests with database

# Run single test file
npm run test -- path/to/file.spec.ts
npm run test -- --testPathPattern="customer"

# Database
npm run migration:generate -- src/database/migrations/MigrationName
npm run migration:run
npm run migration:revert
npm run seed:run:relational

# Code generation
npm run generate:resource:relational    # Generate complete entity module
npm run add:property:to-relational      # Add property to existing entity
```

## Architecture

### Hexagonal Architecture Pattern
Each business entity follows this structure:
```
src/[entity]/
├── domain/
│   └── [entity].ts                    # Domain model (no infrastructure deps)
├── infrastructure/persistence/relational/
│   ├── entities/[entity].entity.ts    # TypeORM entity
│   ├── repositories/[entity].repository.ts
│   └── mappers/[entity].mapper.ts
├── dto/
│   ├── create-[entity].dto.ts
│   ├── update-[entity].dto.ts
│   └── query-[entity].dto.ts
├── [entity].service.ts
├── [entity].controller.ts
└── [entity].module.ts
```

### Key Patterns

- **ID Strategy**: Legacy entities use integer IDs (`SERIAL`), new entities (extras, files) use UUID. Only User has a dual ID (`id` UUID + `legacyId` integer)
- **JWT Authentication**: All controllers use `@UseGuards(AuthGuard("jwt"))` with role-based access
- **Row Level Security (RLS)**: Data isolation via PostgreSQL RLS policies
- **Redis Caching**: 5-minute TTL with automatic invalidation
- **Dual Login**: Auth supports both username and email via `findByEmailOrUsername()`

### Database

- **PostgreSQL** with TypeORM
- **TypeORM Config**: `src/database/typeorm-config.service.ts`
- **Migrations**: `src/database/migrations/`
- **Seeds**: `src/database/seeds/relational/`

### Enriched Orders System

Materialized views (`enriched_order_view`, `order_edit_view`) provide pre-computed order data. The service uses Redis caching with fallback queries when views are unavailable.

## Production Data

Loading production data (local dev, staging, production) follows one procedure: [`docs/production-data-migration.md`](../docs/production-data-migration.md). Do not improvise another path.

```text
export zip → oms_mysql_legacy (3307) → per-table files → PostgreSQL files → build database oms_build
          → verify-against-mysql.py (must PASS) → dump → each target → verify-against-mysql.py (must PASS)
```

- The app runs on a database created by `npm run migration:run` (`backend-postgres-1`, port 5432, `oms_nest`). The `oms_postgres_legacy` container on port 5433 has a hand-written schema; the migrations fail on it, so never point `.env` at it.
- To run migrations against another database use an env file: `npx env-cmd -f .env.staging typeorm-ts-node-commonjs --dataSource=src/database/data-source.ts migration:run`. Shell variables do not work, `env-cmd` lets `.env` win.
- Scripts and data are in `src/database/seeds/relational/production-data/`. The scripts are tracked; the data is ignored by a whitelist in `.gitignore` and must never be committed (no `git add -f` there).

## API

- **Swagger UI**: `http://localhost:3001/docs`
- **Health Check**: `http://localhost:3001/api/health`
- **Cookie Auth**: httpOnly JWT cookies, set via `POST /api/v1/auth/email/login`

## Testing

### Coverage Targets
- Backend: >90%
- Critical paths (auth, orders): 100%

### Test Helpers
Located in `test/unit/helpers/test-helpers.ts`:
```typescript
import {
  createMockRepository,
  createMockQueryBuilder,
  TestDataFactory,
  TestUtils
} from '../helpers/test-helpers';
```

### Running Tests
```bash
# All tests
npm run test

# Specific test file
npm run test -- orders/order.service.spec.ts

# Tests matching pattern
npm run test -- --testPathPattern="customer"

# With coverage
npm run test:cov
```

## Key Business Entities

**Core**: Orders, Customers, Fitters, Factories, Users, FactoryEmployees

**Product Catalog**: Brands, Models, Leathertypes, Options, Extras, Presets, Saddles

**System**: AuditLog, DatabaseQueryLog, EnrichedOrders, RLS policies

## Roles

Defined in `src/roles/roles.enum.ts`:
- FITTER (id: 1)
- ADMIN (id: 2)
- FACTORY (id: 3)
- CUSTOMSADDLER (id: 4)
- SUPERVISOR (id: 5)
- USER (id: 6)

**Hierarchy**: SUPERVISOR > ADMIN > FITTER/FACTORY > USER. Users with `is_supervisor=1` in the database get the SUPERVISOR role regardless of `user_type`.

**Account Management is Supervisor-only on the API**: the `users`, `warehouses`, `access-filter-groups` and `country-managers` controllers carry `@Roles(RoleEnum.supervisor)`; Administrators get 403. `test/unit/roles/account-management-roles.spec.ts` pins this — keep it green when adding routes. Self-service profile edits use `PATCH /auth/me` (any role), never `/users/:id`.

## Common Tasks

### Adding a New Entity
1. `npm run generate:resource:relational`
2. Answer prompts for entity name and properties
3. Review generated files, add business logic
4. Generate migration: `npm run migration:generate -- src/database/migrations/AddEntityName`
5. Run migration: `npm run migration:run`
6. Add seeds if needed
7. Write tests

### Database Schema Changes
1. Modify TypeORM entity in `infrastructure/persistence/relational/entities/`
2. Generate: `npm run migration:generate -- src/database/migrations/UpdateEntityName`
3. Review generated SQL
4. Run: `npm run migration:run`
5. Test rollback: `npm run migration:revert`

## Documentation

### Project-level (root `docs/`)

| Document | Description |
|----------|-------------|
| [Getting Started](../docs/getting-started.md) | Development environment setup |
| [Architecture](../docs/architecture.md) | Full system architecture |
| [API Reference](../docs/api-reference.md) | All REST endpoints |
| [Development Workflow](../docs/development-workflow.md) | Branching, CI/CD, testing |
| [Deployment Guide](../docs/deployment.md) | Production deployment |
| [Staging Deployment](../docs/staging-deployment.md) | Staging environment |
| [Migration Quick Start](../docs/migration-readme.md) | Which document to use, short version |
| [Production Data Migration](../docs/production-data-migration.md) | The procedure for loading production data |

### Backend-specific (`backend/docs/`)

- [Entity Implementation Guide](docs/entity-implementation-guide.md) — Step-by-step entity implementation
- [Architecture (Boilerplate)](docs/architecture.md) — Hexagonal architecture reference
- [Database](docs/database.md) — TypeORM migrations, seeds, schema
- [Auth](docs/auth.md) — Authentication setup
- [Serialization](docs/serialization.md) — Class serialization
- [CLI](docs/cli.md) — Command line tools
- [File Uploading](docs/file-uploading.md) — File handling
- [Tests](docs/tests.md) — Testing patterns

### In-repo references

- [Production Data README](src/database/seeds/relational/production-data/README.md)
- [Production Data CLAUDE.md](src/database/seeds/relational/production-data/CLAUDE.md)
