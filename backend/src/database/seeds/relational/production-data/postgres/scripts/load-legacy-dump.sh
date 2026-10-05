#!/bin/bash
# =============================================================================
# Load the legacy data dump into a migrated, empty database
# =============================================================================
# Restores the file written by ./dump-legacy-data.sh into any PostgreSQL
# database (local dev, staging, production) in ONE transaction: either every
# row arrives or nothing changes.
#
# The target must already have the NestJS schema (`migration:run`) and its
# legacy tables must be empty. The script refuses to load otherwise, so a
# database that is in use cannot be loaded twice or by mistake.
#
# Usage:
#   PGPASSWORD=... ./load-legacy-dump.sh <dump.sql.gz> "<connection string>" [--yes]
#
# Examples:
#   PGPASSWORD=oms_password ./load-legacy-dump.sh ~/db-backups/oms-legacy-data-X.sql.gz \
#       "host=host.docker.internal port=5432 dbname=oms_nest user=oms"
#   PGPASSWORD=... ./load-legacy-dump.sh ~/db-backups/oms-legacy-data-X.sql.gz \
#       "host=<cluster>.db.ondigitalocean.com port=25060 dbname=<db> user=<user> sslmode=require"
#
# psql runs from a Docker image when it is not installed locally. Inside Docker,
# a database on this machine is reached as host.docker.internal, not 127.0.0.1.
#
# Environment Variables:
#   PGPASSWORD   password of the target user (required)
#   PSQL_IMAGE   image used for psql (default postgres:17.6-alpine, the version
#                that wrote the dump; psql must not be older than that)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
echo_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }
echo_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

DUMP="${1:-}"
DSN="${2:-}"
ASSUME_YES="${3:-}"
PSQL_IMAGE="${PSQL_IMAGE:-postgres:17.6-alpine}"

if [ -z "$DUMP" ] || [ -z "$DSN" ]; then
    echo "Usage: PGPASSWORD=... $0 <dump.sql.gz> \"<connection string>\" [--yes]"
    exit 1
fi
if [ ! -f "$DUMP" ]; then
    echo_error "Dump file not found: $DUMP"
    exit 1
fi
if [ -z "${PGPASSWORD:-}" ]; then
    echo_error "PGPASSWORD is not set."
    exit 1
fi

if command -v psql >/dev/null 2>&1; then
    PSQL=(psql "$DSN" -X -v ON_ERROR_STOP=1)
else
    PSQL=(docker run --rm -i -e PGPASSWORD --add-host host.docker.internal:host-gateway
          "$PSQL_IMAGE" psql "$DSN" -X -v ON_ERROR_STOP=1)
fi

# Queries must not read stdin: `docker run -i` would swallow the answer typed below.
run_psql() {
    "${PSQL[@]}" "$@" < /dev/null
}

TABLES=(
    brands leather_types options options_items presets presets_items saddles
    factories factory_employees fitters customers orders
    user_types statuses credentials client_confirmation
    saddle_leathers saddle_options_items orders_info
    log dblog
)

count_sql=""
for table in "${TABLES[@]}"; do
    count_sql+="SELECT '$table', COUNT(*) FROM \"$table\" UNION ALL "
done
count_sql="${count_sql% UNION ALL }"

echo ""
echo_info "Target: $DSN"
echo_info "Server: $(run_psql -At -c "SELECT current_database() || ' on PostgreSQL ' || current_setting('server_version')")"
echo_info "Dump:   $DUMP ($(ls -lh "$DUMP" | awk '{print $5}'), sha256 $(shasum -a 256 "$DUMP" | awk '{print $1}'))"

# Guard 1: the NestJS schema must be there.
has_schema=$(run_psql -At -c "SELECT to_regclass('public.migrations') IS NOT NULL AND to_regclass('public.orders') IS NOT NULL")
if [ "$has_schema" != "t" ]; then
    echo_error "The target has no NestJS schema. Run the TypeORM migrations against it first. Nothing was loaded."
    exit 1
fi
migrations=$(run_psql -At -c "SELECT COUNT(*) FROM migrations")
echo_info "Schema: $migrations migrations applied"

# Guard 2: every legacy table must be empty.
existing=$(run_psql -At -c "SELECT COALESCE(SUM(n), 0) FROM ($count_sql) AS t(name, n)")
if [ "$existing" -ne 0 ]; then
    echo_error "The target already holds legacy data. Nothing was loaded."
    run_psql -At -F ' ' -c "SELECT * FROM ($count_sql) AS t(name, n) WHERE n > 0 ORDER BY 1"
    echo_error "Empty the database and run the migrations again (steps B3 and B4 of docs/production-data-migration.md)."
    exit 1
fi
echo_info "Legacy tables are empty"

if [ "$ASSUME_YES" != "--yes" ]; then
    echo ""
    echo_warn "About to load production data into: $DSN"
    answer=""
    read -r -p "Type 'load' to continue: " answer || true
    if [ "$answer" != "load" ]; then
        echo_error "Aborted. Nothing was loaded."
        exit 1
    fi
fi

echo_step "Loading in a single transaction..."
SECONDS=0
gunzip -c "$DUMP" | "${PSQL[@]}" -q --single-transaction >/dev/null
echo_info "Loaded in ${SECONDS}s"

echo ""
echo "Table                  | Rows"
echo "-----------------------|---------"
run_psql -At -F ' ' -c "SELECT * FROM ($count_sql) AS t(name, n) ORDER BY 1" | while read -r name n; do
    printf "%-22s | %s\n" "$name" "$n"
done
echo ""
echo_info "Next: verify-against-mysql.py --pg-dsn \"...\" must report PASS before anything else touches this database."
