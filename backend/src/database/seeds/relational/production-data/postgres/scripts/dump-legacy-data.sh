#!/bin/bash
# =============================================================================
# Dump the legacy tables of the verified build database
# =============================================================================
# Writes the 21 legacy tables (data only, COPY format, sequence values included)
# of the build database to one gzip file. That file is what every target
# (local dev, staging, production) is loaded from with ./load-legacy-dump.sh,
# so all of them receive exactly the rows that passed verify-against-mysql.py.
#
# Usage:
#   ./dump-legacy-data.sh                       # -> ~/db-backups/oms-legacy-data-<UTC time>.sql.gz
#   ./dump-legacy-data.sh /path/to/file.sql.gz
#
# Run it only after verify-against-mysql.py reported PASS for the build database.
#
# Environment Variables (override defaults):
#   CONTAINER_NAME (backend-postgres-1), PG_USER (oms), PG_DATABASE (oms_build)
# =============================================================================

set -euo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-backend-postgres-1}"
PG_USER="${PG_USER:-oms}"
PG_DATABASE="${PG_DATABASE:-oms_build}"
OUT="${1:-$HOME/db-backups/oms-legacy-data-$(date -u +%Y%m%dT%H%M%SZ).sql.gz}"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }
echo_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

TABLES=(
    brands leather_types options options_items presets presets_items saddles
    factories factory_employees fitters customers orders
    user_types statuses credentials client_confirmation
    saddle_leathers saddle_options_items orders_info
    log dblog
)

if ! docker exec "$CONTAINER_NAME" pg_isready -U "$PG_USER" -d "$PG_DATABASE" >/dev/null 2>&1; then
    echo_error "Database '$PG_DATABASE' in container '$CONTAINER_NAME' is not reachable."
    exit 1
fi

table_args=()
for table in "${TABLES[@]}"; do
    table_args+=(-t "public.$table")
done

mkdir -p "$(dirname "$OUT")"
echo_step "Dumping ${#TABLES[@]} tables of $CONTAINER_NAME/$PG_DATABASE -> $OUT"

# transaction_timeout only exists since PostgreSQL 17; a PostgreSQL 16 target rejects the SET.
# It is in the first lines of the dump, so only the header is touched.
docker exec "$CONTAINER_NAME" pg_dump -U "$PG_USER" -d "$PG_DATABASE" \
    --data-only --no-owner --no-privileges "${table_args[@]}" |
    sed '1,40{/^SET transaction_timeout/d;}' |
    gzip > "$OUT"

copies=$(gunzip -c "$OUT" | LC_ALL=C grep -a -c '^COPY public\.' || true)
if [ "$copies" -ne "${#TABLES[@]}" ]; then
    echo_error "The dump holds $copies tables, expected ${#TABLES[@]}"
    exit 1
fi

echo_info "Tables: $copies"
echo_info "Size:   $(ls -lh "$OUT" | awk '{print $5}')"
echo_info "SHA256: $(shasum -a 256 "$OUT" | awk '{print $1}')"
echo ""
echo_info "Load it into a migrated, empty database with:"
echo "  PGPASSWORD=... ./load-legacy-dump.sh $OUT \"host=... port=... dbname=... user=... sslmode=require\""
