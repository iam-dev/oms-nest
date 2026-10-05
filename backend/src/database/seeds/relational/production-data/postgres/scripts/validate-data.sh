#!/bin/bash
# =============================================================================
# PostgreSQL Legacy Data Validation Script
# =============================================================================
# This script validates the imported legacy data
#
# Checks performed:
# - Record counts match expected values
# - Referential integrity between tables
# - Sample data verification
#
# Usage:
#   ./validate-data.sh                  # Validate legacy container (default)
#   ./validate-data.sh --env local      # Validate local dev (backend-postgres-1)
#   ./validate-data.sh --env legacy     # Validate legacy container
#
# Environments:
#   local   - Local dev Docker (backend-postgres-1, port 5432, oms_nest)
#   legacy  - Legacy container (oms_postgres_legacy, port 5433, oms_legacy)
#
# Environment Variables (override defaults):
#   PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE, CONTAINER_NAME
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
echo_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
echo_fail() { echo -e "${RED}[FAIL]${NC} $1"; }
echo_env() { echo -e "${CYAN}[ENV]${NC} $1"; }

# Parse arguments
ENVIRONMENT="legacy"

while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [--env <environment>]"
            echo ""
            echo "Environments:"
            echo "  local   Local dev (Docker: backend-postgres-1, port 5432, db: oms_nest)"
            echo "  legacy  Legacy container (Docker: oms_postgres_legacy, port 5433, db: oms_legacy)"
            echo ""
            echo "Examples:"
            echo "  ./validate-data.sh               # Validate legacy"
            echo "  ./validate-data.sh --env local   # Validate local dev"
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

# Execute SQL and return result
execute_sql() {
    local sql=$1
    docker exec $CONTAINER_NAME psql -U $PG_USER -d $PG_DATABASE -t -A -c "$sql" 2>/dev/null
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

# Validate record counts
validate_counts() {
    echo ""
    echo "=============================================="
    echo "Validating Record Counts"
    echo "=============================================="

    local all_pass=true

    # Expected counts - updated 2026-09-28 from ordermysaddle-23-09-2026.sql.zip (export of 2026-09-23, 371MB).
    # Previous counts archived in backend/docs/prod-migration-rehearsal-log.md.
    # Format: "table_name:expected_count"
    local expected_counts=(
        "brands:3"
        "leather_types:87"
        "options:53"
        "options_items:905"
        "presets:47"
        "presets_items:1597"
        "saddles:110"
        "factories:7"
        "factory_employees:2"
        "fitters:299"
        "customers:28241"
        "orders:51339"
        "user_types:4"
        "role:6"
        "statuses:16"
        "credentials:378"
        "client_confirmation:24930"
        "saddle_leathers:4367"
        "saddle_options_items:21879"
        "orders_info:1171181"
    )

    echo ""
    printf "%-25s | %10s | %10s | %s\n" "Table" "Expected" "Actual" "Status"
    echo "--------------------------|------------|------------|--------"

    for item in "${expected_counts[@]}"; do
        local table="${item%%:*}"
        local expected="${item##*:}"
        local actual=$(execute_sql "SELECT COUNT(*) FROM \"$table\";")

        if [ "$actual" -eq "$expected" ]; then
            printf "%-25s | %10s | %10s | ${GREEN}PASS${NC}\n" "$table" "$expected" "$actual"
        else
            printf "%-25s | %10s | %10s | ${RED}FAIL${NC}\n" "$table" "$expected" "$actual"
            all_pass=false
        fi
    done

    # Check audit logs (full import since 2026-09-28)
    echo ""
    echo_step "Checking audit logs..."
    local log_count=$(execute_sql "SELECT COUNT(*) FROM \"log\";")
    local dblog_count=$(execute_sql "SELECT COUNT(*) FROM \"dblog\";")

    if [ "$log_count" -gt 0 ]; then
        printf "%-25s | %10s | %10s | ${GREEN}OK${NC}\n" "log" ">0" "$log_count"
    else
        printf "%-25s | %10s | %10s | ${YELLOW}WARN${NC}\n" "log" ">0" "$log_count"
    fi

    if [ "$dblog_count" -gt 0 ]; then
        printf "%-25s | %10s | %10s | ${GREEN}OK${NC}\n" "dblog" ">0" "$dblog_count"
    else
        printf "%-25s | %10s | %10s | ${YELLOW}WARN${NC}\n" "dblog" ">0" "$dblog_count"
    fi

    echo ""
    if $all_pass; then
        echo_pass "All record counts match expected values"
    else
        echo_fail "Some record counts do not match"
    fi
}

# Validate referential integrity
# =============================================================================
# KNOWN LEGACY DATA ISSUES (2026-09-23 export):
# These are expected referential integrity issues from years of production use:
#
# 1. Orders -> Fitters: 16 orders reference 4 deleted fitters (IDs: 29, 46, 76, 89)
# 2. Customers -> Fitters: 3 customers reference same deleted fitters
# 3. OrdersInfo -> Orders: 52,431 records reference 2,505 deleted orders
#    (order IDs in valid range 19-54969 but orders were hard-deleted)
#
# These issues exist in production and are preserved for data integrity.
# The NestJS application handles missing references gracefully.
# =============================================================================
validate_referential_integrity() {
    echo ""
    echo "=============================================="
    echo "Validating Referential Integrity"
    echo "(Note: Some failures are expected legacy data issues)"
    echo "=============================================="

    local all_pass=true

    # Check FactoryEmployees -> Factories
    echo_step "Checking FactoryEmployees -> Factories..."
    local orphan_employees=$(execute_sql "
        SELECT COUNT(*) FROM factory_employees fe
        LEFT JOIN factories f ON fe.factory_id = f.id
        WHERE f.id IS NULL;
    ")
    if [ "$orphan_employees" -eq 0 ]; then
        echo_pass "All FactoryEmployees reference valid Factories"
    else
        echo_fail "$orphan_employees FactoryEmployees reference non-existent Factories"
        all_pass=false
    fi

    # Check Orders -> Fitters (where fitter_id > 0)
    echo_step "Checking Orders -> Fitters (active references)..."
    local orphan_orders_fitters=$(execute_sql "
        SELECT COUNT(*) FROM orders o
        LEFT JOIN fitters f ON o.fitter_id = f.id
        WHERE o.fitter_id > 0 AND f.id IS NULL;
    ")
    if [ "$orphan_orders_fitters" -eq 0 ]; then
        echo_pass "All Orders with FitterID > 0 reference valid Fitters"
    else
        echo_fail "$orphan_orders_fitters Orders reference non-existent Fitters"
        all_pass=false
    fi

    # Check Orders -> Customers (where customer_id > 0)
    echo_step "Checking Orders -> Customers (active references)..."
    local orphan_orders_customers=$(execute_sql "
        SELECT COUNT(*) FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.customer_id > 0 AND c.id IS NULL;
    ")
    if [ "$orphan_orders_customers" -eq 0 ]; then
        echo_pass "All Orders with CustomerID > 0 reference valid Customers"
    else
        echo_fail "$orphan_orders_customers Orders reference non-existent Customers"
        all_pass=false
    fi

    # Check Customers -> Fitters (where fitter_id > 0)
    echo_step "Checking Customers -> Fitters (active references)..."
    local orphan_customers_fitters=$(execute_sql "
        SELECT COUNT(*) FROM customers c
        LEFT JOIN fitters f ON c.fitter_id = f.id
        WHERE c.fitter_id > 0 AND f.id IS NULL;
    ")
    if [ "$orphan_customers_fitters" -eq 0 ]; then
        echo_pass "All Customers with FitterID > 0 reference valid Fitters"
    else
        echo_fail "$orphan_customers_fitters Customers reference non-existent Fitters"
        all_pass=false
    fi

    # Check OrdersInfo -> Orders
    echo_step "Checking OrdersInfo -> Orders..."
    local orphan_orders_info=$(execute_sql "
        SELECT COUNT(*) FROM orders_info oi
        LEFT JOIN orders o ON oi.order_id = o.id
        WHERE o.id IS NULL;
    ")
    if [ "$orphan_orders_info" -eq 0 ]; then
        echo_pass "All OrdersInfo reference valid Orders"
    else
        echo_fail "$orphan_orders_info OrdersInfo reference non-existent Orders"
        all_pass=false
    fi

    # Check SaddleLeathers -> Saddles
    echo_step "Checking SaddleLeathers -> Saddles..."
    local orphan_saddle_leathers=$(execute_sql "
        SELECT COUNT(*) FROM saddle_leathers sl
        LEFT JOIN saddles s ON sl.saddle_id = s.id
        WHERE s.id IS NULL;
    ")
    if [ "$orphan_saddle_leathers" -eq 0 ]; then
        echo_pass "All SaddleLeathers reference valid Saddles"
    else
        echo_fail "$orphan_saddle_leathers SaddleLeathers reference non-existent Saddles"
        all_pass=false
    fi

    # Check SaddleOptionsItems -> Saddles
    echo_step "Checking SaddleOptionsItems -> Saddles..."
    local orphan_saddle_options=$(execute_sql "
        SELECT COUNT(*) FROM saddle_options_items soi
        LEFT JOIN saddles s ON soi.saddle_id = s.id
        WHERE s.id IS NULL;
    ")
    if [ "$orphan_saddle_options" -eq 0 ]; then
        echo_pass "All SaddleOptionsItems reference valid Saddles"
    else
        echo_fail "$orphan_saddle_options SaddleOptionsItems reference non-existent Saddles"
        all_pass=false
    fi

    echo ""
    if $all_pass; then
        echo_pass "All referential integrity checks passed"
    else
        echo_warn "Some referential integrity issues found (see known issues above)"
    fi
}

# Show sample data
show_sample_data() {
    echo ""
    echo "=============================================="
    echo "Sample Data Verification"
    echo "=============================================="

    echo ""
    echo_step "Sample Brands:"
    execute_sql "SELECT id, brand_name FROM brands LIMIT 5;"

    echo ""
    echo_step "Sample Factories:"
    execute_sql "SELECT id, user_id, country, currency FROM factories LIMIT 5;"

    echo ""
    echo_step "Sample Factory Employees:"
    execute_sql "SELECT id, name, factory_id FROM factory_employees LIMIT 5;"

    echo ""
    echo_step "Sample User Types (legacy):"
    execute_sql "SELECT id, type_description FROM user_types LIMIT 5;"

    echo ""
    echo_step "Sample Roles (NestJS backend):"
    execute_sql "SELECT id, name FROM role ORDER BY id;"

    echo ""
    echo_step "Sample Statuses:"
    execute_sql "SELECT id, name, sequence FROM statuses LIMIT 5;"

    echo ""
    echo_step "Sample Orders (recent 5):"
    execute_sql "SELECT id, fitter_id, order_status, order_time FROM orders ORDER BY id DESC LIMIT 5;"

    echo ""
    echo_step "Order Status Distribution:"
    execute_sql "
        SELECT order_status, COUNT(*) as count
        FROM orders
        GROUP BY order_status
        ORDER BY count DESC
        LIMIT 10;
    "
}

# Main execution
main() {
    configure_environment
    check_postgres
    validate_counts
    validate_referential_integrity
    show_sample_data

    echo ""
    echo "=============================================="
    echo_info "Validation complete!"
    echo "=============================================="
}

main
