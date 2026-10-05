# Production Data - Order Management System

This folder holds the production export of the legacy OMS database and the scripts that turn it into PostgreSQL data.

**The scripts are in git. The data never is.** `.gitignore` ignores everything in this folder except the files it lists: this README, `CLAUDE.md`, the scripts in `mysql-legacy/scripts/` and `postgres/scripts/`, and `postgres/schema/`. The export zip, `mysql-legacy/data/`, `mysql-legacy/schema/`, `postgres/data/` and `mysql-legacy/documentation/` (which quotes customer rows) stay local. Never use `git add -f` here.

**The procedure for a new export is not here.** It lives in the tracked document [`docs/production-data-migration.md`](../../../../../../docs/production-data-migration.md): Part A (export → verified dump), Part B (load a database), Part C (record the result). Follow that document; do not work from memory or from this file.

**Current export**: `mysql-legacy/ordermysaddle-23-09-2026.sql.zip` (2026-09-23, 371 MB unzipped, 2,211,463 rows in 21 tables). The row counts per table are in the procedure document.

---

## The path, in one picture

```text
export zip
  → MySQL container oms_mysql_legacy          setup-mysql.sh --clean, load with --default-character-set=utf8mb4
  → mysql-legacy/data/*.sql                   export-table-files.sh   (after the FactoryEmployees fix)
  → postgres/data/*.sql                       transform-mysql-to-postgres.sh
  → build database oms_build                  migrations, then import-data.sh --env local --data
  → GATE: verify-against-mysql.py             every row and cell against MySQL, must say PASS
  → ~/db-backups/oms-legacy-data-*.sql.gz     extract-seat-sizes.sh, then dump-legacy-data.sh
  → each target (dev, staging, production)    load-legacy-dump.sh, then the GATE again
```

---

## Directory Structure

```text
production-data/
├── README.md                     ← You are here
├── CLAUDE.md                     ← Short version for AI assistants
│
├── mysql-legacy/                 ← Original MySQL data (source)
│   ├── ordermysaddle-23-09-2026.sql.zip   ← The export
│   ├── schema/                   ← MySQL CREATE TABLE statements (generated)
│   ├── data/                     ← One INSERT per row, per table (generated)
│   │   ├── core-business/        ← orders, customers, fitters, factories, factory-employees
│   │   ├── product-catalog/      ← brands, saddles, leather-types, options, options-items, presets, presets-items
│   │   ├── system-admin/         ← credentials, user-types, statuses, client-confirmation
│   │   ├── relationships/        ← orders-info, saddle-leathers, saddle-options-items
│   │   └── audit-logging/        ← log, dblog
│   ├── scripts/
│   │   ├── docker-compose.yml    ← MySQL 8.0 container
│   │   ├── setup-mysql.sh        ← Start / wipe the container
│   │   ├── export-table-files.sh ← Write data/ and schema/ from the loaded database
│   │   ├── import-data.sh        ← Load data/ back into MySQL; --fix re-applies the FactoryEmployees fix
│   │   ├── validate-data.sh      ← Counts and integrity on the MySQL side
│   │   └── fix-referential-integrity.sql
│   └── documentation/            ← Analysis of the data (volumes, relationships, validation reports); local only
│
└── postgres/
    ├── schema/                   ← Hand-written legacy-subset schema for the 5433 container only
    ├── data/                     ← PostgreSQL INSERT files (generated), same five folders
    │   └── system-admin/roles.sql   ← Hand-maintained, local only; if missing, the import skips it and the migration fills `role`
    └── scripts/
        ├── transform-mysql-to-postgres.sh ← Convert every table file
        ├── convert-mysql-to-pg.py         ← The converter
        ├── import-data.sh                 ← Load postgres/data into a database
        ├── verify-against-mysql.py        ← The gate
        ├── extract-seat-sizes.sh          ← Fill orders.seat_sizes
        ├── dump-legacy-data.sh            ← Dump the verified build database
        ├── load-legacy-dump.sh            ← Load that dump into a target
        ├── validate-data.sh               ← Counts and known integrity warnings
        ├── setup-postgres.sh, docker-compose.yml  ← The 5433 container (not part of the procedure)
        └── sync-production-data.sh, transform-orders-booleans.py  ← Obsolete, do not use
```

Leftovers that nothing uses: `mysql-legacy/ordermys_new.sql` (January 2026 dump), `postgres/data/core-business/orders.sql.backup` and `orders.sql.preboolean` (June 2026).

---

## Connection Details

### MySQL (the source)

| Parameter | Value |
|-----------|-------|
| Host | 127.0.0.1 |
| Port | **3307** |
| Database | oms_legacy |
| User | oms_user |
| Password | oms_password |
| Container | oms_mysql_legacy |

```bash
docker exec -it oms_mysql_legacy mysql --default-character-set=utf8mb4 -u oms_user -poms_password oms_legacy
```

Always pass `--default-character-set=utf8mb4`. The client inside the container defaults to latin1, which shows correct text as mojibake and corrupts anything you load.

### PostgreSQL build and dev databases

Both live in the backend's own container (`cd backend && docker compose up -d postgres`).

| Parameter | Value |
|-----------|-------|
| Host | 127.0.0.1 |
| Port | **5432** |
| Databases | `oms_build` (clean build, source of the dump) · `oms_nest` (your dev database) |
| User | oms (password in `backend/.env`) |
| Container | backend-postgres-1 |

```bash
docker exec -it backend-postgres-1 psql -U oms -d oms_build
```

### PostgreSQL 5433 container (not part of the procedure)

`oms_postgres_legacy`, database `oms_legacy`, user `oms_user` / `oms_password`. It holds the legacy tables with the hand-written schema from `postgres/schema/`. The NestJS migrations cannot run on it (`relation "user_types" already exists`), so the app cannot use it. Use it for ad-hoc SQL if you like; never as proof that an import is right.

---

## Known Data Issues

Kept exactly as they are in production (counts for the 2026-09-23 export):

| Issue | Count |
|-------|-------|
| Orders that point at a deleted fitter (ids 29, 46, 76, 89) | 16 |
| Customers that point at the same deleted fitters | 3 |
| `orders_info` rows of hard-deleted orders | 52,431 rows of 2,505 orders |

The only correction we make is `FactoryEmployees.FactoryID` (21/22 → 3/4), re-applied after every load. `fix-referential-integrity.sql` reports the fitter references but no longer changes them: until 2026-10-05 `import-data.sh --fix` set them to 0, which altered production data.

---

## Schema parity check (2026-09-28, historical)

On 2026-09-28 `pg_dump --schema-only` of the local dev database and of the staging database of that time (`oms-nest-staging` on the old cluster) were identical: 32 tables, 368 columns, 1 view, 2 materialized views, 83 indexes, 10 functions, 33 RLS policies, 27 sequences, 28 migrations. The migrations fully describe the schema. Staging moved to a new cluster on 2026-10-03; its data was compared cell by cell on 2026-10-05 (see the rehearsal record in the procedure document).

---

## Troubleshooting

```bash
# Port in use
lsof -i :3307   # MySQL
lsof -i :5432   # PostgreSQL

# Container logs
docker logs oms_mysql_legacy
docker logs backend-postgres-1

# Scripts not executable
chmod +x mysql-legacy/scripts/*.sh postgres/scripts/*.sh
```

- **`ERROR 1406 Data too long for column 'PhoneNo'` while loading the export**: the load ran without `--default-character-set=utf8mb4`. Run `setup-mysql.sh --clean` and load again with the flag.
- **The migrations ran against the wrong database**: `env-cmd` lets `backend/.env` win over variables set in the shell. Use `npx env-cmd -f <env file> typeorm-ts-node-commonjs ... migration:run` as the procedure shows.
- **`load-legacy-dump.sh` refuses**: the target has no schema yet (run the migrations) or already holds legacy rows (empty it first). This is deliberate.
- **`verify-against-mysql.py` says FAIL**: read the sample rows it prints. Do not continue; fix the cause and reload.
