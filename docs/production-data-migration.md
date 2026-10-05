# Production Data Migration

**This is the one procedure we use when a new production export arrives.** Every other document that mentions importing production data points here. If another document disagrees with this one, this one is right.

It takes the export of the legacy MySQL/MariaDB database, turns it into PostgreSQL data, proves that nothing was lost or altered, and loads it into a database created by the NestJS migrations: your local dev database, staging, or production.

- Part A is done once per export, on your machine (about 15 minutes).
- Part B is done once per database you want to load (about 5 minutes locally, about 15 minutes for a remote database).
- Part C records the new numbers.

Parts A and B were rehearsed on 2026-10-05, from the raw export zip into new containers, with this document followed step by step. What was and was not covered is in [Rehearsal record](#rehearsal-record).

All tooling lives in one folder:

```text
backend/src/database/seeds/relational/production-data/
```

Its scripts and their README are in git. **The data is never committed**: the export, the generated `data/` folders and anything else in that folder are ignored by a whitelist in `.gitignore` (everything is ignored unless listed there). Do not use `git add -f` in that folder.

The commands below call it `$PD`:

```bash
REPO=$(git rev-parse --show-toplevel)
PD=$REPO/backend/src/database/seeds/relational/production-data
```

## What you need

- Docker running, `python3`, Node.js 20+ with `npm install` done in `backend/`
- The local dev PostgreSQL container: `cd backend && docker compose up -d postgres` (container `backend-postgres-1`, user `oms`, from `backend/.env`)
- The export file, for example `ordermysaddle-23-09-2026.sql.zip`

## The rules that keep the data exact

1. **One path.** Data goes export → MySQL container → per-table files → PostgreSQL files → build database → dump → target. No shortcuts, no second importer.
2. **The gate is `verify-against-mysql.py`.** It reads every row of all 21 legacy tables from MySQL and from PostgreSQL and compares every cell. It must print `RESULT: PASS` for the build database and again for each target, before anything else touches that database.
3. **Every target is loaded from the same dump file**, in a single transaction, into a database that the migrations created and that holds no legacy rows yet.
4. **Changes we make on purpose happen after the gate**, so the gate itself never has exceptions.

The pipeline is allowed to change exactly four things, and the verifier checks that it changed nothing else:

| Change | Where | Why |
|---|---|---|
| Double-encoded UTF-8 is repaired (`Ã¶` → `ö`) | 4,193 cells in the 2026-09-23 export | The legacy PHP app wrote UTF-8 through a latin1 connection. See [Double-encoded UTF-8](#double-encoded-utf-8) |
| NUL characters are dropped | 1,640, in `dblog` only | PostgreSQL text cannot store them |
| Six `orders` flags become booleans | `fitter_stock`, `custom_order`, `repair`, `demo`, `sponsored`, `rushed` | Migration `AddLegacyBooleanFieldsToOrders` |
| `FactoryEmployees.FactoryID` 21/22 → 3/4 | 2 rows, fixed in MySQL before the files are written | Production stores the user id instead of the factory id |

## Part A — From the export to a verified dump

### A1. Back up the pipeline folder

```bash
mkdir -p ~/db-backups
tar czf ~/db-backups/production-data-$(date -u +%Y%m%dT%H%M%SZ).tar.gz \
  --exclude='*.zip' --exclude='ordermys_new.sql' \
  -C "$REPO/backend/src/database/seeds/relational" production-data
```

### A2. Load the export into a clean MySQL container

```bash
cp /path/to/ordermysaddle-DD-MM-YYYY.sql.zip "$PD/mysql-legacy/"
cd "$PD/mysql-legacy/scripts"
./setup-mysql.sh --clean
unzip -p ../ordermysaddle-DD-MM-YYYY.sql.zip | docker exec -i oms_mysql_legacy \
  mysql --max_allowed_packet=512M --default-character-set=utf8mb4 -u oms_user -poms_password oms_legacy
```

`--default-character-set=utf8mb4` is mandatory. The export has no `SET NAMES`, and without the flag the client in the container uses latin1: every non-ASCII value is double-encoded once more and the load aborts with `ERROR 1406 Data too long for column 'PhoneNo'`, leaving 4 of 21 tables.

Check the load:

```bash
docker exec oms_mysql_legacy mysql -u oms_user -poms_password oms_legacy -e "
  SELECT COUNT(*) AS tables FROM information_schema.tables WHERE table_schema = 'oms_legacy';
  SELECT COUNT(*) AS orders, MAX(ID) AS newest_order, FROM_UNIXTIME(MAX(OrderTime)) AS newest_order_time FROM Orders;"
```

Expect 21 tables and a newest order from the day of the export.

### A3. Re-apply the FactoryEmployees fix

Every export has `adam → 21` and `gary → 22` again.

```bash
docker exec oms_mysql_legacy mysql -u oms_user -poms_password oms_legacy -e "
  UPDATE FactoryEmployees fe JOIN Factories f ON f.UserID = fe.FactoryID SET fe.FactoryID = f.ID;
  SELECT Name, FactoryID FROM FactoryEmployees;"
```

Expect `adam 3`, `gary 4`. Running it twice is harmless. Do not "fix" anything else: the 16 orders and 3 customers that point at deleted fitters stay as they are in production.

### A4. Regenerate the per-table MySQL files

```bash
./export-table-files.sh
```

It writes `mysql-legacy/data/<category>/<table>.sql` (one `INSERT` per row with a column list) and `mysql-legacy/schema/<category>.sql`, and fails if a file's row count differs from MySQL or the fix from A3 is missing.

### A5. Transform to PostgreSQL files

```bash
cd "$PD/postgres/scripts"
./transform-mysql-to-postgres.sh
```

It must end with `Transformation Complete!` and every line must say `0 lines skipped`. If it aborts with `column list of <Table> changed`, production gained or lost a column: stop, update the migrations and `EXPECTED_COLUMNS` in `convert-mysql-to-pg.py` first.

### A6. Build a clean database

The build database is a throwaway database next to your dev database. It only ever sees the migrations and the import, never seeds or the app.

```bash
cd "$REPO/backend"
sed 's/^DATABASE_NAME=.*/DATABASE_NAME=oms_build/' .env > .env.build
docker exec backend-postgres-1 psql -U oms -d postgres \
  -c "DROP DATABASE IF EXISTS oms_build WITH (FORCE)" -c "CREATE DATABASE oms_build"
npx env-cmd -f .env.build typeorm-ts-node-commonjs --dataSource=src/database/data-source.ts migration:run

cd "$PD/postgres/scripts"
PG_USER=oms PG_DATABASE=oms_build ./import-data.sh --env local --data
```

Use an env file for the migrations. `DATABASE_NAME=oms_build npm run migration:run` does **not** work: `env-cmd` lets `backend/.env` win over the shell, so the migrations would run against your dev database.

### A7. Verify the build database (the gate)

```bash
python3 verify-against-mysql.py --pg-container backend-postgres-1 --pg-user oms --pg-database oms_build \
  --repairs ~/db-backups/utf8-repairs-$(date -u +%Y%m%d).jsonl
```

It must end with `RESULT: PASS - every legacy row and cell matches MySQL.` The `--repairs` file lists every repaired cell (before and after) if you want to read through them.

Then let the independent TypeScript implementation confirm that no double-encoded text is left:

```bash
cd "$REPO/backend" && DATABASE_NAME=oms_build npm run data:fix-utf8      # dry run; must report "Total: 0 cells"
```

### A8. Extract seat sizes

```bash
cd "$PD/postgres/scripts"
PG_USER=oms PG_DATABASE=oms_build ./extract-seat-sizes.sh --env local --apply
```

`orders.seat_sizes` is filled here so it travels with the dump (51,012 of 51,339 orders for the 2026-09-23 export).

### A9. Dump

```bash
./dump-legacy-data.sh
```

It writes `~/db-backups/oms-legacy-data-<UTC time>.sql.gz` (the 21 legacy tables, data only, with sequence values) and prints its SHA256. This file is what every target is loaded from. Note the file name and the checksum.

## Part B — Load a database

Do this for each database: your local dev database, staging, production. The steps are the same; only the connection differs.

### B1. Point at the target

```bash
ENV_FILE=.env.staging            # the backend env file of the target (.env for local dev, .env.production for production)
export PGPASSWORD='...'          # password of the target user
DSN="host=<host> port=25060 dbname=<database> user=<user> sslmode=require"
# local dev database:  DSN="host=host.docker.internal port=5432 dbname=oms_nest user=oms"
DUMP=~/db-backups/oms-legacy-data-<UTC time>.sql.gz

tpsql() { docker run --rm -e PGPASSWORD --add-host host.docker.internal:host-gateway \
          postgres:17.6-alpine psql "$DSN" -X -v ON_ERROR_STOP=1 "$@"; }
tpsql -c "SELECT current_database(), current_user, version()"
```

`tpsql` runs `psql` from Docker, so nothing needs to be installed. Inside Docker a database on your own machine is `host.docker.internal`, not `127.0.0.1`. Read the output of the last line and make sure it is the database you mean.

### B2. Stop the app and back up the target

For staging and production, scale the deployments to 0 first (see the [cutover runbook](../backend/docs/prod-cutover-runbook.md)). Then:

```bash
docker run --rm -e PGPASSWORD -v ~/db-backups:/backup --add-host host.docker.internal:host-gateway \
  postgres:17.6-alpine pg_dump "$DSN" --format=custom --no-owner --no-privileges \
  --file=/backup/target-before-load-$(date -u +%Y%m%dT%H%M%SZ).dump
```

`pg_dump` must not be older than the server. For a PostgreSQL 18 server use the `postgres:18` image in this one command.

If the target holds data that exists nowhere else (comments, custom order views, saved report filters, warehouses, audit log: everything outside the 21 legacy tables), decide now what must come back after the load. See [Data that only exists in the target](#data-that-only-exists-in-the-target).

### B3. Empty the target

Local dev database:

```bash
docker exec backend-postgres-1 psql -U oms -d postgres \
  -c "DROP DATABASE IF EXISTS oms_nest WITH (FORCE)" -c "CREATE DATABASE oms_nest"
```

Managed database (the user owns the objects but is not a superuser):

```bash
tpsql -c "DROP OWNED BY CURRENT_USER CASCADE"
```

This removes every table, view and function the user owns in that database, and nothing else. Extensions installed by the provider (`uuid-ossp`) stay.

### B4. Create the schema

```bash
cd "$REPO/backend"
npx env-cmd -f $ENV_FILE typeorm-ts-node-commonjs --dataSource=src/database/data-source.ts migration:run
```

All migrations must report `has been executed successfully` (28 on 2026-10-05).

### B5. Load the dump

```bash
cd "$PD/postgres/scripts"
./load-legacy-dump.sh "$DUMP" "$DSN"
```

It shows the target, refuses to continue if the schema is missing or any legacy table already has rows, asks you to type `load`, and restores everything in one transaction. If it fails, nothing was written.

### B6. Verify the target (the gate)

```bash
python3 verify-against-mysql.py --pg-dsn "$DSN"
```

It must end with `RESULT: PASS`. This compares the target directly with the MySQL container from Part A, and checks that every sequence is past its table's highest id. If it does not pass, stop and go back to B3.

### B7. Re-run the data migrations

Three migrations change or add rows, and they ran in B4 when the tables were still empty. Run them again now that the data is there:

```bash
tpsql -c "DELETE FROM migrations WHERE name IN (
  'SeedJobSheetsForAdamWhitehouse1773100000000',
  'UpdateJobSheetsColumnGroups1774100000000',
  'NormalizeFitterCountries1774200000000')"
cd "$REPO/backend"
npx env-cmd -f $ENV_FILE typeorm-ts-node-commonjs --dataSource=src/database/data-source.ts migration:run
```

Exactly those three must report `has been executed successfully`. Before each load, check whether a newer migration also writes rows (`grep -lE "UPDATE |INSERT INTO|DELETE FROM" src/database/migrations/*.ts`) and add it to the list. `CreateRoleTable` and the two `Rook` migrations are in that grep output and need nothing: the role table is filled by the migration itself, and the Rook saddle already has the right type in production.

`NormalizeFitterCountries` carries an open TODO in its source (it only maps `NL`, `US` and `-1`). For the 2026-09-23 export it changes 2 fitters (`-1` → empty).

### B8. Refresh the materialized views

```bash
tpsql -c "REFRESH MATERIALIZED VIEW enriched_order_view" -c "REFRESH MATERIALIZED VIEW order_edit_view"
```

### B9. Final checks

```bash
tpsql -x -c "SELECT (SELECT COUNT(*) FROM orders) AS orders,
  (SELECT COUNT(*) FROM enriched_order_view) AS enriched_order_view,
  (SELECT COUNT(*) FROM order_edit_view) AS order_edit_view,
  (SELECT COUNT(*) FROM orders WHERE seat_sizes IS NOT NULL AND seat_sizes <> '[]'::jsonb) AS orders_with_seat_sizes,
  (SELECT COUNT(*) FROM custom_order_views) AS job_sheet_views,
  (SELECT COUNT(*) FROM fitters WHERE country IN ('-1', 'NL', 'US')) AS fitters_not_normalized,
  (SELECT COUNT(*) FROM migrations) AS migrations"
```

Expect: both views equal to `orders`, seat sizes on about 99% of orders, 5 job sheet views, 0 fitters not normalized, all migrations.

If you run the verifier once more now, it reports `FAIL` for `fitters` only, with exactly the rows `NormalizeFitterCountries` changed in B7 (2 for the 2026-09-23 export). Anything else is a real difference.

Then start the app and look at it: log in, open the order list, open an order and check its history timeline, and open a customer whose name has an accent.

### B10. Local dev database only: test logins

`npm run seed:run:relational` adds the documented test logins, and also sample orders 1-15, saddles 1-8, fitters 1-5 and credentials 29-31. On top of production data, delete those sample rows again (`DELETE FROM orders WHERE id BETWEEN 1 AND 15`, same for saddles 1-8, fitters 1-5, credentials 29-31) and repeat B8. The login form does not accept an e-mail address as user name, so rename the seeded admin: `UPDATE credentials SET user_name = 'localadmin' WHERE user_name = 'admin@omsaddle.com'`.

A dev database with seed users is no longer a faithful copy. Never use it as the source of a dump; that is what the build database is for.

### Data that only exists in the target

Emptying a target removes the tables that are not part of the export: `audit_log`, `comment`, `custom_order_views`, `custom_order_view_groups`, `custom_order_cell_overrides`, `report_saved_filters`, `warehouse`, `extras`, `saddle_extras`. On a database people already work in, these hold their work.

The June 2026 staging rehearsal restored them from the backup with `pg_dump --data-only --table=<each>` and `psql` after the load ([rehearsal log](../backend/docs/prod-migration-rehearsal-log.md), steps D5 and D6). That step was **not** part of the October 2026 rehearsals. Before using it on a database that matters, rehearse it against a copy.

## Part C — Record the result

1. Put the new counts in [Row counts](#row-counts) below. They are printed by `verify-against-mysql.py`.
2. Update the expected counts in `$PD/postgres/scripts/validate-data.sh` and `$PD/mysql-legacy/scripts/validate-data.sh`. These two scripts are an extra, human-readable check; the gate is the verifier.
3. Add a line to [Rehearsal record](#rehearsal-record) with the date, the export and the dump checksum.

## Things that are not part of the procedure

| Thing | Status |
|---|---|
| `oms_postgres_legacy` container on port 5433 (`setup-postgres.sh`, `import-data.sh` without `--env local`) | A copy of the legacy tables with a hand-written schema. The app cannot run on it: the migrations fail on it with `relation "user_types" already exists`. Useful for ad-hoc SQL, nothing else. |
| `sync-production-data.sh --from-dump` | A sed-based shortcut that was never used for a real load. Do not use it. |
| `transform-orders-booleans.py` | Replaced by `convert-mysql-to-pg.py`. |
| `backend/scripts/import-mysql-data.ts` | A second importer that reads the same per-table files. On 2026-09-28 its result was identical to the pipeline's. It is not used for loads and does not have the Ctrl-Z fix of 2026-10-05. |
| `mysql-legacy/ordermys_new.sql`, `postgres/data/core-business/orders.sql.backup`, `orders.sql.preboolean` | Leftovers from January and June 2026. |

## Row counts

Export of 2026-09-23 (`ordermysaddle-23-09-2026.sql.zip`, 371 MB unzipped): 2,211,463 rows in 21 tables.

| MySQL table | PostgreSQL table | Rows |
|---|---|---|
| Brands | brands | 3 |
| LeatherTypes | leather_types | 87 |
| Options | options | 53 |
| OptionsItems | options_items | 905 |
| Presets | presets | 47 |
| PresetsItems | presets_items | 1,597 |
| Saddles | saddles | 110 |
| Factories | factories | 7 |
| FactoryEmployees | factory_employees | 2 |
| Fitters | fitters | 299 |
| Customers | customers | 28,241 |
| Orders | orders | 51,339 |
| UserTypes | user_types | 4 |
| Statuses | statuses | 16 |
| Credentials | credentials | 378 |
| ClientConfirmation | client_confirmation | 24,930 |
| SaddleLeathers | saddle_leathers | 4,367 |
| SaddleOptionsItems | saddle_options_items | 21,879 |
| OrdersInfo | orders_info | 1,171,181 |
| Log | log | 821,198 |
| DBlog | dblog | 84,820 |

`role` (6 rows) is not in the export; the migration `CreateRoleTable` fills it.

## Rehearsal record

| Date | Export | What was done | Result |
|---|---|---|---|
| 2026-10-05 | 2026-09-23 | Rehearsal 1: the previous instructions followed literally, in new containers, from the raw zip | Regenerated files byte-identical to the existing ones. Found and fixed: Ctrl-Z characters stored as `Z` (12 `dblog` rows), a load command without the charset flag, `import-data.sh --fix` rewriting 16 orders and 3 customers, instructions that could not work (migrations on the 5433 container, env overrides for `npm run migration:run`) |
| 2026-10-05 | 2026-09-23 | Rehearsal 2: this document followed step by step, in new containers | Gate `PASS` for the build database, a PostgreSQL 17 dev database and a PostgreSQL 16 database owned by a non-superuser. Dump `oms-legacy-data-20261005T132743Z.sql.gz`, SHA256 `a544368f7bab25cee46f21c53e7195658db25312cf949f5a8e01d61c7c16bb62` |
| 2026-10-05 | 2026-09-23 | Staging (`oms-staging`, loaded 2026-09-28) compared cell by cell, read-only | Identical to production except: 2 fitters (`NormalizeFitterCountries`), 16 credentials (password sync of 2026-10-05), 12 `dblog` rows (Ctrl-Z) |

Timings of rehearsal 2 (MacBook, local Docker):

| Step | Time |
|---|---|
| A2 start MySQL and load the export | 42 s |
| A4 per-table files | 17 s |
| A5 transform | 33 s |
| A6 migrations + import into the build database | 11 s + 7 min |
| A7 gate + UTF-8 dry run | 46 s to 90 s + 3 s |
| A8 seat sizes, A9 dump (27 MB) | 11 s, 12 s |
| B2 backup of a loaded target | 9 s |
| B4 migrations | 11 s |
| B5 load | 15 to 20 s |
| B6 gate | 65 to 75 s locally; under 3 minutes against the DigitalOcean staging cluster |
| B7 data migrations, B8 view refresh | 11 to 16 s, 1 to 2 s |

Also tested in rehearsal 2, each with the expected outcome:

- `load-legacy-dump.sh` refuses a database without schema, refuses a second load, and aborts on a wrong or missing confirmation, each time without writing anything.
- The gate reports `FAIL` for one changed cell (a trailing space in one customer name), for one missing `orders_info` row, and for a sequence set behind its table.
- A deliberately damaged target, emptied with `DROP OWNED BY CURRENT_USER CASCADE` and loaded again, passes the gate.
- The corrected `import-data.sh --fix` leaves the 16 orders and 3 customers untouched.

Not covered by the October rehearsals:

- **B10** (seed logins on a dev database). The text is carried over from the load of 2026-09-28.
- **Restoring data that only exists in the target.** Done once in June 2026, see above.
- **Part B against a DigitalOcean database, in this exact form.** The managed target was a local PostgreSQL 16 container reached over TCP with a password. The same mechanics (dump of a local database, single-transaction restore) loaded the staging cluster on 2026-09-28, where the restore took about 10 minutes.
- **The Kubernetes steps of the cutover runbook.**

## Reference

### How the tables map

Legacy tables keep their integer primary keys; the enriched-order views and raw SQL join on them. Only the NestJS `User` entity has both a UUID `id` and an integer `legacyId`.

| MySQL | PostgreSQL |
|---|---|
| `PascalCase` table names (`Orders`) | `snake_case` (`orders`) |
| `PascalCase` columns (`CustomerID`) | `snake_case` (`customer_id`) |
| `Orders.OMSversion`, `UserTypes.UserTypeID` | `oms_version`, `id` (the two names that are not mechanical) |
| `'…\'…'` (backslash escapes) | `E'…\'…'` (escape-string literal, escapes kept) |
| `\0` (NUL, `DBlog` only) | dropped |
| `\Z` (Ctrl-Z, `DBlog` only) | the raw character (PostgreSQL would read `E'\Z'` as the letter Z) |
| tinyint 0/1 in the six `Orders` flags | `false` / `true` |
| double-encoded UTF-8 | repaired |

The full column list per table is `EXPECTED_COLUMNS` in `$PD/postgres/scripts/convert-mysql-to-pg.py`. The transform stops if an export's columns differ from it.

### Which NestJS module reads which table

| PostgreSQL table | NestJS module (`backend/src/`) |
|---|---|
| `orders` | `orders`, `enriched-orders` |
| `orders_info` | `order-lines` |
| `customers` | `customers` |
| `fitters` | `fitters` |
| `factories` | `factories` |
| `factory_employees` | `factory-employees` |
| `credentials` | `users` (through the `user` view) |
| `brands` | `brands` |
| `saddles` | `saddles`, `saddle-stock` |
| `leather_types` | `leathertypes` |
| `options`, `options_items` | `options`, `options-items` |
| `presets`, `presets_items` | `presets` |
| `saddle_leathers` | `saddle-leathers` |
| `saddle_options_items` | `saddle-options-items` |
| `statuses` | `statuses` |
| `log` | `enriched-orders` (order history timeline) |

### Scripts

`$PD/mysql-legacy/scripts/`

| Script | Purpose |
|---|---|
| `setup-mysql.sh [--clean]` | Start (or wipe and start) the MySQL 8.0 container `oms_mysql_legacy` on port 3307 |
| `export-table-files.sh` | Write the per-table data and schema files from the loaded database (step A4) |
| `import-data.sh --fix` | Re-apply the FactoryEmployees fix from `fix-referential-integrity.sql`; the other entries in that file only report |
| `import-data.sh`, `validate-data.sh` | Load the per-table files back into MySQL and check them; not needed for the procedure |

`$PD/postgres/scripts/`

| Script | Purpose |
|---|---|
| `transform-mysql-to-postgres.sh` | Convert every per-table file with `convert-mysql-to-pg.py` (step A5) |
| `convert-mysql-to-pg.py` | The converter: names, `E''` literals, booleans, NUL and Ctrl-Z, UTF-8 repair |
| `import-data.sh --env local --data` | Load the PostgreSQL files into a migrated database in `backend-postgres-1` (step A6); `PG_USER`, `PG_DATABASE` choose which |
| `verify-against-mysql.py` | The gate: every row and cell against MySQL, plus sequences (steps A7, B6) |
| `extract-seat-sizes.sh --env local --apply` | Fill `orders.seat_sizes` (step A8) |
| `dump-legacy-data.sh` | Dump the 21 legacy tables of the build database (step A9) |
| `load-legacy-dump.sh` | Load that dump into a migrated, empty target in one transaction (step B5) |
| `validate-data.sh [--env local]` | Counts against the recorded export and the known referential-integrity warnings |

### Containers

| Container | Image | Port | Database / user |
|---|---|---|---|
| `oms_mysql_legacy` | mysql:8.0 | 3307 | `oms_legacy` / `oms_user` / `oms_password` |
| `backend-postgres-1` | postgres:17.6-alpine | 5432 | `oms_nest` (dev) and `oms_build` (build) / `oms`, password from `backend/.env` |
| `oms_postgres_legacy` | postgres:15 | 5433 | `oms_legacy` / `oms_user` / `oms_password` (not part of the procedure) |

### Migrations

`backend/src/database/migrations/` holds 28 migrations (2026-10-05). `InitialSchema` creates the 21 legacy tables; later ones add row level security, the two materialized views, the boolean flags, the `role` table, `seat_sizes`, and the NestJS-only tables. The three that write rows depending on legacy data are listed in step B7.

### Known issues in the legacy data

These exist in production and are kept as they are. `validate-data.sh` prints them as warnings.

| Issue | 2026-09-23 export |
|---|---|
| Orders that point at a deleted fitter (ids 29, 46, 76, 89) | 16 |
| Customers that point at the same deleted fitters | 3 |
| `orders_info` rows of orders that were hard-deleted | 52,431 rows of 2,505 orders |
| Orders without a factory (`factory_id = 0`) | 41 |

### Double-encoded UTF-8

The legacy PHP application wrote UTF-8 through a latin1 (cp1252) MySQL connection, so MariaDB stores part of the non-ASCII text double-encoded (`ö` as `Ã¶`, `’` as `â€™`), up to four layers deep for records edited repeatedly (`RÃƒÆ’Ã‚Â¶srath`). The export contains that stored form. About 100 rows are correctly encoded, so a blind replace would damage them.

The repair re-encodes a value as cp1252 bytes and accepts the result only if it is strictly valid UTF-8, repeated until stable. It exists twice, on purpose:

- `convert-mysql-to-pg.py` applies it while writing the PostgreSQL files, so loaded databases are already clean (4,193 cells in the 2026-09-23 export: customers 1,433 · orders 1,150 · log 847 · client_confirmation 547 · orders_info 189 · fitters 22 · credentials 5).
- `backend/scripts/fix-double-encoded-utf8.ts` (`npm run data:fix-utf8`, shared decoder in `scripts/lib/double-encoded-utf8.ts`) checks or repairs a database that is already loaded. It is a dry run by default. With `--apply` it writes a rollback file and updates each cell in one transaction. After a load by this procedure it must find 0 cells.

The old staging database was repaired with `--apply` on 2026-09-18 (4,025 cells) because it had been loaded from files made before the converter did the repair.

### Roles

| ID | Legacy `user_types` | NestJS `RoleEnum` |
|---|---|---|
| 1 | fitter | `fitter` |
| 2 | admin | `admin` |
| 3 | factory | `factory` |
| 4 | customsaddler | `customsaddler` |
| 5 | — | `supervisor` (NestJS only; given to users with `supervisor = 1`) |
| 6 | — | `user` (NestJS only) |

### Seat sizes

`orders.seat_sizes` is a JSONB array in European notation (`["17", "17,5"]`). `extract-seat-sizes.sh` fills it from `orders_info` (option 1, "Seat Size": 51,003 orders) and, where that is missing, from a regex over `special_notes` (9 orders). 2026-09-23 export: 17.5" 30,227 · 17" 10,007 · 18" 8,626 · other 2,152.

### Technical notes

- Timestamps are Unix seconds in integer columns (`order_time`, `last_login`).
- Most tables use a `deleted` column (0 = active, 1 = deleted) instead of deleting rows.
- Prices come in seven tiers (`price1` … `price7`), one per currency/region.
- The NestJS migrations add no foreign keys on legacy tables, so rows with missing parents load without disabling triggers.

### Adding a table or column

1. Add it to the NestJS schema with a migration.
2. Add the table to `TABLES` and its columns to `EXPECTED_COLUMNS` in `convert-mysql-to-pg.py`.
3. Add the table to the lists in `export-table-files.sh`, `transform-mysql-to-postgres.sh`, `import-data.sh`, `dump-legacy-data.sh` and `load-legacy-dump.sh`.
4. Run the whole procedure against new containers before trusting it.
