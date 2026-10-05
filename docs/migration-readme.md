# Production Data Migration — Quick Start

This page is the short version. **The procedure itself is [Production Data Migration](./production-data-migration.md)**; when the two differ, that document is right.

## Which document do I use?

| I want to… | Use |
|---|---|
| Process a new production export | [Production Data Migration](./production-data-migration.md), Part A, then Part B for each database |
| Give my local dev database production data | The same document, Part B with the dump from Part A |
| Refresh staging | Part B, wrapped in the scale-down and scale-up steps of the [cutover runbook](../backend/docs/prod-cutover-runbook.md) |
| Cut production over | The [cutover runbook](../backend/docs/prod-cutover-runbook.md), which calls Part A and Part B |
| Understand the data (volumes, relationships) | `production-data/mysql-legacy/documentation/` in the pipeline folder |

The pipeline folder is `backend/src/database/seeds/relational/production-data/`. Its scripts are in git; the data in it (export, generated files) never is. Its `README.md` describes the layout.

## The path

```text
export zip → MySQL container → per-table files → PostgreSQL files → build database
          → GATE (verify-against-mysql.py: every row and cell, must PASS)
          → dump file → each target → GATE again → data migrations → view refresh
```

There is one path. The 5433 container (`oms_postgres_legacy`), `sync-production-data.sh --from-dump` and `backend/scripts/import-mysql-data.ts` are not part of it.

## Part A in short (once per export, about 15 minutes)

```bash
PD=backend/src/database/seeds/relational/production-data

cd $PD/mysql-legacy/scripts
./setup-mysql.sh --clean
unzip -p ../ordermysaddle-DD-MM-YYYY.sql.zip | docker exec -i oms_mysql_legacy \
  mysql --max_allowed_packet=512M --default-character-set=utf8mb4 -u oms_user -poms_password oms_legacy
docker exec oms_mysql_legacy mysql -u oms_user -poms_password oms_legacy -e \
  "UPDATE FactoryEmployees fe JOIN Factories f ON f.UserID = fe.FactoryID SET fe.FactoryID = f.ID"
./export-table-files.sh

cd ../../postgres/scripts
./transform-mysql-to-postgres.sh
# create the build database oms_build and run the migrations on it: see A6 of the procedure
PG_USER=oms PG_DATABASE=oms_build ./import-data.sh --env local --data
python3 verify-against-mysql.py --pg-container backend-postgres-1 --pg-user oms --pg-database oms_build   # must say PASS
PG_USER=oms PG_DATABASE=oms_build ./extract-seat-sizes.sh --env local --apply
./dump-legacy-data.sh
```

## Part B in short (once per database)

Empty the database, run the migrations, then:

```bash
./load-legacy-dump.sh ~/db-backups/oms-legacy-data-<time>.sql.gz "<connection string>"
python3 verify-against-mysql.py --pg-dsn "<connection string>"                                 # must say PASS
```

Then re-run the three data migrations and refresh the two materialized views (steps B7 and B8 of the procedure).

## Mistakes that have happened

| Mistake | What it does |
|---|---|
| Loading the export without `--default-character-set=utf8mb4` | Aborts with `ERROR 1406 Data too long for column 'PhoneNo'`, 4 of 21 tables loaded |
| `DATABASE_NAME=… npm run migration:run` | Runs against the database in `backend/.env` anyway; use `npx env-cmd -f <env file> …` |
| Running the migrations on the 5433 container | Fails: `relation "user_types" already exists` |
| Dumping from a dev database that has seed users | Seed rows end up in staging or production |
| Trusting row counts | Counts were right on 2026-09-28 while 12 `dblog` rows held a wrong character |

## Current data

Export of 2026-09-23: 2,211,463 rows in 21 tables (51,339 orders · 28,241 customers · 1,171,181 order line items · 821,198 log rows). The full table is in the [procedure](./production-data-migration.md#row-counts).

## Related Documentation

- [Production Data Migration](./production-data-migration.md) — the procedure and the reference
- [Production Cutover Runbook](../backend/docs/prod-cutover-runbook.md) — the Kubernetes and DigitalOcean steps around it
- [Getting Started](./getting-started.md) — project setup
- [Staging Deployment](./staging-deployment.md) — staging environment
