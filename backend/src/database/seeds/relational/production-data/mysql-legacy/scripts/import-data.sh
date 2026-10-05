#!/bin/bash
# =============================================================================
# MySQL Legacy Data Import Script
# =============================================================================
# This script imports all legacy data from the extracted SQL files
#
# Usage:
#   ./import-data.sh              # Import all data (schema + data)
#   ./import-data.sh --schema     # Import schema only
#   ./import-data.sh --data       # Import data only (assumes schema exists)
#   ./import-data.sh --original   # Import from original dump file
#
# Prerequisites:
#   - Run ./setup-mysql.sh first to start the MySQL container
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
MYSQL_HOST="127.0.0.1"
MYSQL_PORT="3307"
MYSQL_USER="oms_user"
MYSQL_PASSWORD="oms_password"
MYSQL_DATABASE="oms_legacy"
CONTAINER_NAME="oms_mysql_legacy"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
echo_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }
echo_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Execute SQL file
execute_sql_file() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        echo_step "Importing: $description"
        # Import file and ensure COMMIT (some files start transactions but don't commit)
        { cat "$file"; echo "COMMIT;"; } | docker exec -i $CONTAINER_NAME mysql -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE
        echo_info "  Completed: $(basename "$file")"
    else
        echo_warn "  File not found: $file"
    fi
}

# Execute SQL string
execute_sql() {
    local sql=$1
    docker exec -i $CONTAINER_NAME mysql -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE -e "$sql"
}

# Check if MySQL is accessible
check_mysql() {
    echo_info "Checking MySQL connection..."
    if ! docker exec $CONTAINER_NAME mysqladmin ping -h localhost -u root -proot_password --silent 2>/dev/null; then
        echo_error "MySQL is not running. Please run ./setup-mysql.sh first."
        exit 1
    fi
    echo_info "MySQL connection OK"
}

# Import schema files
import_schema() {
    echo ""
    echo "=============================================="
    echo "Importing Schema..."
    echo "=============================================="

    # Disable foreign key checks during schema creation
    execute_sql "SET FOREIGN_KEY_CHECKS = 0;"

    # Import schema files in correct order
    execute_sql_file "$BASE_DIR/schema/product-catalog.sql" "Product Catalog Schema"
    execute_sql_file "$BASE_DIR/schema/core-business.sql" "Core Business Schema"
    execute_sql_file "$BASE_DIR/schema/system-admin.sql" "System Admin Schema"
    execute_sql_file "$BASE_DIR/schema/relationships.sql" "Relationship Tables Schema"
    execute_sql_file "$BASE_DIR/schema/audit-logging.sql" "Audit Logging Schema"

    # Re-enable foreign key checks
    execute_sql "SET FOREIGN_KEY_CHECKS = 1;"

    echo_info "Schema import complete"
}

# Import data files
import_data() {
    echo ""
    echo "=============================================="
    echo "Importing Data..."
    echo "=============================================="

    # Disable foreign key checks during data import
    execute_sql "SET FOREIGN_KEY_CHECKS = 0;"

    # Product Catalog Data (import first - reference tables)
    echo_step "Product Catalog Data..."
    execute_sql_file "$BASE_DIR/data/product-catalog/brands.sql" "Brands"
    execute_sql_file "$BASE_DIR/data/product-catalog/leather-types.sql" "Leather Types"
    execute_sql_file "$BASE_DIR/data/product-catalog/options.sql" "Options"
    execute_sql_file "$BASE_DIR/data/product-catalog/options-items.sql" "Options Items"
    execute_sql_file "$BASE_DIR/data/product-catalog/presets.sql" "Presets"
    execute_sql_file "$BASE_DIR/data/product-catalog/presets-items.sql" "Presets Items"
    execute_sql_file "$BASE_DIR/data/product-catalog/saddles.sql" "Saddles"

    # System Admin Data
    echo_step "System Admin Data..."
    execute_sql_file "$BASE_DIR/data/system-admin/user-types.sql" "User Types"
    execute_sql_file "$BASE_DIR/data/system-admin/statuses.sql" "Statuses"
    execute_sql_file "$BASE_DIR/data/system-admin/credentials.sql" "Credentials"
    execute_sql_file "$BASE_DIR/data/system-admin/client-confirmation.sql" "Client Confirmations"

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
    execute_sql_file "$BASE_DIR/data/relationships/orders-info.sql" "Orders Info"

    # Audit Logging Data (optional - may be large)
    echo_step "Audit Logging Data (this may take a while)..."
    if [ -f "$BASE_DIR/data/audit-logging/log.sql" ]; then
        echo_warn "  Skipping large log file (run with --include-logs to import)"
    fi
    if [ -f "$BASE_DIR/data/audit-logging/dblog.sql" ]; then
        echo_warn "  Skipping large dblog file (run with --include-logs to import)"
    fi

    # Re-enable foreign key checks
    execute_sql "SET FOREIGN_KEY_CHECKS = 1;"

    echo_info "Data import complete"

    # Apply referential integrity fixes
    if [ -f "$SCRIPT_DIR/fix-referential-integrity.sql" ]; then
        echo ""
        echo_step "Applying referential integrity fixes..."
        docker exec -i $CONTAINER_NAME mysql -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE < "$SCRIPT_DIR/fix-referential-integrity.sql" > /dev/null 2>&1
        echo_info "Referential integrity fixes applied"
    fi
}

# Import from original SQL dump
import_original() {
    echo ""
    echo "=============================================="
    echo "Importing from Original SQL Dump..."
    echo "=============================================="

    local original_dump="$BASE_DIR/ordermys_new.sql"

    if [ ! -f "$original_dump" ]; then
        echo_error "Original dump file not found: $original_dump"
        exit 1
    fi

    echo_info "This will import the complete original MySQL dump (~355MB)"
    echo_info "This may take several minutes..."

    docker exec -i $CONTAINER_NAME mysql --max_allowed_packet=512M -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE < "$original_dump"

    echo_info "Original dump import complete"

    # Fresh dumps regress the documented FactoryEmployees fix.
    # Apply known data-integrity fixes after import.
    apply_known_fixes
}

# Apply the documented data-integrity fix (FactoryEmployees); deleted-fitter refs are only reported.
# Safe to run repeatedly. See fix-referential-integrity.sql for details.
apply_known_fixes() {
    local fix_sql="$SCRIPT_DIR/fix-referential-integrity.sql"
    if [ ! -f "$fix_sql" ]; then
        echo_warn "fix-referential-integrity.sql not found — skipping known-data fixes"
        return 0
    fi
    echo ""
    echo "=============================================="
    echo "Applying known data-integrity fixes..."
    echo "=============================================="
    docker exec -i $CONTAINER_NAME mysql -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE < "$fix_sql" 2>&1 | tail -25
    echo_info "Known fix applied (FactoryEmployees); deleted-fitter references reported, not changed"
}

# Show import statistics
show_statistics() {
    echo ""
    echo "=============================================="
    echo "Import Statistics"
    echo "=============================================="

    local tables=(
        "Brands"
        "LeatherTypes"
        "Options"
        "OptionsItems"
        "Presets"
        "PresetsItems"
        "Saddles"
        "UserTypes"
        "Statuses"
        "Credentials"
        "Factories"
        "FactoryEmployees"
        "Fitters"
        "Customers"
        "Orders"
        "SaddleLeathers"
        "SaddleOptionsItems"
        "OrdersInfo"
        "ClientConfirmation"
    )

    echo "Table                  | Record Count"
    echo "-----------------------|-------------"

    for table in "${tables[@]}"; do
        local count=$(execute_sql "SELECT COUNT(*) FROM \`$table\`;" 2>/dev/null | tail -1)
        if [ -n "$count" ]; then
            printf "%-22s | %s\n" "$table" "$count"
        fi
    done

    echo ""
}

# Main execution
main() {
    check_mysql

    case "$1" in
        --schema)
            import_schema
            ;;
        --data)
            import_data
            apply_known_fixes
            show_statistics
            ;;
        --original)
            import_original
            show_statistics
            ;;
        --fix)
            # Apply known data-integrity fixes only (use after manually piping a fresh dump).
            apply_known_fixes
            ;;
        *)
            import_schema
            import_data
            apply_known_fixes
            show_statistics
            ;;
    esac

    echo ""
    echo_info "Import complete! Run ./validate-data.sh to verify the data."
}

main "$@"
