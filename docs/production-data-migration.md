# Production Data Migration

## Overview

This document describes how production data from the legacy MySQL database (`ordermys_new.sql`) is migrated into PostgreSQL for development and staging. The data is available in both the original MySQL format and a transformed PostgreSQL format.

All migration tooling lives in:
```
backend/src/database/seeds/relational/production-data/
```

See also the in-repo [README.md](../backend/src/database/seeds/relational/production-data/README.md) and [CLAUDE.md](../backend/src/database/seeds/relational/production-data/CLAUDE.md) for quick-reference details.

## Source Database

- **Origin**: MySQL/MariaDB production database (`ordermys_new.sql`, ~355 MB)
- **Records**: ~3 million rows across 21 tables
- **Date range**: Production data dating back to 2012
- **Character set**: utf8mb4

## Migration Architecture

### ID Strategy

Legacy tables use `SERIAL` (auto-increment integer) primary keys, matching the original MySQL schema. The NestJS backend's enriched-order views and raw SQL queries join directly on these integer IDs. Only the NestJS `User` entity introduces a dual ID system (`id` UUID + `legacyId` integer); all other legacy tables keep their original integer keys.

### Pipeline

```
MySQL dump → transform-mysql-to-postgres.sh → PostgreSQL SQL files → import-data.sh → validate-data.sh
```

### Naming Transformations

| MySQL | PostgreSQL |
|-------|-----------|
| `PascalCase` table names (`Orders`) | `snake_case` (`orders`) |
| `PascalCase` columns (`CustomerID`) | `snake_case` (`customer_id`) |
| Backtick quoting | Double-quote quoting |
| `AUTO_INCREMENT` | `SERIAL` |
| `SET FOREIGN_KEY_CHECKS = 0` | `SET session_replication_role = 'replica'` |
| `\'` (escaped quote) | `''` (doubled quote) |

<details>
<summary>Full column mapping reference</summary>

| MySQL Column | PostgreSQL Column |
|--------------|-------------------|
| ID | id |
| FitterID | fitter_id |
| CustomerID | customer_id |
| FactoryID | factory_id |
| SaddleID | saddle_id |
| LeatherID | leather_id |
| UserID | user_id |
| OptionID | option_id |
| OrderID | order_id |
| HorseName | horse_name |
| OrderStatus | order_status |
| OrderTime | order_time |
| PriceSaddle | price_saddle |
| PriceContrast1 | price_contrast1 |
| SpecialNotes | special_notes |
| SerialNumber | serial_number |
| BrandName | brand_name |
| ModelName | model_name |
| PhoneNo | phone_no |
| CellNo | cell_no |
| Emailaddress | emailaddress |
| FullName | full_name |
| UserName | user_name |
| PasswordHash | password_hash |
| LastLogin | last_login |
| UserType | user_type |
| TypeDescription | type_description |

</details>

## Database Schema

### Tables by Category

Schema files are in `postgres/schema/` and applied in numbered order:

#### 01 — System Admin (`01-system-admin.sql`)

| Table | Description |
|-------|-------------|
| `user_types` | Legacy role definitions (4 types) |
| `role` | NestJS role table (6 roles, aligned with `RoleEnum`) |
| `statuses` | Order status definitions (16 statuses) |
| `credentials` | Legacy user authentication (360 users) |
| `client_confirmation` | Customer order confirmations (23,488 records) |

#### 02 — Product Catalog (`02-product-catalog.sql`)

| Table | Description |
|-------|-------------|
| `brands` | Saddle manufacturers — Custom, Icon, Wolfgang (3 brands) |
| `leather_types` | Material options (85 types) |
| `options` | Product configuration categories with 7-tier pricing (52 options) |
| `options_items` | Specific choices within option categories (887 items) |
| `presets` | Saved product configurations (44 presets) |
| `presets_items` | Links between presets and option items (1,471 items) |
| `saddles` | Master product entity with factory assignments (109 saddles) |

#### 03 — Core Business (`03-core-business.sql`)

| Table | Description |
|-------|-------------|
| `factories` | Manufacturing facilities by region (7 factories) |
| `factory_employees` | Factory staff (2 employees) |
| `fitters` | Professional saddle fitters (282 fitters) |
| `customers` | Customer information (27,279 customers) |
| `orders` | Central order management (48,142 orders) |

#### 04 — Relationships (`04-relationships.sql`)

| Table | Description |
|-------|-------------|
| `saddle_leathers` | Saddle-leather combinations with pricing (4,274 records) |
| `saddle_options_items` | Product-option relationships (21,844 records) |
| `orders_info` | Order line items / option selections (1,099,961 records) |

#### 05 — Audit Logging (`05-audit-logging.sql`)

| Table | Description |
|-------|-------------|
| `log` | Application audit trail (~764,000 in production; partial import) |
| `dblog` | Database query logging (~75,000 in production; partial import) |

## Entity-to-NestJS Module Mapping

| PostgreSQL Table | NestJS Module | Notes |
|------------------|---------------|-------|
| `orders` | `OrderModule` | |
| `customers` | `CustomerModule` | |
| `fitters` | `FitterModule` | |
| `factories` | `FactoryModule` | Also referenced as "Suppliers" in some UI contexts |
| `factory_employees` | `FactoryEmployeeModule` | |
| `credentials` | `UsersModule` | Mapped to NestJS User entity |
| `brands` | `BrandsModule` | |
| `saddles` | `SaddlesModule` | Queried via `saddle-stock` service |
| `leather_types` | `LeathertypesModule` | |
| `options` | `OptionsModule` | |
| `options_items` | `OptionsItemsModule` | |
| `presets` | `PresetsModule` | |
| `orders_info` | `OrderLinesModule` | 1.1M order line items |
| `saddle_leathers` | `SaddleLeathersModule` | |
| `saddle_options_items` | `SaddleOptionsItemsModule` | |
| `statuses` | `StatusesModule` | |

## TypeORM Migrations

Migrations in `backend/src/database/migrations/` are applied with `npm run migration:run`:

| Migration | Purpose |
|-----------|---------|
| `1736700000000-InitialSchema` | Creates all 21 legacy tables with integer PKs and indexes |
| `1736800000000-AddRLSPrerequisites` | Row Level Security prerequisites |
| `1736900000000-EnableRowLevelSecurity` | Enable RLS policies for data isolation |
| `1737000000000-CreateEnrichedOrderViews` | Materialized views (`enriched_order_view`, `order_edit_view`) |
| `1737100000000-CreateCommentTable` | Comment table |
| `1737200000000-AddAdvancedOrderSearchIndexes` | Full-text and composite search indexes |
| `1737900000000-AddLegacyBooleanFieldsToOrders` | Boolean fields (fitter_stock, custom_order, repair, demo, sponsored, rushed) |
| `1738000000000-CreateRoleTable` | Role table aligned with `RoleEnum` (idempotent with `ON CONFLICT DO UPDATE`) |
| `1738100000000-AddSeatSizesColumn` | `seat_sizes` JSONB column + GIN index + extraction functions |
| `1738200000000-AddUserTypeToUserView` | User type in user view |
| `1738300000000-CreateWarehouseTable` | Warehouse table |
| `1769891167734-CreateExtrasTable` | Extras entity (UUID primary key) |
| `1769900000000-CreateAuditLogTable` | NestJS audit log table |
| `1770000000000-AddEntityFieldsToAuditLog` | Entity tracking fields for audit log |
| `1770000000000-CreateSaddleExtrasTable` | Saddle-extras relationship table |
| `1770100000000-IncreasePasswordHashLength` | Increase password hash column length |
| `1770200000000-PopulateUserEmailFromUsername` | Populate user email from legacy username |

Helper file: `user-view-sql.ts` — Shared SQL for user view creation (used by multiple migrations).

## PostgreSQL Scripts

All scripts are in `postgres/scripts/` and support multiple environments.

### setup-postgres.sh

Starts a Docker PostgreSQL 15 container for legacy data.

```bash
./setup-postgres.sh           # Start PostgreSQL (port 5433)
./setup-postgres.sh --clean   # Remove container and start fresh
```

Connection details:
```
Host: 127.0.0.1 | Port: 5433 | Database: oms_legacy
User: oms_user | Password: oms_password
Container: oms_postgres_legacy
```

### transform-mysql-to-postgres.sh

Transforms MySQL INSERT statements from `mysql-legacy/data/` into PostgreSQL format in `postgres/data/`. Run once after obtaining a new MySQL dump.

```bash
./transform-mysql-to-postgres.sh
```

### transform-orders-booleans.py

Python script that converts integer boolean columns (0/1) in `orders.sql` to PostgreSQL `boolean` values (false/true). Handles columns at specific positions: `fitter_stock`, `custom_order`, `repair`, `demo`, `sponsored`, `rushed`.

```bash
python3 transform-orders-booleans.py
```

### import-data.sh

Imports schema and data into PostgreSQL. Supports importing schema only, data only, or both.

```bash
./import-data.sh                    # Import all (legacy env, default)
./import-data.sh --env local        # Import to local dev (backend-postgres-1)
./import-data.sh --env legacy       # Import to legacy container
./import-data.sh --schema           # Schema only
./import-data.sh --data             # Data only (assumes schema exists)
```

Environments:
- **local** — Docker `backend-postgres-1`, port 5432, database `oms_nest`
- **legacy** — Docker `oms_postgres_legacy`, port 5433, database `oms_legacy`

### validate-data.sh

Validates imported data: record counts, referential integrity, and sample data verification.

```bash
./validate-data.sh                  # Validate legacy container (default)
./validate-data.sh --env local      # Validate local dev
./validate-data.sh --env legacy     # Validate legacy container
```

**Checks performed:**
- Record counts against expected values (20 tables)
- Referential integrity (FactoryEmployees→Factories, Orders→Fitters, Orders→Customers, Customers→Fitters, OrdersInfo→Orders, SaddleLeathers→Saddles, SaddleOptionsItems→Saddles)
- Sample data display (brands, factories, statuses, orders, order status distribution)

### extract-seat-sizes.sh

Extracts seat size information and populates the `orders.seat_sizes` JSONB column from two sources:

1. **PRIMARY**: `orders_info` table (option_id=1 is "Seat Size") — ~50,000 orders
2. **FALLBACK**: `special_notes` field (regex extraction) — ~24 additional orders

```bash
./extract-seat-sizes.sh                          # Preview (local dev)
./extract-seat-sizes.sh --apply                  # Apply (local dev)
./extract-seat-sizes.sh --env legacy             # Preview (legacy container)
./extract-seat-sizes.sh --env legacy --apply     # Apply (legacy container)
./extract-seat-sizes.sh --env staging            # Preview (staging, requires PG_PASSWORD)
./extract-seat-sizes.sh --env staging --apply    # Apply (staging)
./extract-seat-sizes.sh --env production         # Preview (production, requires PG_PASSWORD)
./extract-seat-sizes.sh --env production --apply # Apply (production, confirmation prompt)
```

Environments: `local`, `legacy`, `staging`, `production`. Override connection details with `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`.

**Patterns recognized:**

| Pattern | Example | Extracted |
|---------|---------|-----------|
| `seat size X.X` | "seat size 17.5" | `["17,5"]` |
| `X.X seat` | "17.5 seat" | `["17,5"]` |
| `X.X"` or `X.X inch` | `17.5"` | `["17,5"]` |
| `stamped X.X` | "stamped in 17.5" | `["17,5"]` |

Seat sizes are stored in European notation (comma decimal): `["17", "17,5"]`.

### sync-production-data.sh

Orchestrates the full sync workflow: schema + data import + seat size extraction.

```bash
./sync-production-data.sh                         # Full sync (legacy env)
./sync-production-data.sh --env local             # Full sync (local dev)
./sync-production-data.sh --incremental           # Sync only new/updated records
./sync-production-data.sh --extract-seats         # Extract seat sizes only
./sync-production-data.sh --from-dump FILE        # Import from a new MySQL dump
```

### docker-compose.yml

Standalone Docker Compose file for the legacy PostgreSQL container (PostgreSQL 15, port 5433, tuned with `max_connections=200`, `shared_buffers=256MB`, `work_mem=16MB`).

## MySQL Legacy Format

The original MySQL data is preserved in `mysql-legacy/` for reference and as the source for PostgreSQL transformation.

### MySQL Scripts (`mysql-legacy/scripts/`)

| Script | Purpose |
|--------|---------|
| `setup-mysql.sh` | Start MySQL 8.0 Docker container (port 3307) |
| `import-data.sh` | Import schema and all data files |
| `validate-data.sh` | Validate record counts and referential integrity |
| `fix-referential-integrity.sql` | SQL fixes for known data issues |

### MySQL Connection

```
Host: 127.0.0.1 | Port: 3307 | Database: oms_legacy
User: oms_user | Password: oms_password
Container: oms_mysql_legacy
```

```bash
docker exec -it oms_mysql_legacy mysql -u oms_user -poms_password oms_legacy
```

### MySQL Quick Start

```bash
cd backend/src/database/seeds/relational/production-data/mysql-legacy/scripts
./setup-mysql.sh       # Start MySQL 8.0 container
./import-data.sh       # Import all data
./validate-data.sh     # Verify import
```

## Workflows

### Initial Setup (PostgreSQL Legacy Container)

```bash
cd backend/src/database/seeds/relational/production-data/postgres/scripts

# 1. Start legacy PostgreSQL container
./setup-postgres.sh

# 2. Transform MySQL data (first time only)
./transform-mysql-to-postgres.sh

# 3. Import schema and data
./import-data.sh

# 4. Validate the import
./validate-data.sh

# 5. Extract seat sizes
./extract-seat-sizes.sh --apply
```

### Import Into Local Dev Database

```bash
cd backend/src/database/seeds/relational/production-data/postgres/scripts

# Import into backend-postgres-1 (the Docker Compose database)
./import-data.sh --env local

# Validate
./validate-data.sh --env local

# Extract seat sizes
./extract-seat-sizes.sh --apply
```

### Full Sync (After New MySQL Dump)

```bash
cd backend/src/database/seeds/relational/production-data/postgres/scripts

# One command does: transform → import → extract seat sizes
./sync-production-data.sh --from-dump /path/to/ordermys_new.sql
```

### Connect NestJS to Legacy Database

Update `backend/.env`:
```env
DATABASE_TYPE=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5433
DATABASE_USERNAME=oms_user
DATABASE_PASSWORD=oms_password
DATABASE_NAME=oms_legacy
```

Then run TypeORM migrations:
```bash
cd backend && npm run migration:run
```

## Known Legacy Data Issues

### Fixed Issues

**FactoryEmployees Referential Integrity** — The original `FactoryID` values in the `FactoryEmployees` table referenced `Credentials.UserID` instead of `Factories.ID`. This was corrected in the data files:

```sql
-- adam: UserID 21 → Factory.ID 3 (EU factory)
-- gary: UserID 22 → Factory.ID 4 (GB factory)
INSERT INTO factory_employees (id, deleted, name, factory_id) VALUES
(1, 0, 'adam', 3),
(2, 0, 'gary', 4);
```

### Remaining Issues (Historical Data)

These are expected referential integrity issues from years of production use. They are preserved for data fidelity.

| Issue | Count | Details |
|-------|-------|---------|
| Orders → Missing Fitters | 16 | Reference fitter IDs 29 (4 orders), 46 (1), 76 (1), 89 (10) — deleted in production |
| Customers → Missing Fitters | 3 | Same deleted fitter references |
| OrdersInfo → Missing Orders | ~49,794 | ~3,504 orders were hard-deleted but their line items (order IDs in valid range 19–51646) remain |

The NestJS application handles missing references gracefully. The `validate-data.sh` script reports these as expected warnings.

## Role ID Alignment

Role IDs are aligned between the legacy `user_types` table and the NestJS `RoleEnum`:

| ID | Legacy (`user_types`) | NestJS (`RoleEnum`) | Description |
|----|----------------------|---------------------|-------------|
| 1 | fitter | `RoleEnum.fitter` | Saddle fitters (sales) |
| 2 | admin | `RoleEnum.admin` | System administrators |
| 3 | factory | `RoleEnum.factory` | Factory users |
| 4 | customsaddler | `RoleEnum.customsaddler` | Custom saddle makers |
| 5 | — | `RoleEnum.supervisor` | Supervisors (NestJS-only) |
| 6 | — | `RoleEnum.user` | Standard users (NestJS-only) |

The `role` table in `postgres/data/system-admin/roles.sql` contains all 6 roles. The migration `1738000000000-CreateRoleTable` is idempotent (`ON CONFLICT DO UPDATE`), so it's safe to run on databases that already have the role table.

## Seat Size Distribution

| Size | Count | Percentage |
|------|-------|------------|
| 17.5" | ~28,000 | 58% |
| 17" | ~9,000 | 19% |
| 18" | ~8,000 | 17% |
| Other | ~3,000 | 6% |

API filtering supports both dot and comma notation:
```
GET /api/v1/enriched_orders?seatSizes=17
GET /api/v1/enriched_orders?seatSize=17.5
```

## Technical Notes

- **Timestamps**: Stored as Unix timestamps (10-digit integers, e.g. `order_time`)
- **Soft deletes**: Many tables use a `deleted` column (`0` = active, `1` = deleted)
- **Pricing**: Multi-tier pricing structure (`price1`–`price7`) for different regions/markets
- **Boolean fields**: Orders table has boolean columns (`fitter_stock`, `custom_order`, `repair`, `demo`, `sponsored`, `rushed`) converted from MySQL integers via `transform-orders-booleans.py`
- **Sequences**: PostgreSQL sequences auto-reset after data import
- **Seat sizes**: JSONB column in orders table, European decimal notation (`["17,5"]`), populated via `extract-seat-sizes.sh`
- **Character encoding**: UTF-8 (utf8mb4 for MySQL, UTF8 for PostgreSQL)

## Directory Structure

```
backend/src/database/
├── migrations/                              # TypeORM migrations (17 numbered + 1 helper)
│   ├── 1736700000000-InitialSchema.ts       # All 21 legacy tables
│   ├── ...
│   ├── 1770200000000-PopulateUserEmailFromUsername.ts
│   └── user-view-sql.ts                     # Shared SQL helper
└── seeds/relational/production-data/
    ├── README.md                            # In-repo quick reference
    ├── CLAUDE.md                            # AI assistant context
    ├── mysql-legacy/                        # Original MySQL data (source)
    │   ├── ordermys_new.sql                 # Raw production dump (~355 MB)
    │   ├── schema/                          # MySQL CREATE TABLE statements
    │   ├── data/                            # MySQL INSERT statements
    │   │   ├── core-business/
    │   │   ├── product-catalog/
    │   │   ├── system-admin/
    │   │   ├── relationships/
    │   │   └── audit-logging/
    │   ├── scripts/                         # MySQL setup, import, validate
    │   │   ├── docker-compose.yml
    │   │   ├── setup-mysql.sh
    │   │   ├── import-data.sh
    │   │   ├── validate-data.sh
    │   │   └── fix-referential-integrity.sql
    │   ├── documentation/                   # Analysis reports
    │   └── comprehensive-data-analysis-report.md
    └── postgres/                            # Transformed PostgreSQL data
        ├── schema/                          # PostgreSQL CREATE TABLE statements
        │   ├── 01-system-admin.sql
        │   ├── 02-product-catalog.sql
        │   ├── 03-core-business.sql
        │   ├── 04-relationships.sql
        │   └── 05-audit-logging.sql
        ├── data/                            # PostgreSQL INSERT statements
        │   ├── system-admin/               # credentials, user-types, statuses, roles
        │   ├── product-catalog/            # brands, saddles, leather-types, options, presets
        │   ├── core-business/              # orders, customers, fitters, factories
        │   ├── relationships/              # orders-info (1.1M), saddle-leathers, saddle-options-items
        │   └── audit-logging/              # log, dblog (partial import)
        └── scripts/
            ├── docker-compose.yml           # Legacy PostgreSQL 15 container
            ├── setup-postgres.sh            # Start/reset PostgreSQL container
            ├── transform-mysql-to-postgres.sh # MySQL → PostgreSQL SQL transformation
            ├── transform-orders-booleans.py # Integer → boolean conversion for orders
            ├── import-data.sh               # Import schema + data (multi-env)
            ├── validate-data.sh             # Record counts + referential integrity checks
            ├── extract-seat-sizes.sh        # Seat size extraction (multi-env)
            └── sync-production-data.sh      # Full sync orchestration
```

## Maintenance

### Updating Data from a New Production Dump

1. Place new `ordermys_new.sql` in `mysql-legacy/`
2. Run transformation: `cd postgres/scripts && ./transform-mysql-to-postgres.sh`
3. Run boolean conversion: `python3 transform-orders-booleans.py`
4. Import: `./import-data.sh`
5. Validate: `./validate-data.sh`
6. Extract seat sizes: `./extract-seat-sizes.sh --apply`

Or use the single-command workflow:
```bash
./sync-production-data.sh --from-dump /path/to/ordermys_new.sql
```

### Adding New Tables

1. Add MySQL schema to `mysql-legacy/schema/`
2. Add MySQL data to the appropriate `mysql-legacy/data/` subdirectory
3. Update `transform-mysql-to-postgres.sh` with new table/column mappings
4. Add PostgreSQL schema to the appropriate `postgres/schema/` file
5. Update import scripts with new file references
6. Update `validate-data.sh` expected counts
