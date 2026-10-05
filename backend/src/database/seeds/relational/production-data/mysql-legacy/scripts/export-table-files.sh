#!/bin/bash
# =============================================================================
# Regenerate the per-table MySQL files from the loaded legacy database
# =============================================================================
# Writes, from the database in the MySQL container:
#   mysql-legacy/data/<category>/<file>.sql   one INSERT per row with a column list
#   mysql-legacy/schema/<category>.sql        CREATE TABLE statements
#
# The data format (--complete-insert --skip-extended-insert) is the only one that
# postgres/scripts/convert-mysql-to-pg.py and backend/scripts/import-mysql-data.ts
# read correctly. Every file is checked: its INSERT count must equal COUNT(*).
#
# Usage:
#   ./export-table-files.sh
#
# Run it after loading a new export and re-applying the FactoryEmployees fix.
# Environment Variables (override defaults):
#   CONTAINER_NAME, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
CONTAINER_NAME="${CONTAINER_NAME:-oms_mysql_legacy}"
MYSQL_USER="${MYSQL_USER:-oms_user}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-oms_password}"
MYSQL_DATABASE="${MYSQL_DATABASE:-oms_legacy}"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }
echo_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# category:MySQL table:file name (order = order inside the schema file)
TABLES=(
    "product-catalog:Brands:brands"
    "product-catalog:LeatherTypes:leather-types"
    "product-catalog:Options:options"
    "product-catalog:OptionsItems:options-items"
    "product-catalog:Presets:presets"
    "product-catalog:PresetsItems:presets-items"
    "product-catalog:Saddles:saddles"
    "core-business:Factories:factories"
    "core-business:FactoryEmployees:factory-employees"
    "core-business:Fitters:fitters"
    "core-business:Customers:customers"
    "core-business:Orders:orders"
    "system-admin:UserTypes:user-types"
    "system-admin:Statuses:statuses"
    "system-admin:Credentials:credentials"
    "system-admin:ClientConfirmation:client-confirmation"
    "relationships:SaddleLeathers:saddle-leathers"
    "relationships:SaddleOptionsItems:saddle-options-items"
    "relationships:OrdersInfo:orders-info"
    "audit-logging:Log:log"
    "audit-logging:DBlog:dblog"
)

# MYSQL_PWD keeps the "password on the command line" warning out of the output files.
run_mysqldump() {
    docker exec -e MYSQL_PWD="$MYSQL_PASSWORD" "$CONTAINER_NAME" mysqldump -u "$MYSQL_USER" \
        --no-tablespaces --skip-triggers --single-transaction \
        --max_allowed_packet=512M --default-character-set=utf8mb4 "$@"
}

count_rows() {
    docker exec -e MYSQL_PWD="$MYSQL_PASSWORD" "$CONTAINER_NAME" mysql -u "$MYSQL_USER" "$MYSQL_DATABASE" \
        -BN -e "SELECT COUNT(*) FROM \`$1\`"
}

if ! docker exec -e MYSQL_PWD="$MYSQL_PASSWORD" "$CONTAINER_NAME" mysql -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "SELECT 1" >/dev/null 2>&1; then
    echo_error "Cannot reach $MYSQL_DATABASE in container '$CONTAINER_NAME'. Run ./setup-mysql.sh and load the export first."
    exit 1
fi

# The FactoryEmployees fix must be in place before the files are written.
unfixed=$(docker exec -e MYSQL_PWD="$MYSQL_PASSWORD" "$CONTAINER_NAME" mysql -u "$MYSQL_USER" "$MYSQL_DATABASE" -BN -e \
    "SELECT COUNT(*) FROM FactoryEmployees fe LEFT JOIN Factories f ON f.ID = fe.FactoryID WHERE f.ID IS NULL")
if [ "$unfixed" -ne 0 ]; then
    echo_error "$unfixed FactoryEmployees rows do not point at a factory: re-apply the FactoryEmployees fix first."
    exit 1
fi

echo ""
echo "=============================================="
echo "Exporting data files (one INSERT per row)"
echo "=============================================="
total=0
for entry in "${TABLES[@]}"; do
    IFS=: read -r category table file <<< "$entry"
    out="$BASE_DIR/data/$category/$file.sql"
    mkdir -p "$(dirname "$out")"
    run_mysqldump --no-create-info --complete-insert --skip-extended-insert "$MYSQL_DATABASE" "$table" > "$out"
    expected=$(count_rows "$table")
    actual=$(grep -c '^INSERT INTO' "$out" || true)
    if [ "$actual" -ne "$expected" ]; then
        echo_error "$table: $actual INSERT lines in $out but $expected rows in MySQL"
        exit 1
    fi
    printf "%-20s -> %-42s %9s rows\n" "$table" "data/$category/$file.sql" "$actual"
    total=$((total + actual))
done
echo_info "Data files written: ${#TABLES[@]} tables, $total rows"

echo ""
echo "=============================================="
echo "Exporting schema files"
echo "=============================================="
for category in product-catalog core-business system-admin relationships audit-logging; do
    names=()
    for entry in "${TABLES[@]}"; do
        IFS=: read -r c table file <<< "$entry"
        if [ "$c" = "$category" ]; then
            names+=("$table")
        fi
    done
    out="$BASE_DIR/schema/$category.sql"
    mkdir -p "$(dirname "$out")"
    run_mysqldump --no-data --add-drop-table "$MYSQL_DATABASE" "${names[@]}" > "$out"
    created=$(grep -c '^CREATE TABLE' "$out" || true)
    if [ "$created" -ne "${#names[@]}" ]; then
        echo_error "schema/$category.sql has $created CREATE TABLE statements, expected ${#names[@]}"
        exit 1
    fi
    printf "%-20s -> schema/%s.sql (%s tables)\n" "$category" "$category" "$created"
done

echo ""
echo_info "Export complete. Next: cd ../../postgres/scripts && ./transform-mysql-to-postgres.sh"
