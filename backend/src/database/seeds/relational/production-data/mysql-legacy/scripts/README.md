# MySQL Legacy Data Validation Scripts

These scripts help you set up a fresh MySQL database using Docker and validate the legacy production data.

## Prerequisites

- Docker and Docker Compose installed
- Bash shell (macOS/Linux)

## Quick Start

```bash
# 1. Start MySQL container
./setup-mysql.sh

# 2. Import all data
./import-data.sh

# 3. Validate the data
./validate-data.sh
```

## Scripts

### setup-mysql.sh

Sets up a fresh MySQL 8.0 database in Docker.

```bash
./setup-mysql.sh           # Start MySQL
./setup-mysql.sh --clean   # Remove existing and start fresh
```

**Connection Details:**

- Host: `127.0.0.1`
- Port: `3307`
- Database: `oms_legacy`
- User: `oms_user`
- Password: `oms_password`

### import-data.sh

Imports schema and data into the MySQL database.

```bash
./import-data.sh              # Import schema + data
./import-data.sh --schema     # Schema only
./import-data.sh --data       # Data only
./import-data.sh --original   # Import mysql-legacy/ordermys_new.sql (stale January 2026 dump; prefer the steps below)
./import-data.sh --fix        # Re-apply the FactoryEmployees fix after loading a fresh export (reports, but does not change, the deleted-fitter references)
```

### Loading a new production export

The full procedure is the tracked document `docs/production-data-migration.md` (Part A). The MySQL part of it:

```bash
./setup-mysql.sh --clean
unzip -p ../ordermysaddle-DD-MM-YYYY.sql.zip | docker exec -i oms_mysql_legacy mysql --max_allowed_packet=512M --default-character-set=utf8mb4 -u oms_user -poms_password oms_legacy
docker exec oms_mysql_legacy mysql -u oms_user -poms_password oms_legacy -e "UPDATE FactoryEmployees fe JOIN Factories f ON f.UserID = fe.FactoryID SET fe.FactoryID = f.ID"
./export-table-files.sh       # writes ../data/<category>/<table>.sql and ../schema/<category>.sql
```

`--default-character-set=utf8mb4` is mandatory: without it the load double-encodes every non-ASCII value and aborts with `ERROR 1406 Data too long for column 'PhoneNo'`.

### export-table-files.sh

Writes one data file per table (one INSERT per row with a column list, the format `postgres/scripts/convert-mysql-to-pg.py` reads) and the five schema files. It checks every file's row count against MySQL and refuses to run when the FactoryEmployees fix is missing.

### validate-data.sh

Validates data integrity and shows statistics.

```bash
./validate-data.sh            # Run standard validations
./validate-data.sh --quick    # Just record counts
./validate-data.sh --random   # Show random sample records
./validate-data.sh --all      # All validations + samples + report
./validate-data.sh --report   # Generate markdown report
```

## Known Data Issues

### 1. FactoryEmployees Referential Integrity

The production `FactoryEmployees` table uses `Credentials.UserID` instead of `Factories.ID`:

- `adam` has `FactoryID=21` in the export (should be `3`)
- `gary` has `FactoryID=22` in the export (should be `4`)

The files in `../data/` already contain the corrected values; `import-data.sh` re-applies `fix-referential-integrity.sql` FIX 1 after every import. FIX 2/3 in that file (orphan fitter references) only report since 2026-10-05, so the 16 orders and 3 customers pointing at deleted fitters stay as they are in production. Before that date the file set their fitter to 0, which `--fix` and a plain `./import-data.sh` both applied.

### 2. State Values

Non-US factories have 'Alaska' as placeholder state value.

### 3. Truncated Phone Numbers

Some phone numbers in the Factories table are truncated due to `varchar(11)` limit.

## Data Statistics

_2026-09-23 export (updated 2026-09-28). The full 21-table list is in `../documentation/data-volumes.md`._

| Table | Records |
|-------|---------|
| Orders | 51,339 |
| Customers | 28,241 |
| Fitters | 299 |
| Credentials | 378 |
| Factories | 7 |
| Saddles | 110 |
| Brands | 3 |
| OrdersInfo | 1,171,181 |
| ClientConfirmation | 24,930 |
| Log / DBlog | 821,198 / 84,820 (skipped by `import-data.sh`; load them by hand with `--include-logs` semantics: pipe `../data/audit-logging/*.sql` in) |

## Troubleshooting

### MySQL won't start

```bash
# Check Docker logs
docker logs oms_mysql_legacy

# Restart with clean state
./setup-mysql.sh --clean
```

### Import fails

```bash
# Check MySQL is running
docker exec oms_mysql_legacy mysqladmin ping -u root -proot_password

# Import with verbose output
docker exec -i oms_mysql_legacy mysql -u oms_user -poms_password oms_legacy -v < ../data/core-business/orders.sql
```

### Connect to MySQL manually

```bash
# Via Docker
docker exec -it oms_mysql_legacy mysql -u oms_user -poms_password oms_legacy

# Via local client
mysql -h 127.0.0.1 -P 3307 -u oms_user -poms_password oms_legacy
```
