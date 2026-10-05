#!/usr/bin/env bash
# =============================================================================
# MySQL Legacy Data Validation Script
# =============================================================================
# This script validates the imported data for integrity and correctness
#
# Usage:
#   ./validate-data.sh           # Run all validations
#   ./validate-data.sh --quick   # Quick validation (counts only)
#   ./validate-data.sh --random  # Show random sample records
#   ./validate-data.sh --all     # All validations including random samples
#
# Prerequisites:
#   - Run ./setup-mysql.sh and ./import-data.sh first
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MYSQL_HOST="127.0.0.1"
MYSQL_PORT="3307"
MYSQL_USER="oms_user"
MYSQL_PASSWORD="oms_password"
MYSQL_DATABASE="oms_legacy"
CONTAINER_NAME="oms_mysql_legacy"

# Expected counts - updated 2026-09-28 from ordermysaddle-23-09-2026.sql.zip (export of 2026-09-23).
# Previous counts archived in backend/docs/prod-migration-rehearsal-log.md.
# Format: "TableName:ExpectedCount"
EXPECTED_COUNTS="Orders:51339 Customers:28241 Brands:3 Factories:7 FactoryEmployees:2 Saddles:110"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
echo_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }
echo_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
echo_fail() { echo -e "${RED}[FAIL]${NC} $1"; }
echo_step() { echo -e "${BLUE}[CHECK]${NC} $1"; }

# Execute SQL and return result
execute_sql() {
    local sql=$1
    docker exec -i $CONTAINER_NAME mysql -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE -N -e "$sql" 2>/dev/null
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

# Validate record counts
validate_counts() {
    echo ""
    echo "=============================================="
    echo "Record Count Validation"
    echo "=============================================="

    local all_pass=true

    # Parse expected counts and validate
    for item in $EXPECTED_COUNTS; do
        local table=$(echo "$item" | cut -d: -f1)
        local expected=$(echo "$item" | cut -d: -f2)
        local actual=$(execute_sql "SELECT COUNT(*) FROM \`$table\`;")

        if [ "$actual" -eq "$expected" ]; then
            echo_pass "$table: $actual records (expected: $expected)"
        else
            echo_fail "$table: $actual records (expected: $expected)"
            all_pass=false
        fi
    done

    # Check other tables (no expected count, just verify they have data)
    echo ""
    echo "Other Tables:"
    for table in Fitters LeatherTypes Options OptionsItems Presets PresetsItems Credentials UserTypes Statuses; do
        local count=$(execute_sql "SELECT COUNT(*) FROM \`$table\`;")
        if [ "$count" -gt 0 ]; then
            echo_pass "$table: $count records"
        else
            echo_warn "$table: 0 records (may be expected)"
        fi
    done

    if $all_pass; then
        echo ""
        echo_pass "All expected counts match!"
    else
        echo ""
        echo_fail "Some counts don't match expected values"
    fi
}

# Validate referential integrity
validate_integrity() {
    echo ""
    echo "=============================================="
    echo "Referential Integrity Validation"
    echo "=============================================="

    local all_pass=true

    # Check Orders -> Customers
    echo_step "Orders referencing valid Customers..."
    local orphan_orders=$(execute_sql "SELECT COUNT(*) FROM Orders o LEFT JOIN Customers c ON o.CustomerID = c.ID WHERE o.CustomerID > 0 AND c.ID IS NULL;")
    if [ "$orphan_orders" -eq 0 ]; then
        echo_pass "All orders reference valid customers"
    else
        echo_warn "$orphan_orders orders reference non-existent customers"
    fi

    # Check Orders -> Fitters (FitterID=0 means "unassigned" which is valid)
    echo_step "Orders referencing valid Fitters..."
    local orphan_fitters=$(execute_sql "SELECT COUNT(*) FROM Orders o LEFT JOIN Fitters f ON o.FitterID = f.ID WHERE o.FitterID > 0 AND f.ID IS NULL;")
    local unassigned_fitters=$(execute_sql "SELECT COUNT(*) FROM Orders WHERE FitterID = 0;")
    if [ "$orphan_fitters" -eq 0 ]; then
        echo_pass "All orders reference valid fitters ($unassigned_fitters unassigned with FitterID=0)"
    else
        echo_warn "$orphan_fitters orders reference non-existent fitters"
    fi

    # Check Orders -> Factories (FactoryID=0 means "unassigned" which is valid)
    echo_step "Orders referencing valid Factories..."
    local orphan_factories=$(execute_sql "SELECT COUNT(*) FROM Orders o LEFT JOIN Factories f ON o.FactoryID = f.ID WHERE o.FactoryID > 0 AND f.ID IS NULL;")
    local unassigned_factories=$(execute_sql "SELECT COUNT(*) FROM Orders WHERE FactoryID = 0;")
    if [ "$orphan_factories" -eq 0 ]; then
        echo_pass "All orders reference valid factories ($unassigned_factories unassigned with FactoryID=0)"
    else
        echo_warn "$orphan_factories orders reference non-existent factories"
    fi

    # Check FactoryEmployees -> Factories
    echo_step "FactoryEmployees referencing valid Factories..."
    local orphan_employees=$(execute_sql "SELECT COUNT(*) FROM FactoryEmployees fe LEFT JOIN Factories f ON fe.FactoryID = f.ID WHERE f.ID IS NULL;")
    if [ "$orphan_employees" -eq 0 ]; then
        echo_pass "All factory employees reference valid factories"
    else
        echo_fail "$orphan_employees factory employees reference non-existent factories"
    fi

    # Check Saddles -> Factories (EU, GB, US)
    echo_step "Saddles referencing valid Factories..."
    local invalid_saddle_factories=$(execute_sql "
        SELECT COUNT(*) FROM Saddles s
        WHERE (s.FactoryEU > 0 AND s.FactoryEU NOT IN (SELECT ID FROM Factories))
           OR (s.FactoryGB > 0 AND s.FactoryGB NOT IN (SELECT ID FROM Factories))
           OR (s.FactoryUS > 0 AND s.FactoryUS NOT IN (SELECT ID FROM Factories));
    ")
    if [ "$invalid_saddle_factories" -eq 0 ]; then
        echo_pass "All saddles reference valid factories"
    else
        echo_warn "$invalid_saddle_factories saddles reference non-existent factories"
    fi

    # Check Customers -> Fitters
    echo_step "Customers referencing valid Fitters..."
    local orphan_customer_fitters=$(execute_sql "SELECT COUNT(*) FROM Customers c LEFT JOIN Fitters f ON c.FitterID = f.ID WHERE c.FitterID > 0 AND f.ID IS NULL;")
    if [ "$orphan_customer_fitters" -eq 0 ]; then
        echo_pass "All customers reference valid fitters"
    else
        echo_warn "$orphan_customer_fitters customers reference non-existent fitters"
    fi
}

# Show random sample records
show_random_samples() {
    echo ""
    echo "=============================================="
    echo "Random Sample Records"
    echo "=============================================="

    # Random Orders
    echo ""
    echo_step "Random Orders (5 samples):"
    execute_sql "
        SELECT ID, FitterID, CustomerID, HorseName, OrderStatus, OrderTime, SerialNumber
        FROM Orders
        ORDER BY RAND()
        LIMIT 5;
    " | column -t -s $'\t'

    # Random Customers
    echo ""
    echo_step "Random Customers (5 samples):"
    execute_sql "
        SELECT ID, Name, Email, City, Country
        FROM Customers
        WHERE Name IS NOT NULL AND Name != ''
        ORDER BY RAND()
        LIMIT 5;
    " | column -t -s $'\t'

    # Random Fitters
    echo ""
    echo_step "Random Fitters (5 samples):"
    execute_sql "
        SELECT ID, UserID, City, Country, Emailaddress
        FROM Fitters
        ORDER BY RAND()
        LIMIT 5;
    " | column -t -s $'\t'

    # All Factories
    echo ""
    echo_step "All Factories:"
    execute_sql "
        SELECT ID, UserID, City, Country, Emailaddress
        FROM Factories;
    " | column -t -s $'\t'

    # All Factory Employees
    echo ""
    echo_step "All Factory Employees:"
    execute_sql "
        SELECT fe.ID, fe.Name, fe.FactoryID, f.City, f.Emailaddress
        FROM FactoryEmployees fe
        JOIN Factories f ON fe.FactoryID = f.ID;
    " | column -t -s $'\t'

    # Random Saddles
    echo ""
    echo_step "Random Saddles (5 samples):"
    execute_sql "
        SELECT ID, Brand, ModelName, FactoryEU, FactoryGB, FactoryUS, Active
        FROM Saddles
        WHERE Deleted = 0
        ORDER BY RAND()
        LIMIT 5;
    " | column -t -s $'\t'

    # All Brands
    echo ""
    echo_step "All Brands:"
    execute_sql "SELECT * FROM Brands;" | column -t -s $'\t'
}

# Validate data quality
validate_quality() {
    echo ""
    echo "=============================================="
    echo "Data Quality Checks"
    echo "=============================================="

    # Check for NULL values in critical fields
    echo_step "Checking for NULL values in critical fields..."

    local null_customer_names=$(execute_sql "SELECT COUNT(*) FROM Customers WHERE Name IS NULL OR Name = '';")
    if [ "$null_customer_names" -gt 0 ]; then
        echo_warn "$null_customer_names customers have NULL/empty names"
    else
        echo_pass "All customers have names"
    fi

    local null_order_fitters=$(execute_sql "SELECT COUNT(*) FROM Orders WHERE FitterID IS NULL OR FitterID = 0;")
    if [ "$null_order_fitters" -gt 0 ]; then
        echo_warn "$null_order_fitters orders have no fitter assigned"
    else
        echo_pass "All orders have fitters assigned"
    fi

    # Check for deleted records
    echo_step "Checking deleted records..."
    local deleted_customers=$(execute_sql "SELECT COUNT(*) FROM Customers WHERE Deleted = 1;")
    local deleted_fitters=$(execute_sql "SELECT COUNT(*) FROM Fitters WHERE Deleted = 1;")
    local deleted_factories=$(execute_sql "SELECT COUNT(*) FROM Factories WHERE Deleted = 1;")
    echo_info "Deleted customers: $deleted_customers"
    echo_info "Deleted fitters: $deleted_fitters"
    echo_info "Deleted factories: $deleted_factories"

    # Check order status distribution
    echo_step "Order Status Distribution:"
    execute_sql "
        SELECT OrderStatus, COUNT(*) as Count
        FROM Orders
        GROUP BY OrderStatus
        ORDER BY OrderStatus;
    " | column -t -s $'\t'
}

# Show known issues
show_known_issues() {
    echo ""
    echo "=============================================="
    echo "Known Data Issues"
    echo "=============================================="

    echo ""
    echo -e "${GREEN}1. FactoryEmployees Referential Integrity (FIXED)${NC}"
    echo "   FactoryID now correctly references Factory.ID instead of UserID"
    echo ""
    echo -e "${GREEN}2. factories.sql (FIXED)${NC}"
    echo "   The duplicate CREATE TABLE statement has been removed"
    echo ""
    echo -e "${GREEN}3. Deleted Fitter References (FIXED)${NC}"
    echo "   Orders/Customers referencing deleted fitters now use FitterID=0"
    echo ""
    echo -e "${YELLOW}4. State Values${NC}"
    echo "   Many non-US factories have 'Alaska' as state (legacy placeholder)"
    echo ""
    echo -e "${YELLOW}5. Unassigned Orders${NC}"
    echo "   39 orders have FactoryID=0 (historical/unassigned - intentional)"
    echo ""
}

# Generate validation report
generate_report() {
    local report_file="$SCRIPT_DIR/validation-results-$(date +%Y%m%d-%H%M%S).md"

    echo ""
    echo "=============================================="
    echo "Generating Validation Report..."
    echo "=============================================="

    {
        echo "# MySQL Legacy Data Validation Report"
        echo ""
        echo "**Generated:** $(date)"
        echo "**Database:** $MYSQL_DATABASE"
        echo ""
        echo "## Record Counts"
        echo ""
        echo "| Table | Count |"
        echo "|-------|-------|"

        for table in Orders Customers Brands Factories FactoryEmployees Fitters Saddles LeatherTypes Options OptionsItems Presets PresetsItems; do
            local count=$(execute_sql "SELECT COUNT(*) FROM \`$table\`;")
            echo "| $table | $count |"
        done

        echo ""
        echo "## Known Issues"
        echo ""
        echo "1. **FactoryEmployees**: Uses UserID instead of Factory.ID for FactoryID field"
        echo "2. **factories.sql**: (FIXED) Duplicate CREATE TABLE statement removed"
        echo "3. **State values**: Non-US locations show 'Alaska' as placeholder"

    } > "$report_file"

    echo_info "Report saved to: $report_file"
}

# Main execution
main() {
    check_mysql

    case "$1" in
        --quick)
            validate_counts
            ;;
        --random)
            show_random_samples
            ;;
        --integrity)
            validate_integrity
            ;;
        --quality)
            validate_quality
            ;;
        --issues)
            show_known_issues
            ;;
        --report)
            generate_report
            ;;
        --all)
            validate_counts
            validate_integrity
            validate_quality
            show_random_samples
            show_known_issues
            generate_report
            ;;
        *)
            validate_counts
            validate_integrity
            validate_quality
            show_known_issues
            ;;
    esac

    echo ""
    echo_info "Validation complete!"
}

main "$@"
