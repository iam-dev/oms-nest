# Getting Started

This guide covers setting up the OMS development environment and running the backend and frontend locally.

## Prerequisites

- **Node.js 20+** and **npm 8+**
- **Docker Desktop** (required for PostgreSQL, Redis, and other services)
- **Git 2.30+**

Optional but recommended:

- **VSCode** with TypeScript, ESLint, and Prettier extensions
- **Postman** or **Insomnia** for API testing

## Repository Structure

```
oms_nest/
├── backend/               # NestJS 11 API (port 3001)
├── frontend/              # Next.js 15 UI (port 3000)
├── e2e/                   # Playwright E2E tests
├── kubernetes/            # K8s manifests (staging, production)
├── kube/                  # Helm charts
├── docs/                  # Documentation
├── docker-compose.yml     # Full-stack Docker Compose
└── .husky/                # Git hooks (pre-commit, pre-push)
```

## Quick Start

### Option A: Services via Docker, Code Locally (Recommended)

Run infrastructure in Docker, run backend and frontend natively for hot reload.

```bash
# 1. Clone the repository
git clone git@github-iam-dev:iam-dev/oms-nest.git
cd oms_nest

# 2. Start infrastructure services
cd backend
docker compose up -d postgres redis maildev adminer

# 3. Install backend dependencies and initialize database
npm install
cp .env.local .env          # Local dev config (already configured for Docker services)
npm run migration:run       # Apply database migrations
npm run seed:run:relational # Seed test users (non-production only)

# 4. Start the backend (port 3001)
npm run start:dev

# 5. In a new terminal, start the frontend (port 3000)
cd frontend
npm install
npm run dev
```

### Option B: Full Stack in Docker

Run everything (backend, frontend, and services) in Docker.

```bash
cd oms_nest

# Start the full stack
docker compose up -d

# The override file (docker-compose.override.yml) automatically:
# - Runs migrations
# - Seeds test users
# - Starts backend in watch mode
```

## Docker Services

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| PostgreSQL 17 | 5432 | — | Database (`oms_nest`, user: `oms`) |
| Redis 7 | 6379 | — | Cache and sessions |
| Maildev | 1080 / 1025 | http://localhost:1080 | Email testing UI |
| Adminer | 8080 | http://localhost:8080 | Database admin UI |
| Backend | 3001 | http://localhost:3001 | NestJS API |
| Frontend | 3000 | http://localhost:3000 | Next.js UI |

## Environment Configuration

### Backend (`backend/.env`)

Copy from the provided template:

```bash
cp backend/.env.local backend/.env
```

Key variables (defaults match Docker Compose):

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_PORT` | `3001` | Backend HTTP port |
| `DATABASE_HOST` | `localhost` | PostgreSQL host |
| `DATABASE_PORT` | `5432` | PostgreSQL port |
| `DATABASE_USERNAME` | `oms` | PostgreSQL user |
| `DATABASE_PASSWORD` | `oms_password` | PostgreSQL password |
| `DATABASE_NAME` | `oms_nest` | PostgreSQL database |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `AUTH_JWT_SECRET` | `secret` | JWT signing key |
| `MAIL_HOST` | `localhost` | SMTP host (Maildev) |
| `MAIL_PORT` | `1025` | SMTP port |

### Frontend (`frontend/.env.local`)

Already configured for local development:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_DEBUG_LOG=true
```

## Verify the Setup

### Backend

- **Swagger UI**: http://localhost:3001/docs
- **Health check**: http://localhost:3001/api/health (checks DB, Redis, memory, disk)
- **Readiness probe**: http://localhost:3001/api/health/ready
- **Liveness probe**: http://localhost:3001/api/health/live

### Frontend

- **Application**: http://localhost:3000 (redirects to login page)

## Seeded Test Users

The seed script (`npm run seed:run:relational`) creates these users in the `credentials` table. These are only created in non-production environments.

| Username | Password | Role |
|----------|----------|------|
| `admin@omsaddle.com` | `AdminPass123!` | ADMIN (2) |
| `sarah.thompson@fitters.com` | `FitterPass123!` | FITTER (1) |
| `testuser` | `TestUser123!` | USER (6) |

Login via the frontend at http://localhost:3000 or via the API:

```bash
curl -X POST http://localhost:3001/api/v1/auth/email/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@omsaddle.com", "password": "AdminPass123!"}'
```

The response includes a JWT `token` and `refreshToken`. Use the token as a Bearer header for authenticated requests.

## Development Commands

### Backend (`cd backend`)

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | Dev server with hot reload |
| `npm run start:debug` | Debug mode (attach Chrome DevTools via `chrome://inspect`) |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run test` | Unit tests (Jest) |
| `npm run test:watch` | Watch mode |
| `npm run test:cov` | Coverage report |
| `npm run test:unit` | Unit tests only (`test/unit/`) |
| `npm run test:e2e` | E2E API tests with database |
| `npm run migration:generate -- src/database/migrations/Name` | Generate migration from entity changes |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:revert` | Rollback last migration |
| `npm run seed:run:relational` | Seed test users |
| `npm run generate:resource:relational` | Scaffold a new entity module (Hygen) |

### Frontend (`cd frontend`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server with Turbopack (port 3000) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript validation (`tsc --noEmit`) |
| `npm test` | Component tests (Jest + React Testing Library) |

### E2E Tests (`cd e2e`)

| Command | Purpose |
|---------|---------|
| `npx playwright test` | Run all tests |
| `npx playwright test --headed` | Visible browser |
| `npx playwright test --ui` | Interactive UI mode |
| `npm run test:staging` | Run against staging environment |
| `npm run test:smoke` | Smoke tests only (`@smoke` tag) |

## Git Hooks (Husky)

Git hooks run automatically and enforce code quality:

### Pre-commit

Runs on every `git commit`:

1. **Gitleaks** secret scanning (if installed: `brew install gitleaks`)
2. **Backend**: `npm run lint` + `tsc --noEmit`
3. **Frontend**: `npm run lint` + `npm run type-check`

### Pre-push

Runs before every `git push`:

1. **Backend**: `npm run test`
2. **Frontend**: `npm run test`

## Common Development Tasks

### Add a New Backend Entity

```bash
cd backend

# 1. Scaffold the entity module (interactive prompts)
npm run generate:resource:relational

# 2. Review generated files in src/<entity>/

# 3. Generate a database migration
npm run migration:generate -- src/database/migrations/AddEntityName

# 4. Apply the migration
npm run migration:run

# 5. Start dev server and test via Swagger UI
npm run start:dev
```

### Add a New Frontend Page

```bash
cd frontend

# 1. Create the route directory
mkdir -p app/new-feature

# 2. Create page.tsx following existing patterns (e.g., app/orders/page.tsx)

# 3. Add navigation entry in the sidebar component

# 4. Start dev server
npm run dev
```

### Database Operations

```bash
cd backend

# Generate migration from entity changes
npm run migration:generate -- src/database/migrations/DescribeChange

# Apply pending migrations
npm run migration:run

# Rollback the last migration
npm run migration:revert

# Drop all tables and recreate (destructive!)
npm run schema:drop
npm run migration:run
npm run seed:run:relational
```

### Import Production Data

To work with real production data locally, see [Production Data Migration](./production-data-migration.md).

Quick summary:

```bash
cd backend/src/database/seeds/relational/production-data/postgres/scripts
./setup-postgres.sh              # PostgreSQL 15 container (port 5433)
./transform-mysql-to-postgres.sh # First time only
./import-data.sh                 # Import ~3M records
./validate-data.sh               # Verify import
```

## Troubleshooting

### Port Already in Use

```bash
# Find what's using a port
lsof -i :3001  # Backend
lsof -i :3000  # Frontend
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis

# Kill a specific port
npx kill-port 3001
```

### Docker Services Not Starting

```bash
# Check service logs
docker compose -f backend/docker-compose.yaml logs postgres
docker compose -f backend/docker-compose.yaml logs redis

# Restart services
docker compose -f backend/docker-compose.yaml down
docker compose -f backend/docker-compose.yaml up -d postgres redis maildev adminer
```

### Database Connection Refused

```bash
# Verify PostgreSQL is running
docker compose -f backend/docker-compose.yaml ps

# Test connection manually
psql -h localhost -U oms -d oms_nest

# Ensure .env matches Docker Compose settings:
# DATABASE_HOST=localhost, DATABASE_PORT=5432, DATABASE_USERNAME=oms
```

### Migration Errors

```bash
cd backend

# Check current migration state
npm run typeorm -- --dataSource=src/database/data-source.ts migration:show

# If stuck, revert and re-run
npm run migration:revert
npm run migration:run
```

### Node Version Issues

```bash
node --version  # Should be 20+

# Use nvm to manage versions
nvm install 20
nvm use 20
nvm alias default 20
```

### Cache / Build Issues

```bash
# Clear Next.js build cache
rm -rf frontend/.next

# Clear backend build cache
rm -rf backend/dist

# Reinstall dependencies
cd backend && rm -rf node_modules && npm install
cd frontend && rm -rf node_modules && npm install
```

## Next Steps

- [System Architecture](./architecture.md) — Backend, frontend, and infrastructure design
- [API Reference](./api-reference.md) — Endpoint documentation
- [Development Workflow](./development-workflow.md) — Branching, CI/CD, and collaboration
- [Production Data Migration](./production-data-migration.md) — Working with legacy MySQL data
- [Staging Deployment](./staging-deployment.md) — Deploy to the staging environment
