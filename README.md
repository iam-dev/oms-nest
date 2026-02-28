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

### Migrate to Staging Database with Production Data

This project includes scripts to set up a staging database with production data for development and testing. The production data is organized in:

```
backend/src/database/seeds/relational/production-data/
```

For complete documentation, see the [Production Data README](backend/src/database/seeds/relational/production-data/README.md).

### Quick Migration Steps

#### Option 1: PostgreSQL (Recommended for NestJS)

```bash
# Navigate to PostgreSQL scripts
cd backend/src/database/seeds/relational/production-data/postgres/scripts

# 1. Start PostgreSQL 15 container (port 5433)
./setup-postgres.sh

# 2. Transform MySQL data to PostgreSQL format (first time only)
./transform-mysql-to-postgres.sh

# 3. Import all schema and data
./import-data.sh

# 4. Validate the import
./validate-data.sh
```

#### Option 2: MySQL Legacy (for comparison/testing)

```bash
# Navigate to MySQL scripts
cd backend/src/database/seeds/relational/production-data/mysql-legacy/scripts

# 1. Start MySQL 8.0 container (port 3307)
./setup-mysql.sh

# 2. Import all schema and data
./import-data.sh

# 3. Validate the import
./validate-data.sh
```

### Staging Database Connection Details

#### PostgreSQL (Primary)
| Parameter | Value |
|-----------|-------|
| Host | 127.0.0.1 |
| Port | **5433** |
| Database | oms_legacy |
| User | oms_user |
| Password | oms_password |

```bash
# Connect via Docker
docker exec -it oms_postgres_legacy psql -U oms_user -d oms_legacy

# Connect via psql client
psql -h 127.0.0.1 -p 5433 -U oms_user -d oms_legacy
```

#### MySQL Legacy (Optional)
| Parameter | Value |
|-----------|-------|
| Host | 127.0.0.1 |
| Port | **3307** |
| Database | oms_legacy |
| User | oms_user |
| Password | oms_password |

```bash
# Connect via Docker
docker exec -it oms_mysql_legacy mysql -u oms_user -poms_password oms_legacy

# Connect via mysql client
mysql -h 127.0.0.1 -P 3307 -u oms_user -poms_password oms_legacy
```

### Connect NestJS to Staging Database

Update your `backend/.env` to point to the staging database:

```env
DATABASE_TYPE=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5433
DATABASE_USERNAME=oms_user
DATABASE_PASSWORD=oms_password
DATABASE_NAME=oms_legacy
```

### Data Overview

The staging database contains ~3 million records across 21 tables:

| Category | Key Tables | Records |
|----------|------------|---------|
| Product Catalog | brands, saddles, options, leather_types | ~24,000 |
| Core Business | orders, customers, fitters, factories | ~76,000 |
| System Admin | credentials, statuses, user_types | ~24,000 |
| Relationships | orders_info, saddle_leathers | ~1,100,000 |
| Audit Logging | log, dblog | ~840,000 |

---

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
lsof -i :5433  # PostgreSQL
lsof -i :3307  # MySQL

# Remove and restart containers
docker rm -f oms_postgres_legacy
cd backend/src/database/seeds/relational/production-data/postgres/scripts
./setup-postgres.sh
```

### Migration Script Permissions

```bash
# Make scripts executable
chmod +x backend/src/database/seeds/relational/production-data/postgres/scripts/*.sh
chmod +x backend/src/database/seeds/relational/production-data/mysql-legacy/scripts/*.sh
```

### Validation Failures

```bash
# Run validation to see specific issues
./validate-data.sh

# Check specific table count
docker exec -it oms_postgres_legacy psql -U oms_user -d oms_legacy \
  -c "SELECT COUNT(*) FROM orders;"
```

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
