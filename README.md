# OMS NestJS - Order Management System

A modern Order Management System for saddle manufacturing, built with NestJS (backend) and Next.js (frontend). This project replaces a legacy PHP/Symfony system with an enterprise-ready TypeScript stack.

## Tech Stack

- **Backend**: NestJS with TypeORM, PostgreSQL, Redis
- **Frontend**: Next.js 15 with TypeScript
- **Database**: PostgreSQL 15+
- **Cache**: Redis
- **Testing**: Jest (unit), Playwright (E2E)

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker)
- Redis (or use Docker)

### 1. Clone and Install

```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Environment Setup

The backend supports multiple environment files via [`env-cmd`](https://www.npmjs.com/package/env-cmd):

| File | Purpose |
|------|---------|
| `backend/.env` | Default environment (used by `start:dev`) |
| `backend/.env.local` | Local overrides (your machine-specific settings) |
| `backend/.env.staging` | Staging/production-data database connection |

```bash
# Copy the example to create your default .env
cp backend/env-example-relational backend/.env

# Optionally create local or staging overrides
cp backend/.env backend/.env.local
cp backend/.env backend/.env.staging

# Frontend environment
cp frontend/.env.example frontend/.env.local
```

### 3. Start Services

```bash
# Start database and cache (Docker)
docker-compose up -d postgres redis

# Run migrations
cd backend && npm run migration:run

# Start frontend (in another terminal)
cd frontend && npm run dev
```

#### Start Backend with Different Environments

```bash
cd backend

# Default — uses .env
npm run start:dev

# Local — uses .env.local
npm run start:dev:local

# Staging — uses .env.staging (connects to staging/production-data DB)
npm run start:dev:staging
```

Each command uses `env-cmd` to load the specified env file. Variables from the env file are injected into `process.env` before NestJS starts, overriding any values in the default `.env`.

### 4. Access Applications

- **Backend API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/docs
- **Frontend**: http://localhost:3001

---

## Database Migration

### Production data

Production data from the legacy OMS is loaded with one procedure: **[docs/production-data-migration.md](docs/production-data-migration.md)**.

```text
export zip → MySQL container → per-table files → PostgreSQL files → build database
          → verify-against-mysql.py (every row and cell, must PASS)
          → dump file → local dev / staging / production → verify again
```

- **Part A** (once per export, about 15 minutes, all local) ends with a verified dump file.
- **Part B** (once per database) loads that dump into a database created by `npm run migration:run` and verifies it against the source.
- The production cutover wraps Part B in the steps of [backend/docs/prod-cutover-runbook.md](backend/docs/prod-cutover-runbook.md).

The scripts and the data live in `backend/src/database/seeds/relational/production-data/`. The scripts are in git. The data (the export and everything generated from it) is never committed; get the export zip from a teammate and put it in `mysql-legacy/`.

The export of 2026-09-23 has 2,211,463 rows in 21 tables (51,339 orders, 28,241 customers, 1,171,181 order line items).

### Local containers

| Container | Port | Database | Used for |
|-----------|------|----------|----------|
| `backend-postgres-1` | 5432 | `oms_nest` (dev), `oms_build` (clean build) | The app and the data procedure |
| `oms_mysql_legacy` | 3307 | `oms_legacy` | The loaded export, source of every comparison |

```bash
docker exec -it backend-postgres-1 psql -U oms -d oms_nest
docker exec -it oms_mysql_legacy mysql --default-character-set=utf8mb4 -u oms_user -poms_password oms_legacy
```

The app runs on a database created by the migrations. A third container on port 5433 (`oms_postgres_legacy`) may exist from older instructions; the migrations cannot run on it, so do not point `backend/.env` at it.

## Development Commands

### Backend (NestJS)

```bash
cd backend

# Development (choose one based on your environment)
npm run start:dev              # Default .env
npm run start:dev:local        # .env.local (local overrides)
npm run start:dev:staging      # .env.staging (staging database)
npm run build                  # Build for production
npm run start:prod             # Run production build

# Testing
npm run test               # Unit tests
npm run test:watch         # Watch mode
npm run test:cov           # Coverage report
npm run test:e2e           # E2E tests

# Database
npm run migration:generate -- src/database/migrations/MigrationName
npm run migration:run                # Apply migrations (uses .env)
npm run migration:staging:run        # Apply migrations (uses .env.staging)
npm run migration:revert             # Rollback last migration
npm run migration:staging:revert     # Rollback on staging
npm run seed:run:relational          # Run seeds

# Code Quality
npm run lint               # ESLint
npm run format             # Prettier
```

### Frontend (Next.js)

```bash
cd frontend

# Development
npm run dev                # Start dev server (port 3001)
npm run build              # Production build
npm run start              # Run production build

# Testing & Quality
npm run test               # Component tests
npm run lint               # ESLint
npm run type-check         # TypeScript check
```

### E2E Testing

```bash
cd e2e
npx playwright test        # Run all E2E tests
npx playwright test --ui   # Interactive mode
```

---

## Project Structure

```
oms_nest/
├── backend/                    # NestJS API
│   ├── src/
│   │   ├── auth/              # Authentication (JWT, guards)
│   │   ├── users/             # User management
│   │   ├── orders/            # Order processing
│   │   ├── customers/         # Customer management
│   │   ├── fitters/           # Fitter management
│   │   ├── factories/         # Factory management (was suppliers)
│   │   ├── brands/            # Brand catalog
│   │   ├── products/          # Saddle products
│   │   ├── options/           # Product options
│   │   ├── enriched-orders/   # Materialized views
│   │   └── database/          # TypeORM, migrations, seeds
│   └── test/                  # Test utilities
│
├── frontend/                   # Next.js 15 application
│   ├── app/                   # App router pages
│   ├── components/            # React components
│   ├── services/              # API clients
│   └── types/                 # TypeScript definitions
│
├── e2e/                        # Playwright E2E tests
│
├── docs/                       # Project documentation
│   └── specs/                 # Technical specifications
│
└── kubernetes/                 # K8s deployment configs
```

---

## API Documentation

Swagger documentation is available at `/docs` when the backend is running.

### Authentication

The API uses JWT authentication with support for both username and email login:

```bash
# Login with username
curl -X POST http://localhost:3000/api/v1/auth/email/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin", "password": "secret"}'

# Login with email
curl -X POST http://localhost:3000/api/v1/auth/email/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "secret"}'
```

### Protected Endpoints

Include the JWT token in requests:

```bash
curl http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Implementation Status

### Backend: 95% Complete

| Module | Status | Notes |
|--------|--------|-------|
| Authentication | Done | JWT, guards, RLS |
| Users | Done | Role-based access |
| Orders | Done | Full CRUD, search |
| Customers | Done | With fitter relationships |
| Fitters | Done | Commission structures |
| Factories | Done | Regional assignments |
| Brands | Done | Product catalog |
| Products (Saddles) | Done | Master entity |
| Options | Done | 7-tier pricing |
| Enriched Orders | Done | Materialized views, caching |

### Remaining Tasks

- Frontend integration with backend APIs
- Production data migration execution
- Performance testing at scale
- Final E2E testing

---

## Troubleshooting

### Database Container Issues

```bash
# Check if ports are in use
lsof -i :5432  # PostgreSQL (backend-postgres-1)
lsof -i :3307  # MySQL (oms_mysql_legacy)

# Container logs
docker logs backend-postgres-1
docker logs oms_mysql_legacy
```

### Migration Script Permissions

```bash
# Make scripts executable
chmod +x backend/src/database/seeds/relational/production-data/postgres/scripts/*.sh
chmod +x backend/src/database/seeds/relational/production-data/mysql-legacy/scripts/*.sh
```

### Validation Failures

```bash
# Compare a database with the loaded export, every row and cell
cd backend/src/database/seeds/relational/production-data/postgres/scripts
python3 verify-against-mysql.py --pg-container backend-postgres-1 --pg-user oms --pg-database oms_build
```

If it reports `FAIL`, read the sample rows it prints and see [docs/production-data-migration.md](docs/production-data-migration.md). A dev database with seed users always shows those extra rows; add `--allow-extra` for it.

---

## Contributing

1. Create a feature branch from `main`
2. Make changes following existing patterns
3. Ensure tests pass: `npm run test`
4. Ensure linting passes: `npm run lint`
5. Create a pull request

---

## License

Proprietary - All rights reserved.
