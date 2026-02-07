# Production Data Migration — Quick Start

## Overview

This guide covers how to import ~3 million records from the legacy MySQL production database (`ordermys_new.sql`) into a local or staging PostgreSQL database. The migration preserves legacy integer primary keys and uses shell scripts for transformation, import, and validation.

For the full technical reference, see [Production Data Migration](./production-data-migration.md).

## Prerequisites

- Docker installed and running
- Access to `ordermys_new.sql` production dump file (place in `mysql-legacy/data/`)
- Node.js 20+ with npm (for running TypeORM migrations)

## Scripts Location

All scripts are in:
```
backend/src/database/seeds/relational/production-data/postgres/scripts/
```

## Quick Start (Legacy Container)

The fastest path to a working legacy database:

```bash
cd backend/src/database/seeds/relational/production-data/postgres/scripts

# 1. Start a PostgreSQL 15 container (port 5433)
./setup-postgres.sh

# 2. Transform MySQL data to PostgreSQL format (first time only)
./transform-mysql-to-postgres.sh

# 3. Import schema and data
./import-data.sh

# 4. Validate the import
./validate-data.sh

# 5. Extract seat sizes into orders.seat_sizes JSONB column
./extract-seat-sizes.sh --apply
```

Connection details after setup:
```
Host: 127.0.0.1  Port: 5433  Database: oms_legacy
User: oms_user   Password: oms_password
Container: oms_postgres_legacy
```

## Quick Start (Local Dev Database)

Import production data into the backend's Docker Compose PostgreSQL (port 5432):

```bash
cd backend/src/database/seeds/relational/production-data/postgres/scripts

# Import into backend-postgres-1
./import-data.sh --env local

# Validate
./validate-data.sh --env local

# Extract seat sizes
./extract-seat-sizes.sh --apply
```

## Full Sync (New MySQL Dump)

When you receive a new production dump, run the full pipeline:

```bash
cd backend/src/database/seeds/relational/production-data/postgres/scripts

./sync-production-data.sh --from-dump /path/to/ordermys_new.sql
```

This runs: transform → import → extract seat sizes in one command.

## Connect NestJS to Legacy Data

Update `backend/.env`:
```env
DATABASE_TYPE=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5433
DATABASE_USERNAME=oms_user
DATABASE_PASSWORD=oms_password
DATABASE_NAME=oms_legacy
```

Then run TypeORM migrations (creates enriched views, indexes, etc.):
```bash
cd backend
npm run migration:run
```

## Data Summary

| Category | Tables | Key Counts |
|----------|--------|------------|
| Core Business | orders, customers, fitters, factories, factory_employees | 48,142 orders · 27,279 customers · 282 fitters · 7 factories |
| Product Catalog | brands, saddles, leather_types, options, options_items, presets, presets_items | 3 brands · 109 saddles · 85 leather types · 52 options · 887 option items |
| Relationships | orders_info, saddle_leathers, saddle_options_items | 1,099,961 order line items |
| System Admin | credentials, user_types, statuses, role, client_confirmation | 360 users · 6 roles · 16 statuses |
| Audit Logging | log, dblog | Partial import |

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `setup-postgres.sh` | Start/reset PostgreSQL 15 Docker container (port 5433) |
| `transform-mysql-to-postgres.sh` | Transform MySQL INSERTs to PostgreSQL format (run once per dump) |
| `transform-orders-booleans.py` | Convert integer booleans (0/1) to PostgreSQL booleans in orders.sql |
| `import-data.sh` | Import schema + data (`--env local` or `--env legacy`, `--schema` or `--data`) |
| `validate-data.sh` | Check record counts and referential integrity (`--env local` or `--env legacy`) |
| `extract-seat-sizes.sh` | Extract seat sizes from orders_info + special_notes (`--env local/legacy/staging/production`, `--apply`) |
| `sync-production-data.sh` | Full sync orchestration (`--from-dump FILE`, `--incremental`, `--extract-seats`) |
| `docker-compose.yml` | Standalone Docker Compose for legacy PostgreSQL container |

## Validation

The `validate-data.sh` script checks:

- **Record counts** — All 20 tables against expected values
- **Referential integrity** — 7 relationship checks (orders→fitters, orders→customers, customers→fitters, factory_employees→factories, orders_info→orders, saddle_leathers→saddles, saddle_options_items→saddles)
- **Sample data** — Displays brands, factories, statuses, recent orders, order status distribution

## Known Legacy Data Issues

These are expected from years of production use and are preserved:

| Issue | Count | Details |
|-------|-------|---------|
| Orders → Missing Fitters | 16 | Reference 4 deleted fitters (IDs: 29, 46, 76, 89) |
| Customers → Missing Fitters | 3 | Same deleted fitter references |
| OrdersInfo → Missing Orders | ~49,794 | ~3,504 orders were hard-deleted but line items remain |

The NestJS application handles missing references gracefully. The validation script reports these as expected warnings.

## Troubleshooting

**Port 5433 already in use:**
```bash
lsof -i :5433
# Remove existing container and restart
docker rm -f oms_postgres_legacy && ./setup-postgres.sh
```

**Container not running:**
```bash
docker logs oms_postgres_legacy
# For local dev:
cd backend && docker-compose up -d postgres
```

**Scripts not executable:**
```bash
chmod +x postgres/scripts/*.sh
```

**Import fails on large files (orders_info — 1.1M rows):**
The import can take several minutes for the `orders_info` and `audit-logging` tables. This is normal.

**Reset and reimport:**
```bash
./setup-postgres.sh --clean   # Removes container + volume, starts fresh
./import-data.sh              # Reimport everything
```

## Related Documentation

- [Production Data Migration](./production-data-migration.md) — Full technical reference (schema, migrations, directory structure)
- [Getting Started](./getting-started.md) — Project setup guide
- [Staging Deployment](./staging-deployment.md) — Staging environment guide
