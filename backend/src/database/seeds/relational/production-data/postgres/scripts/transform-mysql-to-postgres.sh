#!/bin/bash
# =============================================================================
# MySQL to PostgreSQL Data Transformation Script
# =============================================================================
# Converts the per-table files in mysql-legacy/data/ (produced with
# `mysqldump --complete-insert --skip-extended-insert`) into PostgreSQL INSERT
# files in postgres/data/ using convert-mysql-to-pg.py, which:
#
# - maps table/column names to the NestJS snake_case schema (and aborts when a
#   dump's column list differs from the known one)
# - writes strings as E'' literals so MySQL escapes keep their meaning
# - converts the six tinyint columns of orders to true/false
# - repairs double-encoded UTF-8 ("Ã¶" for "ö") from the legacy PHP app, the same
#   way backend/scripts/lib/double-encoded-utf8.ts does, so the generated files
#   are clean and `npm run data:fix-utf8` finds nothing after an import
#
# log and dblog are converted in full: the order-history timeline in the app reads `log`.
#
# Usage:
#   ./transform-mysql-to-postgres.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POSTGRES_DIR="$(dirname "$SCRIPT_DIR")"
MYSQL_DIR="$(dirname "$POSTGRES_DIR")/mysql-legacy"
CONVERTER="$SCRIPT_DIR/convert-mysql-to-pg.py"

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

FAILED=0

# Transform one MySQL table file to PostgreSQL format
transform_file() {
    local input_file=$1
    local output_file=$2
    shift 2

    echo_step "Transforming: $(basename "$input_file") -> $(basename "$output_file")"
    if ! python3 "$CONVERTER" "$input_file" "$output_file" "$@"; then
        echo_error "  Conversion reported problems for $(basename "$input_file")"
        FAILED=1
    fi
}

transform_category() {
    local category=$1
    shift
    for file in "$@"; do
        src="$MYSQL_DIR/data/$category/${file}.sql"
        dst="$POSTGRES_DIR/data/$category/${file}.sql"
        if [ -f "$src" ]; then
            mkdir -p "$(dirname "$dst")"
            transform_file "$src" "$dst"
        else
            echo_warn "  Source not found: $src"
        fi
    done
}

main() {
    echo ""
    echo "=============================================="
    echo "MySQL to PostgreSQL Data Transformation"
    echo "=============================================="
    echo ""

    if [ ! -d "$MYSQL_DIR/data" ]; then
        echo_error "MySQL source directory not found: $MYSQL_DIR/data"
        exit 1
    fi
    if ! command -v python3 >/dev/null 2>&1; then
        echo_error "python3 is required (convert-mysql-to-pg.py)"
        exit 1
    fi

    echo_step "Transforming Product Catalog data..."
    transform_category product-catalog brands leather-types options options-items presets presets-items saddles

    echo_step "Transforming Core Business data..."
    transform_category core-business factories factory-employees fitters customers orders

    echo_step "Transforming System Admin data..."
    transform_category system-admin user-types statuses credentials client-confirmation

    echo_step "Transforming Relationship data..."
    transform_category relationships saddle-leathers saddle-options-items orders-info

    echo_step "Transforming Audit Logging data (full log + dblog, this is ~1.2 GB of output)..."
    transform_category audit-logging log dblog

    echo ""
    if [ "$FAILED" -ne 0 ]; then
        echo_error "Transformation finished with problems — inspect the warnings above."
        exit 1
    fi
    echo "=============================================="
    echo -e "${GREEN}Transformation Complete!${NC}"
    echo "=============================================="
    echo ""
    echo "Next steps:"
    echo "  1. Run: ./setup-postgres.sh --clean   # Start a fresh PostgreSQL container"
    echo "  2. Run: ./import-data.sh              # Import the transformed data"
    echo "  3. Run: ./validate-data.sh            # Validate the imported data"
    echo ""
}

main "$@"
