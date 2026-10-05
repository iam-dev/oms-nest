#!/bin/bash
# =============================================================================
# PostgreSQL Legacy Data Import Script
# =============================================================================
# This script imports all legacy data from the transformed SQL files
#
# Usage:
#   ./import-data.sh                    # Import all data (legacy env, default)
#   ./import-data.sh --env local        # Import to local dev (backend-postgres-1)
#   ./import-data.sh --env legacy       # Import to legacy container (oms_postgres_legacy)
#   ./import-data.sh --schema           # Import schema only
#   ./import-data.sh --data             # Import data only (assumes schema exists)
#   ./import-data.sh --env local --data # Import data to local dev
#
# Environments:
#   local   - Local dev Docker (backend-postgres-1, port 5432, oms_nest)
#   legacy  - Legacy container (oms_postgres_legacy, port 5433, oms_legacy)
#
# Prerequisites:
#   - For local: docker-compose up -d postgres
#   - For legacy: ./setup-postgres.sh
#   - Run ./transform-mysql-to-postgres.sh to transform MySQL data
#
# Environment Variables (override defaults):
#   PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE, CONTAINER_NAME
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
echo_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }
echo_step() { echo -e "${BLUE}[STEP]${NC} $1"; }
echo_env() { echo -e "${CYAN}[ENV]${NC} $1"; }

# Parse arguments
ENVIRONMENT="legacy"
IMPORT_MODE="all"

while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --schema)
            IMPORT_MODE="schema"
            shift
            ;;
        --data)
            IMPORT_MODE="data"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--env <environment>] [--schema|--data]"
            echo ""
            echo "Environments:"
            echo "  local   Local dev (Docker: backend-postgres-1, port 5432, db: oms_nest)"
            echo "  legacy  Legacy container (Docker: oms_postgres_legacy, port 5433, db: oms_legacy)"
            echo ""
            echo "Import modes:"
            echo "  (none)    Import schema + data (default)"
            echo "  --schema  Import schema only"
            echo "  --data    Import data only (assumes schema exists)"
            echo ""
            echo "Examples:"
            echo "  ./import-data.sh                     # Import all to legacy"
            echo "  ./import-data.sh --env local         # Import all to local dev"
            echo "  ./import-data.sh --env local --data  # Import data only to local dev"
            echo ""
            echo "Environment Variables (override defaults):"
            echo "  PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE, CONTAINER_NAME"
            exit 0
            ;;
        *)
            echo_error "Unknown argument: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Configure environment
configure_environment() {
    case $ENVIRONMENT in
        local)
            # Local development (Docker Compose)
            export PG_HOST="${PG_HOST:-127.0.0.1}"
            export PG_PORT="${PG_PORT:-5432}"
            export PG_USER="${PG_USER:-postgres}"
            export PG_PASSWORD="${PG_PASSWORD:-postgres}"
            export PG_DATABASE="${PG_DATABASE:-oms_nest}"
            export CONTAINER_NAME="${CONTAINER_NAME:-backend-postgres-1}"
            ;;
        legacy)
            # Legacy PostgreSQL container
            export PG_HOST="${PG_HOST:-127.0.0.1}"
            export PG_PORT="${PG_PORT:-5433}"
            export PG_USER="${PG_USER:-oms_user}"
            export PG_PASSWORD="${PG_PASSWORD:-oms_password}"
            export PG_DATABASE="${PG_DATABASE:-oms_legacy}"
            export CONTAINER_NAME="${CONTAINER_NAME:-oms_postgres_legacy}"
            ;;
        *)
            echo_error "Unknown environment: $ENVIRONMENT"
            echo "Valid environments: local, legacy"
            exit 1
            ;;
    esac

    echo ""
    echo_env "Environment: $ENVIRONMENT"
    echo_env "Host: $PG_HOST:$PG_PORT"
    echo_env "Database: $PG_DATABASE"
    echo_env "User: $PG_USER"
    echo_env "Container: $CONTAINER_NAME"
    echo ""
}

# Execute SQL file
execute_sql_file() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        echo_step "Importing: $description"
        docker exec -i $CONTAINER_NAME psql -U $PG_USER -d $PG_DATABASE < "$file"
        echo_info "  Completed: $(basename "$file")"
    else
        echo_warn "  File not found: $file"
    fi
}

# Bulk-load orders_info via COPY (~1000x faster than per-row INSERT over network).
# Falls back to execute_sql_file if python3 is unavailable.
execute_orders_info_copy() {
    local file=$1
    local description=$2

    if [ ! -f "$file" ]; then
        echo_warn "  File not found: $file"
        return 0
    fi
    if ! command -v python3 >/dev/null 2>&1; then
        echo_warn "python3 not found — falling back to slow INSERT loop for orders_info"
        execute_sql_file "$file" "$description"
        return 0
    fi

    echo_step "Importing: $description (via COPY)"
    local tsv="/tmp/orders_info_$$.tsv"

    # Convert orders-info.sql per-row INSERTs (optional column list, E'' literals) to a 7-column TSV.
    python3 - "$file" "$tsv" <<'PYEOF'
import re, sys
src, dst = sys.argv[1], sys.argv[2]

def parse_values(s):
    # Returns raw values; string values keep their whitespace, bare tokens are stripped.
    out, cur = [], []
    in_str = False
    was_str = False
    i = 0
    while i < len(s):
        c = s[i]
        if in_str:
            if c == "\\" and i + 1 < len(s):
                nxt = s[i+1]
                if nxt == "'":   cur.append("'")
                elif nxt == 'n': cur.append('\n')
                elif nxt == 't': cur.append('\t')
                elif nxt == 'r': cur.append('\r')
                elif nxt == '\\': cur.append('\\')
                else: cur.append(nxt)
                i += 2; continue
            if c == "'" and i + 1 < len(s) and s[i+1] == "'":
                cur.append("'"); i += 2; continue
            if c == "'":
                in_str = False; was_str = True; i += 1; continue
            cur.append(c); i += 1
        else:
            if c == ',':
                out.append("".join(cur) if was_str else "".join(cur).strip())
                cur = []; was_str = False; i += 1; continue
            if c == "'":
                in_str = True; cur = []; i += 1; continue
            if c == 'E' and i + 1 < len(s) and s[i+1] == "'":
                i += 1; continue  # E'' literal prefix
            cur.append(c); i += 1
    out.append("".join(cur) if was_str else "".join(cur).strip())
    return out

INSERT_RE = re.compile(r'^INSERT INTO "orders_info"(?: \([^)]*\))? VALUES \((.+)\);\s*$')
count = 0
with open(src, "r", encoding="utf-8") as fin, open(dst, "w", encoding="utf-8") as fout:
    for line in fin:
        m = INSERT_RE.match(line)
        if not m: continue
        vals = parse_values(m.group(1))
        if len(vals) != 7: continue
        out_vals = []
        for v in vals:
            # PG COPY text format: escape backslash, tab, newline, carriage return.
            v = v.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n").replace("\r", "\\r")
            out_vals.append(v)
        fout.write("\t".join(out_vals) + "\n")
        count += 1
print(f"  Converted {count} rows to TSV ({dst})")
PYEOF

    # Stream TSV into psql via \COPY
    local copy_sql="\\COPY orders_info (order_id, option_id, option_item_id, clone_number, color, leathertype, custom) FROM STDIN WITH (FORMAT text);"
    if [ "${USE_DOCKER:-true}" = "true" ]; then
        cat "$tsv" | docker exec -i "$CONTAINER_NAME" psql -U "$PG_USER" -d "$PG_DATABASE" -c "$copy_sql"
    else
        PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -c "$copy_sql" < "$tsv"
    fi
    rm -f "$tsv"
    echo_info "  Completed: $(basename "$file") (via COPY)"
}

# Execute SQL string
execute_sql() {
    local sql=$1
    docker exec -i $CONTAINER_NAME psql -U $PG_USER -d $PG_DATABASE -c "$sql"
}

# Check if PostgreSQL is accessible
check_postgres() {
    echo_info "Checking PostgreSQL connection..."
    if ! docker exec $CONTAINER_NAME pg_isready -U $PG_USER -d $PG_DATABASE >/dev/null 2>&1; then
        echo_error "PostgreSQL container '$CONTAINER_NAME' is not running."
        if [ "$ENVIRONMENT" = "local" ]; then
            echo "Run: docker-compose up -d postgres"
        else
            echo "Run: ./setup-postgres.sh"
        fi
        exit 1
    fi
    echo_info "PostgreSQL connection OK"
}

# Import schema files
import_schema() {
    echo ""
    echo "=============================================="
    echo "Importing Schema..."
    echo "=============================================="

    # Import schema files in order
    execute_sql_file "$BASE_DIR/schema/01-system-admin.sql" "System Admin Schema"
    execute_sql_file "$BASE_DIR/schema/02-product-catalog.sql" "Product Catalog Schema"
    execute_sql_file "$BASE_DIR/schema/03-core-business.sql" "Core Business Schema"
    execute_sql_file "$BASE_DIR/schema/04-relationships.sql" "Relationship Tables Schema"
    execute_sql_file "$BASE_DIR/schema/05-audit-logging.sql" "Audit Logging Schema"

    echo_info "Schema import complete"
}

# Import data files
import_data() {
    echo ""
    echo "=============================================="
    echo "Importing Data..."
    echo "=============================================="

    # Disable triggers for bulk import (bypasses FK checks)
    echo_step "Disabling triggers for bulk import..."
    execute_sql "SET session_replication_role = 'replica';"

    # System Admin Data (import first - reference tables)
    echo_step "System Admin Data..."
    execute_sql_file "$BASE_DIR/data/system-admin/user-types.sql" "User Types"
    execute_sql_file "$BASE_DIR/data/system-admin/roles.sql" "Roles (NestJS backend)"
    execute_sql_file "$BASE_DIR/data/system-admin/statuses.sql" "Statuses"
    execute_sql_file "$BASE_DIR/data/system-admin/credentials.sql" "Credentials"
    execute_sql_file "$BASE_DIR/data/system-admin/client-confirmation.sql" "Client Confirmations"

    # Product Catalog Data
    echo_step "Product Catalog Data..."
    execute_sql_file "$BASE_DIR/data/product-catalog/brands.sql" "Brands"
    execute_sql_file "$BASE_DIR/data/product-catalog/leather-types.sql" "Leather Types"
    execute_sql_file "$BASE_DIR/data/product-catalog/options.sql" "Options"
    execute_sql_file "$BASE_DIR/data/product-catalog/options-items.sql" "Options Items"
    execute_sql_file "$BASE_DIR/data/product-catalog/presets.sql" "Presets"
    execute_sql_file "$BASE_DIR/data/product-catalog/presets-items.sql" "Presets Items"
    execute_sql_file "$BASE_DIR/data/product-catalog/saddles.sql" "Saddles"

    # Core Business Data
    echo_step "Core Business Data..."
    execute_sql_file "$BASE_DIR/data/core-business/factories.sql" "Factories"
    execute_sql_file "$BASE_DIR/data/core-business/factory-employees.sql" "Factory Employees"
    execute_sql_file "$BASE_DIR/data/core-business/fitters.sql" "Fitters"
    execute_sql_file "$BASE_DIR/data/core-business/customers.sql" "Customers"
    execute_sql_file "$BASE_DIR/data/core-business/orders.sql" "Orders"

    # Relationship Data
    echo_step "Relationship Data..."
    execute_sql_file "$BASE_DIR/data/relationships/saddle-leathers.sql" "Saddle Leathers"
    execute_sql_file "$BASE_DIR/data/relationships/saddle-options-items.sql" "Saddle Options Items"
    execute_orders_info_copy "$BASE_DIR/data/relationships/orders-info.sql" "Orders Info"

    # Audit Logging Data (partial)
    echo_step "Audit Logging Data (full; log backs the order-history timeline)..."
    execute_sql_file "$BASE_DIR/data/audit-logging/log.sql" "Log"
    execute_sql_file "$BASE_DIR/data/audit-logging/dblog.sql" "DBlog"

    # Re-enable triggers
    echo_step "Re-enabling triggers..."
    execute_sql "SET session_replication_role = 'origin';"

    # Update sequences to match imported data
    echo_step "Updating sequences..."
    execute_sql "SELECT setval('brands_id_seq', COALESCE((SELECT MAX(id) FROM brands), 1));"
    execute_sql "SELECT setval('leather_types_id_seq', COALESCE((SELECT MAX(id) FROM leather_types), 1));"
    execute_sql "SELECT setval('options_id_seq', COALESCE((SELECT MAX(id) FROM options), 1));"
    execute_sql "SELECT setval('options_items_id_seq', COALESCE((SELECT MAX(id) FROM options_items), 1));"
    execute_sql "SELECT setval('presets_id_seq', COALESCE((SELECT MAX(id) FROM presets), 1));"
    execute_sql "SELECT setval('saddles_id_seq', COALESCE((SELECT MAX(id) FROM saddles), 1));"
    execute_sql "SELECT setval('factories_id_seq', COALESCE((SELECT MAX(id) FROM factories), 1));"
    execute_sql "SELECT setval('factory_employees_id_seq', COALESCE((SELECT MAX(id) FROM factory_employees), 1));"
    execute_sql "SELECT setval('fitters_id_seq', COALESCE((SELECT MAX(id) FROM fitters), 1));"
    execute_sql "SELECT setval('customers_id_seq', COALESCE((SELECT MAX(id) FROM customers), 1));"
    execute_sql "SELECT setval('orders_id_seq', COALESCE((SELECT MAX(id) FROM orders), 1));"
    execute_sql "SELECT setval('credentials_user_id_seq', COALESCE((SELECT MAX(user_id) FROM credentials), 1));"
    execute_sql "SELECT setval('client_confirmation_id_seq', COALESCE((SELECT MAX(id) FROM client_confirmation), 1));"
    execute_sql "SELECT setval('saddle_leathers_id_seq', COALESCE((SELECT MAX(id) FROM saddle_leathers), 1));"
    execute_sql "SELECT setval('saddle_options_items_id_seq', COALESCE((SELECT MAX(id) FROM saddle_options_items), 1));"
    execute_sql "SELECT setval('user_types_id_seq', COALESCE((SELECT MAX(id) FROM user_types), 1));"
    execute_sql "SELECT setval('statuses_id_seq', COALESCE((SELECT MAX(id) FROM statuses), 1));"
    execute_sql "SELECT setval('log_id_seq', COALESCE((SELECT MAX(id) FROM log), 1));"
    execute_sql "SELECT setval('dblog_id_seq', COALESCE((SELECT MAX(id) FROM dblog), 1));"

    echo_info "Data import complete"
}

# Show import statistics
show_statistics() {
    echo ""
    echo "=============================================="
    echo "Import Statistics"
    echo "=============================================="

    local tables=(
        "brands"
        "leather_types"
        "options"
        "options_items"
        "presets"
        "presets_items"
        "saddles"
        "user_types"
        "role"
        "statuses"
        "credentials"
        "factories"
        "factory_employees"
        "fitters"
        "customers"
        "orders"
        "saddle_leathers"
        "saddle_options_items"
        "orders_info"
        "client_confirmation"
        "log"
        "dblog"
    )

    echo "Table                  | Record Count"
    echo "-----------------------|-------------"

    for table in "${tables[@]}"; do
        local count=$(execute_sql "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null | tail -3 | head -1 | tr -d ' ')
        if [ -n "$count" ]; then
            printf "%-22s | %s\n" "$table" "$count"
        fi
    done

    echo ""
}

# Main execution
main() {
    configure_environment
    check_postgres

    case "$IMPORT_MODE" in
        schema)
            import_schema
            ;;
        data)
            import_data
            show_statistics
            ;;
        *)
            import_schema
            import_data
            show_statistics
            ;;
    esac

    echo ""
    echo_info "Import complete! Run ./validate-data.sh --env $ENVIRONMENT to verify the data."
}

main
