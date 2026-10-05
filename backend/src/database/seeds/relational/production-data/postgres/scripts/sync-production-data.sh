#!/bin/bash
# =============================================================================
# Production Data Sync Script
# =============================================================================
# This script synchronizes production data to the local/staging database.
# It handles both initial import and incremental updates from production.
#
# Usage:
#   ./sync-production-data.sh                         # Full sync (legacy env)
#   ./sync-production-data.sh --env local             # Full sync (local dev)
#   ./sync-production-data.sh --incremental           # Sync only new/updated records
#   ./sync-production-data.sh --extract-seats         # Extract seat sizes only
#   ./sync-production-data.sh --from-dump FILE        # Import from a new SQL dump
#
# Environments:
#   local   - Local dev Docker (backend-postgres-1, port 5432, oms_nest)
#   legacy  - Legacy container (oms_postgres_legacy, port 5433, oms_legacy)
#
# Workflow:
#   1. Initial setup: ./setup-postgres.sh (for legacy) or docker-compose up -d postgres (for local)
#   2. First import: ./sync-production-data.sh --env <env>
#   3. Ongoing sync: ./sync-production-data.sh --env <env> --incremental
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
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
echo_header() { echo -e "\n${CYAN}=== $1 ===${NC}\n"; }
echo_env() { echo -e "${CYAN}[ENV]${NC} $1"; }

# Environment (default: legacy)
ENVIRONMENT="legacy"

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

# Execute SQL
execute_sql() {
    local sql=$1
    docker exec -i $CONTAINER_NAME psql -U $PG_USER -d $PG_DATABASE -c "$sql" 2>/dev/null
}

execute_sql_quiet() {
    local sql=$1
    docker exec -i $CONTAINER_NAME psql -U $PG_USER -d $PG_DATABASE -t -A -c "$sql" 2>/dev/null
}

# Check PostgreSQL connection
check_postgres() {
    echo_info "Checking PostgreSQL connection..."
    if ! docker exec $CONTAINER_NAME pg_isready -U $PG_USER -d $PG_DATABASE >/dev/null 2>&1; then
        echo_error "PostgreSQL container '$CONTAINER_NAME' is not running."
        if [ "$ENVIRONMENT" = "local" ]; then
            echo_info "Start it with: docker-compose up -d postgres"
        else
            echo_info "Start it with: ./setup-postgres.sh"
        fi
        exit 1
    fi
    echo_info "PostgreSQL connection OK"
}

# Create seat size extraction function
create_extraction_function() {
    echo_step "Creating seat size extraction function..."

    docker exec -i $CONTAINER_NAME psql -U $PG_USER -d $PG_DATABASE <<'EOSQL'
CREATE OR REPLACE FUNCTION extract_seat_sizes(notes TEXT)
RETURNS JSONB AS $$
DECLARE
    result TEXT[] := '{}';
    match_record RECORD;
    size_value TEXT;
    normalized_size TEXT;
BEGIN
    IF notes IS NULL OR TRIM(notes) = '' THEN
        RETURN NULL;
    END IF;

    -- Pattern 1: "seat size X.X" or "seat size X"
    FOR match_record IN
        SELECT (regexp_matches(LOWER(notes), 'seat\s*size[:\s]+(\d{1,2}(?:\.\d)?)', 'gi'))[1] AS size
    LOOP
        size_value := match_record.size;
        normalized_size := REPLACE(size_value, '.', ',');
        IF NOT normalized_size = ANY(result) THEN
            result := array_append(result, normalized_size);
        END IF;
    END LOOP;

    -- Pattern 2: "size X.X" standalone
    FOR match_record IN
        SELECT (regexp_matches(LOWER(notes), '(?<!seat\s)size[:\s]+(\d{1,2}(?:\.\d)?)', 'gi'))[1] AS size
    LOOP
        size_value := match_record.size;
        normalized_size := REPLACE(size_value, '.', ',');
        IF NOT normalized_size = ANY(result) THEN
            result := array_append(result, normalized_size);
        END IF;
    END LOOP;

    -- Pattern 3: "X.X seat"
    FOR match_record IN
        SELECT (regexp_matches(LOWER(notes), '(\d{1,2}(?:\.\d)?)\s*seat(?!\s*size)', 'gi'))[1] AS size
    LOOP
        size_value := match_record.size;
        normalized_size := REPLACE(size_value, '.', ',');
        IF NOT normalized_size = ANY(result) THEN
            result := array_append(result, normalized_size);
        END IF;
    END LOOP;

    -- Pattern 4: X.X" or X.X inch (14-20 range)
    FOR match_record IN
        SELECT (regexp_matches(notes, '(\d{1,2}(?:\.\d)?)\s*(?:"|''''|inch)', 'gi'))[1] AS size
    LOOP
        size_value := match_record.size;
        IF size_value::NUMERIC BETWEEN 14 AND 20 THEN
            normalized_size := REPLACE(size_value, '.', ',');
            IF NOT normalized_size = ANY(result) THEN
                result := array_append(result, normalized_size);
            END IF;
        END IF;
    END LOOP;

    -- Pattern 5: "stamped X.X"
    FOR match_record IN
        SELECT (regexp_matches(LOWER(notes), 'stamped(?:\s+in)?\s+(\d{1,2}(?:\.\d)?)', 'gi'))[1] AS size
    LOOP
        size_value := match_record.size;
        IF size_value::NUMERIC BETWEEN 14 AND 20 THEN
            normalized_size := REPLACE(size_value, '.', ',');
            IF NOT normalized_size = ANY(result) THEN
                result := array_append(result, normalized_size);
            END IF;
        END IF;
    END LOOP;

    IF array_length(result, 1) IS NULL OR array_length(result, 1) = 0 THEN
        RETURN NULL;
    END IF;

    RETURN to_jsonb(result);
END;
$$ LANGUAGE plpgsql;
EOSQL

    echo_info "Extraction function created"
}

# Extract seat sizes from special_notes
extract_seat_sizes() {
    echo_header "EXTRACTING SEAT SIZES"

    create_extraction_function

    echo_step "Counting orders to update..."
    local to_update=$(execute_sql_quiet "
        SELECT COUNT(*) FROM orders
        WHERE extract_seat_sizes(special_notes) IS NOT NULL
          AND (seat_sizes IS NULL OR seat_sizes = '[]'::jsonb);
    ")
    echo_info "Orders to update: $to_update"

    if [ "$to_update" -gt 0 ]; then
        echo_step "Extracting seat sizes from special_notes..."
        execute_sql "
            UPDATE orders
            SET seat_sizes = extract_seat_sizes(special_notes)
            WHERE extract_seat_sizes(special_notes) IS NOT NULL
              AND (seat_sizes IS NULL OR seat_sizes = '[]'::jsonb);
        "
        echo_info "Extraction complete"

        echo_step "Seat size distribution:"
        execute_sql "
            SELECT seat_sizes, COUNT(*) as count
            FROM orders
            WHERE seat_sizes IS NOT NULL
            GROUP BY seat_sizes
            ORDER BY count DESC
            LIMIT 15;
        "
    else
        echo_info "No new orders to extract seat sizes from"
    fi
}

# Full data import
full_import() {
    echo_header "FULL DATA IMPORT"

    echo_step "Running schema import..."
    "$SCRIPT_DIR/import-data.sh" --env "$ENVIRONMENT" --schema

    echo_step "Running data import..."
    "$SCRIPT_DIR/import-data.sh" --env "$ENVIRONMENT" --data

    echo_step "Extracting seat sizes..."
    extract_seat_sizes

    echo_step "Running validation..."
    "$SCRIPT_DIR/validate-data.sh" --env "$ENVIRONMENT"
}

# Incremental sync (for new production data)
incremental_sync() {
    echo_header "INCREMENTAL DATA SYNC"

    echo_warn "Incremental sync imports new records from production."
    echo_info "This requires a fresh dump from production database."
    echo ""

    if [ -z "$DUMP_FILE" ]; then
        echo_error "Please provide a dump file with --from-dump FILE"
        echo_info "Example: ./sync-production-data.sh --incremental --from-dump /path/to/dump.sql"
        exit 1
    fi

    if [ ! -f "$DUMP_FILE" ]; then
        echo_error "Dump file not found: $DUMP_FILE"
        exit 1
    fi

    echo_step "Creating temporary import table..."
    execute_sql "CREATE TABLE IF NOT EXISTS orders_import (LIKE orders INCLUDING ALL);"

    echo_step "Importing new data to temp table..."
    # This would need customization based on dump format
    echo_warn "TODO: Parse and import from dump file"

    echo_step "Merging new records..."
    execute_sql "
        INSERT INTO orders
        SELECT * FROM orders_import oi
        WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = oi.id)
        ON CONFLICT (id) DO UPDATE SET
            order_status = EXCLUDED.order_status,
            special_notes = EXCLUDED.special_notes,
            -- Add other fields to update
            updated_at = NOW();
    "

    echo_step "Cleaning up temp table..."
    execute_sql "DROP TABLE IF EXISTS orders_import;"

    echo_step "Extracting seat sizes for new records..."
    extract_seat_sizes

    echo_info "Incremental sync complete"
}

# Import from a new SQL dump file
import_from_dump() {
    echo_header "IMPORT FROM DUMP FILE"

    if [ -z "$DUMP_FILE" ]; then
        echo_error "Please provide a dump file"
        exit 1
    fi

    if [ ! -f "$DUMP_FILE" ]; then
        echo_error "File not found: $DUMP_FILE"
        exit 1
    fi

    echo_info "Dump file: $DUMP_FILE"
    echo_warn "This will replace all data in the database!"
    echo ""
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo_info "Aborted"
        exit 0
    fi

    echo_step "Transforming MySQL dump to PostgreSQL..."
    # Create output directory
    mkdir -p "$BASE_DIR/data/imported"

    # Basic MySQL to PostgreSQL transformation
    sed -e 's/`/"/g' \
        -e "s/\\\\'/''/g" \
        -e 's/\\"/"/g' \
        -e 's/ unsigned//gi' \
        -e 's/AUTO_INCREMENT/SERIAL/gi' \
        -e 's/int([0-9]*)/INTEGER/gi' \
        -e 's/tinyint([0-9]*)/SMALLINT/gi' \
        -e 's/varchar(/VARCHAR(/gi' \
        -e 's/ENGINE=InnoDB[^;]*//gi' \
        -e 's/DEFAULT CHARSET=[^ ]*//gi' \
        "$DUMP_FILE" > "$BASE_DIR/data/imported/transformed.sql"

    echo_step "Importing transformed data..."
    docker exec -i $CONTAINER_NAME psql -U $PG_USER -d $PG_DATABASE < "$BASE_DIR/data/imported/transformed.sql"

    echo_step "Extracting seat sizes..."
    extract_seat_sizes

    echo_info "Import complete"
}

# Show help
show_help() {
    echo "Production Data Sync Script"
    echo ""
    echo "Usage:"
    echo "  ./sync-production-data.sh                           Full sync (legacy env, default)"
    echo "  ./sync-production-data.sh --env local               Full sync (local dev)"
    echo "  ./sync-production-data.sh --env legacy              Full sync (legacy container)"
    echo "  ./sync-production-data.sh --extract-seats           Extract seat sizes only"
    echo "  ./sync-production-data.sh --incremental             Sync new records (requires --from-dump)"
    echo "  ./sync-production-data.sh --from-dump FILE          Import from MySQL dump file"
    echo "  ./sync-production-data.sh --help                    Show this help"
    echo ""
    echo "Environments:"
    echo "  local   Local dev (Docker: backend-postgres-1, port 5432, db: oms_nest)"
    echo "  legacy  Legacy container (Docker: oms_postgres_legacy, port 5433, db: oms_legacy)"
    echo ""
    echo "Environment variables (override defaults):"
    echo "  PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE, CONTAINER_NAME"
    echo ""
    echo "Workflow (local dev):"
    echo "  1. Start database:   docker-compose up -d postgres"
    echo "  2. Run migrations:   npm run migration:run"
    echo "  3. Import data:      ./sync-production-data.sh --env local"
    echo ""
    echo "Workflow (legacy):"
    echo "  1. Initial setup:    ./setup-postgres.sh"
    echo "  2. First import:     ./sync-production-data.sh"
    echo "  3. Extract seats:    ./sync-production-data.sh --extract-seats"
}

# Main
main() {
    local mode="full"
    DUMP_FILE=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --env)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --extract-seats)
                mode="extract"
                shift
                ;;
            --incremental)
                mode="incremental"
                shift
                ;;
            --from-dump)
                mode="dump"
                DUMP_FILE="$2"
                shift 2
                ;;
            *)
                echo_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    configure_environment
    check_postgres

    case $mode in
        full)
            full_import
            ;;
        extract)
            extract_seat_sizes
            ;;
        incremental)
            incremental_sync
            ;;
        dump)
            import_from_dump
            ;;
    esac

    echo ""
    echo_header "SYNC COMPLETE"
    echo_info "Database: $PG_DATABASE @ $PG_HOST:$PG_PORT"
}

main "$@"
