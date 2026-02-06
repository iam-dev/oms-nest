# Development Workflow

This guide covers the development workflow for the OMS monorepo: branching strategy, local quality gates, CI/CD pipelines, testing, and deployment.

## Git Workflow

### Branch Strategy

| Branch | Purpose | Deploys to |
|--------|---------|------------|
| `main` | Production-ready code | Production (manual) |
| `staging` | Staging integration | Staging (auto via GitHub Actions) |
| `develop` | Day-to-day integration | — |
| `feature/*` | Feature work | — |

### Feature Branch Flow

```text
feature/brands-crud
    ↓  PR + CI checks
develop
    ↓  PR or merge
staging        → auto-deploys to DigitalOcean DOKS
    ↓  PR + manual approval
main           → manual deploy (workflow_dispatch / kubectl apply)
```

### Typical Feature Cycle

```bash
# 1. Create a feature branch from develop
git checkout develop && git pull
git checkout -b feature/brands-crud

# 2. Develop, commit (pre-commit hooks run automatically)
git add -A && git commit -m "feat: implement brands CRUD"

# 3. Push (pre-push hooks run tests)
git push -u origin feature/brands-crud

# 4. Open a PR targeting develop
gh pr create --title "feat: implement brands CRUD" --base develop

# 5. CI runs pr-checks.yml — lint, type-check, tests, security, API validation
# 6. Review → merge to develop
# 7. When ready, merge develop → staging (triggers staging-deployment.yml)
# 8. After staging validation, merge staging → main for production release
```

## Pre-Commit and Pre-Push Hooks (Husky)

Husky hooks run automatically on every commit and push. They are defined in `.husky/`.

### Pre-Commit (`.husky/pre-commit`)

Runs on every `git commit`:

1. **GitLeaks** — scans staged files for secrets (requires `gitleaks` installed)
2. **Backend lint** — `npm run lint` in `/backend`
3. **Backend type-check** — `npx tsc --noEmit` in `/backend`
4. **Frontend lint** — `npm run lint` in `/frontend`
5. **Frontend type-check** — `npm run type-check` in `/frontend`

### Pre-Push (`.husky/pre-push`)

Runs on every `git push`:

1. **Backend unit tests** — `npm run test` in `/backend`
2. **Frontend unit tests** — `npm run test` in `/frontend`

## CI/CD Pipeline (GitHub Actions)

Four workflow files live in `.github/workflows/`:

### `pr-checks.yml` — Pull Request Quality Gates

Triggers on PRs targeting `main` or `staging`. Five parallel jobs:

| Job | What it does |
|-----|-------------|
| **code-quality** | Backend + frontend: install, lint, type-check, tests with coverage, frontend build |
| **security-checks** | `npm audit --audit-level=high` for both packages, CodeQL analysis |
| **api-validation** | Starts backend with PostgreSQL + Redis, validates health and auth on core endpoints |
| **performance-check** | Starts backend, measures response times for health and enriched-orders endpoints |
| **documentation-check** | Verifies required files exist, runs markdownlint |
| **pr-summary** | Posts a summary comment on the PR with pass/fail status for all jobs |

### `ci-cd.yml` — DevSecOps Pipeline

Triggers on pushes to `main`/`staging`, PRs, and a daily 2 AM UTC security scan schedule.

| Job | Depends on | What it does |
|-----|-----------|-------------|
| **security-scan** | — | GitLeaks, Trivy filesystem scan, CodeQL SAST |
| **dependency-scan** | — | `npm audit` for backend, frontend, and e2e packages |
| **test-backend** | security-scan, dependency-scan | Lint, unit tests, migrations, integration tests (PostgreSQL + Redis) |
| **test-frontend** | security-scan, dependency-scan | Lint, unit tests, production build |
| **test-e2e** | test-backend, test-frontend | Playwright tests across chromium/firefox/webkit matrix, plus smoke and security test tags |
| **build-and-push** | all above | Docker build + push to GHCR (only on `main`/`staging` branches) |

Docker images are pushed to:

- `ghcr.io/iam-dev/oms-nest-backend`
- `ghcr.io/iam-dev/oms-nest-frontend`

### `staging-deployment.yml` — Deploy to Staging

Triggers on push to `staging` branch or manual `workflow_dispatch`.

| Job | Depends on | What it does |
|-----|-----------|-------------|
| **security-scan** | — | Trivy filesystem scan |
| **backend-build** | security-scan | Lint, type-check, build, tests, Docker build + push |
| **frontend-build** | security-scan | Lint, type-check, tests, build, Docker build + push |
| **deploy-staging** | backend-build, frontend-build | Apply K8s manifests to `oms-nest-staging` namespace on DigitalOcean DOKS |
| **e2e-tests** | deploy-staging | Playwright E2E tests against live staging URLs |
| **notify** | deploy-staging, e2e-tests | Slack notification with success/failure status |

### `codeql.yml` — CodeQL Advanced

Scheduled weekly (Thursdays) plus on pushes/PRs to `main`/`staging`. Analyzes `javascript-typescript` and `actions` languages.

## Development Commands Quick Reference

### Backend (`cd backend`)

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | Dev server with hot reload (watch mode) |
| `npm run start:debug` | Debug mode with `--watch` |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier formatting |
| `npm run test` | Unit tests (Jest) |
| `npm run test -- --testPathPattern="customer"` | Run tests matching a pattern |
| `npm run test:watch` | Watch mode |
| `npm run test:cov` | Coverage report |
| `npm run test:unit` | Unit tests only (`test/unit/`) |
| `npm run test:e2e` | E2E tests with database |
| `npm run test:e2e-api` | API integration tests (`test/e2e-api/`) |
| `npm run test:e2e-api:full` | Setup + run API integration tests |
| `npm run migration:generate -- src/database/migrations/Name` | Generate migration from entity changes |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:revert` | Rollback last migration |
| `npm run seed:run:relational` | Run database seeds |
| `npm run generate:resource:relational` | Scaffold new entity module (Hygen) |
| `npm run add:property:to-relational` | Add property to existing entity (Hygen) |

### Frontend (`cd frontend`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (Turbopack, port 3000) |
| `npm run build` | Production build |
| `npm run lint` | ESLint (Next.js config) |
| `npm run type-check` | TypeScript validation (`tsc --noEmit`) |
| `npm test` | Component tests (Jest + React Testing Library) |

### E2E (`cd e2e`)

| Command | Purpose |
|---------|---------|
| `npx playwright test` | Run all E2E tests |
| `npx playwright test --headed` | Visible browser |
| `npx playwright test --ui` | Interactive UI mode |
| `npm run test:staging` | Run against staging environment |
| `npm run test:production` | Run against production environment |
| `npm run test:smoke` | Smoke tests only (`@smoke` tag) |
| `npm run test:critical` | Critical path tests (`@critical` tag) |
| `npm run test:regression` | Regression tests (`@regression` tag) |

## Code Generation

The backend uses [Hygen](https://www.hygen.io/) templates to scaffold new entities following the hexagonal architecture.

### Generate a New Entity

```bash
cd backend
npm run generate:resource:relational
```

This interactive command generates the full hexagonal structure:

```text
src/[entity]/
├── domain/[entity].ts                              # Pure domain model
├── infrastructure/persistence/relational/
│   ├── entities/[entity].entity.ts                  # TypeORM entity
│   ├── repositories/[entity].repository.ts          # Data access
│   └── mappers/[entity].mapper.ts                   # Entity ↔ Domain mapping
├── dto/
│   ├── create-[entity].dto.ts
│   ├── update-[entity].dto.ts
│   └── query-[entity].dto.ts
├── [entity].service.ts                              # Business logic
├── [entity].controller.ts                           # HTTP layer
└── [entity].module.ts                               # NestJS module
```

### Add a Property to an Existing Entity

```bash
cd backend
npm run add:property:to-relational
```

### After Code Generation

1. Review generated files and add business logic
2. Generate a migration: `npm run migration:generate -- src/database/migrations/AddEntityName`
3. Run the migration: `npm run migration:run`
4. Add seeds if needed
5. Write tests

## Testing Strategy

### Unit Tests (Jest)

Both backend and frontend use Jest for unit testing.

**Backend:**

```bash
cd backend
npm run test                                    # All unit tests
npm run test -- --testPathPattern="brands"      # Tests matching pattern
npm run test:cov                                # With coverage report
npm run test:unit                               # Only test/unit/ directory
```

Test files use the pattern `test/unit/**/*.spec.ts`. Test helpers are available at `test/unit/helpers/test-helpers.ts`.

**Frontend:**

```bash
cd frontend
npm test                    # All tests
npm test -- --coverage      # With coverage
```

Uses Jest with React Testing Library and jsdom environment.

### E2E API Tests (Jest + Database)

Integration tests that run against a real PostgreSQL + Redis instance:

```bash
cd backend
npm run test:e2e-api:full    # Setup database + run tests
npm run test:e2e-api         # Run tests only (database must be running)
```

### E2E Browser Tests (Playwright)

Multi-browser tests in the `/e2e` package, testing the full stack (frontend + backend):

```bash
cd e2e
npx playwright test                          # All browsers
npx playwright test --project=chromium       # Single browser
npx playwright test --grep="@smoke"          # Tagged tests
npx playwright test --headed                 # Visible browser
npx playwright test --ui                     # Interactive mode
```

CI runs the full matrix: chromium, firefox, and webkit.

### Coverage Targets

- Backend: >90%
- Critical paths (auth, orders): 100%

## Linting and Code Quality

### ESLint

Both packages use ESLint v9 with flat config:

```bash
cd backend && npm run lint     # ESLint for src/, test/, apps/, libs/
cd frontend && npm run lint    # ESLint with Next.js config
```

### TypeScript

Strict mode with `noEmit` checking (no output, validation only):

```bash
cd backend && npx tsc --noEmit
cd frontend && npm run type-check    # same as tsc --noEmit
```

### Prettier

Backend has Prettier configured for formatting:

```bash
cd backend && npm run format    # prettier --write "src/**/*.ts" "test/**/*.ts"
```

## Deployment

### Staging

Push to the `staging` branch triggers automatic deployment via `staging-deployment.yml`:

1. Security scan (Trivy)
2. Build + test backend and frontend
3. Docker build + push to GHCR with `staging-latest` tag
4. Apply K8s manifests from `kubernetes/staging-v2/` to `oms-nest-staging` namespace
5. Deploy Redis → backend → frontend → ingress
6. Health check endpoints
7. Run Playwright E2E tests against live staging
8. Slack notification

**Staging URLs:**

- Frontend: `https://nest-staging.ordermysaddle.com`
- Backend API: `https://api-nest-staging.ordermysaddle.com`

### Production

Production deployment is manual:

- `workflow_dispatch` from GitHub Actions, or
- `kubectl apply -f kubernetes/production/`

**Production URLs:**

- Frontend: `https://nest-production.ordermysaddle.com`
- Backend API: `https://api-nest-production.ordermysaddle.com`

### Docker Images

Images are stored in GitHub Container Registry:

- `ghcr.io/iam-dev/oms-nest-backend`
- `ghcr.io/iam-dev/oms-nest-frontend`

Tags follow the pattern `{branch}-{short-sha}` (e.g., `staging-abc1234`), plus `staging-latest` and `latest` for the default branch.

## Best Practices

### Architecture

- Follow the hexagonal architecture pattern for all new entities
- Domain models (`domain/[entity].ts`) must have no infrastructure dependencies
- Use TypeORM decorators for entities, class-validator for DTOs
- ID strategy: legacy entities use integer IDs; new entities use UUID

### Authentication and Authorization

- All controllers require `@UseGuards(AuthGuard("jwt"))` for protected routes
- Use role-based access control with the defined role hierarchy
- Row Level Security (RLS) enforces data isolation at the PostgreSQL level

### Caching

- Redis caching with 5-minute TTL
- Automatic cache invalidation on mutations
- Materialized views (`enriched_order_view`, `order_edit_view`) for order queries

### Database Changes

1. Modify the TypeORM entity
2. Generate migration: `npm run migration:generate -- src/database/migrations/DescriptiveName`
3. Review the generated SQL
4. Run migration: `npm run migration:run`
5. Test rollback: `npm run migration:revert`

### Testing

- Write tests alongside implementation
- Use test helpers from `test/unit/helpers/test-helpers.ts`
- E2E tests should use flexible format assertions to handle different response shapes
- Tag E2E tests with `@smoke`, `@critical`, or `@regression` for selective execution
