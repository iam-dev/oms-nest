# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Order Management System (OMS) for saddle manufacturing (equestrian industry). Monorepo with three packages, each with their own `CLAUDE.md` for package-specific guidance:

- **`/backend`** — NestJS 11 API (Hexagonal Architecture, TypeORM, PostgreSQL, Redis)
- **`/frontend`** — Next.js 15 UI (React 19, Turbopack, shadcn/ui, Tailwind 4)
- **`/e2e`** — Playwright E2E tests (multi-browser, multi-environment)

## Git Configuration

- Author name: `iam-dev`
- Author email: `affiliaps@gmail.com`

## Quick Start

```bash
# Start infrastructure
cd backend && docker-compose up -d postgres redis adminer maildev

# Backend (runs on port 3001)
cd backend && npm run migration:run && npm run start:dev

# Frontend (runs on port 3000)
cd frontend && npm run dev

# E2E tests
cd e2e && npx playwright test
```

## Common Commands

### Backend (`cd backend`)

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | Dev server with hot reload |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests (Jest) |
| `npm run test -- --testPathPattern="customer"` | Run tests matching pattern |
| `npm run test:cov` | Coverage report |
| `npm run test:e2e` | E2E API tests with database |
| `npm run migration:generate -- src/database/migrations/Name` | Generate migration |
| `npm run migration:run` | Apply migrations |
| `npm run migration:revert` | Rollback last migration |
| `npm run seed:run:relational` | Run database seeds |
| `npm run generate:resource:relational` | Scaffold new entity (Hygen) |

### Frontend (`cd frontend`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (Turbopack, port 3000) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript validation |
| `npm test` | Component tests (Jest) |

### E2E (`cd e2e`)

| Command | Purpose |
|---------|---------|
| `npx playwright test` | Run all E2E tests |
| `npx playwright test --headed` | Visible browser |
| `npx playwright test --ui` | Interactive UI mode |
| `npm run test:staging` | Run against staging |
| `npm run test:smoke` | Smoke tests only |

## Pre-Commit Hooks (Husky)

### Pre-commit (runs on every commit)
- GitLeaks secret scanning
- Backend: `npm run lint && tsc --noEmit`
- Frontend: `npm run lint && npm run type-check`

### Pre-push (runs before push)
- Backend: `npm run test`
- Frontend: `npm run test`

## Architecture

### Backend — Hexagonal Architecture

Each entity follows the structure: `domain → infrastructure → dto → controller → service`

```
backend/src/[entity]/
├── domain/[entity].ts                           # Pure domain model
├── infrastructure/persistence/relational/
│   ├── entities/[entity].entity.ts              # TypeORM entity
│   ├── repositories/[entity].repository.ts      # Data access
│   └── mappers/[entity].mapper.ts               # Entity↔Domain mapping
├── dto/                                         # Request/response DTOs
├── [entity].service.ts                          # Business logic
├── [entity].controller.ts                       # HTTP layer
└── [entity].module.ts                           # NestJS module
```

### Key Backend Patterns

- **ID Strategy**: Legacy entities use integer IDs (`@PrimaryGeneratedColumn()`), new entities (extras, files) use UUID (`@PrimaryGeneratedColumn("uuid")`). Only the User entity has a dual ID (`id` + `legacyId`)
- **JWT Auth**: `@UseGuards(AuthGuard("jwt"))` on all protected controllers
- **Roles**: FITTER(1), ADMIN(2), FACTORY(3), CUSTOMSADDLER(4), SUPERVISOR(5), USER(6). Hierarchy: SUPERVISOR > ADMIN > FITTER/FACTORY > USER
- **Redis Caching**: 5-minute TTL with automatic invalidation
- **Row Level Security (RLS)**: PostgreSQL-level data isolation
- **Materialized Views**: `enriched_order_view`, `order_edit_view` for order queries
- **Global Interceptors**: AuditLog, ResolvePromises, ClassSerializer

### Frontend Patterns

- **App Router** with `@/` path alias for imports
- **Generic EntityTable**: Reusable table component with filtering (`components/shared/EntityTable.tsx`)
- **Centralized API**: Auth headers and error handling via `services/api.ts`
- **shadcn/ui**: Component library in `components/ui/`

### API Response Formats

Different endpoints use different response shapes:

- **Paginated** (customers, fitters, factories, orders): `{ data: T[], total, pages }`
- **Order search**: `{ orders: T[], total, page, limit, hasNext, hasPrev }`
- **Hydra** (saddle-stock, enriched-orders): `{ hydra:member, hydra:totalItems, hydra:view }`
- **Simple array** (active, urgent, overdue): direct `T[]`

## Infrastructure

### Docker Services

```bash
docker-compose up -d              # All services
docker-compose up -d postgres redis  # Just DB + cache
```

| Service | Port | Notes |
|---------|------|-------|
| PostgreSQL 17 | 5432 | DB: `oms_nest`, User: `oms` |
| Redis 7 | 6379 | Cache + sessions |
| Maildev | 1080 | Email testing UI |
| Adminer | 8080 | Database admin UI |

### API Endpoints

- **Swagger UI**: `http://localhost:3001/docs`
- **Health check**: `http://localhost:3001/api/health`
- **Auth login**: `POST /api/v1/auth/email/login`

### CI/CD (GitHub Actions)

- **`ci-cd.yml`**: Security scans (GitLeaks, Trivy, CodeQL), backend/frontend tests, E2E (chromium/firefox/webkit), Docker build + push to GHCR
- **`pr-checks.yml`**: Lint, type-check, tests with coverage, API validation, performance checks
- Services: PostgreSQL 16 + Redis 7, Node.js 20

### Cloud Infrastructure (DigitalOcean)

| Resource | Details |
|----------|---------|
| Kubernetes | DigitalOcean DOKS cluster (AMS3 region), shared by staging & production |
| Database (staging) | DO Managed PostgreSQL (external, port 25060, SSL enabled) |
| Database (production) | DO Managed PostgreSQL (external, port 25060, SSL enabled) |
| Storage Class | `do-block-storage` (Redis persistence in production) |
| Ingress | NGINX Ingress Controller + cert-manager (Let's Encrypt) |
| Secrets | Bitnami SealedSecrets (encrypted in Git, auto-decrypted by controller) |
| Registry | GHCR (`ghcr.io/iam-dev/oms-nest-backend`, `ghcr.io/iam-dev/oms-nest-frontend`) |

### Environments

| | Staging | Production |
|---|---------|------------|
| Namespace | `oms-nest-staging` | `oms-nest-production` |
| Frontend URL | `next-staging.ordermysaddle.com` | `nest-production.ordermysaddle.com` |
| Backend URL | `api-nest-staging.ordermysaddle.com` | `api-nest-production.ordermysaddle.com` |
| Backend replicas | 2 (HPA: 2-6) | 3 (HPA: 3-10) |
| Frontend replicas | 1 (HPA: 1-4) | 2 (HPA: 2-6) |
| Redis persistence | No | Yes (2Gi `do-block-storage`) |
| Maildev | Enabled | Disabled |
| Deploy method | Push to `staging` branch (GitHub Actions) | Manual (`workflow_dispatch` / `kubectl apply`) |
| Manifests | `kubernetes/staging-v2/` | `kubernetes/production/` |
| Helm values | `kube/helm/oms-nest/values-staging.yaml` | `kube/helm/oms-nest/values-production.yaml` |

### Staging → Production Checklist

1. Provision production DO Managed PostgreSQL (or separate DB on existing cluster)
2. Run migrations on production DB
3. Create production SealedSecret (`kubeseal` with production credentials)
4. Configure DNS records for production domains → DOKS load balancer IP
5. Apply production manifests: `kubectl apply -f kubernetes/production/`
6. Verify TLS certificates issued by cert-manager
7. Run E2E tests against production URLs
8. Verify health endpoints return 200

## Documentation

Detailed documentation in [`docs/`](./docs/):

| Document | Description |
|----------|-------------|
| [Getting Started](./docs/getting-started.md) | Development environment setup |
| [Architecture](./docs/architecture.md) | System design (backend, frontend, infrastructure) |
| [API Reference](./docs/api-reference.md) | All REST endpoints with request/response examples |
| [Development Workflow](./docs/development-workflow.md) | Branching, CI/CD, testing, code generation |
| [Deployment Guide](./docs/deployment.md) | Production deployment and Kubernetes |
| [Staging Deployment](./docs/staging-deployment.md) | Staging environment on DigitalOcean DOKS |
| [Migration Quick Start](./docs/migration-readme.md) | Legacy data import (quick reference) |
| [Production Data Migration](./docs/production-data-migration.md) | Full migration reference (schema, scripts, validation) |

Package-specific docs:

- **Backend boilerplate**: [`backend/docs/`](./backend/docs/) — NestJS boilerplate reference (architecture, database, auth, serialization, CLI, file-uploading, tests)
- **Backend entity guide**: [`backend/docs/entity-implementation-guide.md`](./backend/docs/entity-implementation-guide.md) — Step-by-step entity implementation
- **Production data**: [`backend/src/database/seeds/relational/production-data/README.md`](./backend/src/database/seeds/relational/production-data/README.md) — In-repo migration reference

## Conventions

- Follow existing hexagonal architecture patterns for new entities
- Use TypeORM decorators for entities, class-validator for DTOs
- ID strategy: legacy entities use integer IDs; new entities (not in legacy DB) use UUID. Only User has a dual ID (`id` + `legacyId`)
- Redis caching: 5-minute TTL with automatic invalidation on mutations
- E2E tests: use flexible format assertions (handle both `{ data }` and direct array responses)
- Saddle-stock and enriched-orders use raw SQL with JOINs on legacy tables
- All controllers require `@UseGuards(AuthGuard("jwt"))` for protected routes
