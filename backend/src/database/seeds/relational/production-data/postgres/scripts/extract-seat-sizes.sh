#!/bin/bash
# =============================================================================
# Extract Seat Sizes Script
# =============================================================================
# This script extracts seat size information and populates the seat_sizes
# JSONB column in the orders table from TWO sources:
#
# 1. PRIMARY: orders_info table (option_id=1 is 'Seat Size')
#    - Joins with options_items to get actual size value
#    - ~50,000 orders have seat size data here
#
# 2. FALLBACK: special_notes field (regex extraction)
#    - Extracts patterns like "seat size 17", "17.5 seat", "17 inch"
#    - Only ~24 additional orders have extractable seat sizes
#
# Usage:
#   ./extract-seat-sizes.sh                    # Preview only (local dev)
#   ./extract-seat-sizes.sh --apply            # Apply (local dev)
#   ./extract-seat-sizes.sh --env staging      # Preview (staging)
#   ./extract-seat-sizes.sh --env staging --apply  # Apply (staging)
#   ./extract-seat-sizes.sh --env production   # Preview (production)
#   ./extract-seat-sizes.sh --env production --apply  # Apply (production)
#
# Environment Variables (override defaults):
#   PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# scripts → postgres → production-data → relational → seeds → database → src → backend
BACKEND_ROOT="$(cd "$SCRIPT_DIR/../../../../../../.." && pwd)"

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
echo_env() { echo -e "${CYAN}[ENV]${NC} $1"; }

# Load DATABASE_* variables from an env file if present.
# Does NOT overwrite already-set variables (allows shell-level override).
load_env_file() {
    local env_file="$1"
    if [ ! -f "$env_file" ]; then
        return 0
    fi
    while IFS='=' read -r key value; do
        # skip comments and blank lines
        case "$key" in
            ''|\#*) continue ;;
        esac
        # strip leading whitespace
        key="${key## }"
        # only export DATABASE_* keys we care about
        case "$key" in
            DATABASE_HOST|DATABASE_PORT|DATABASE_USERNAME|DATABASE_PASSWORD|DATABASE_NAME)
                # strip surrounding quotes if any
                value="${value%\"}"; value="${value#\"}"
                value="${value%\'}"; value="${value#\'}"
                if [ -z "${!key:-}" ]; then
                    export "$key=$value"
                fi
                ;;
        esac
    done < "$env_file"
}

# Parse arguments
ENVIRONMENT="local"
APPLY_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --apply)
            APPLY_MODE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--env <environment>] [--apply]"
            echo ""
            echo "Environments:"
            echo "  local       Local dev (Docker: backend-postgres-1, port 5432)"
            echo "  legacy      Legacy container (Docker: oms_postgres_legacy, port 5433)"
            echo "  staging     Staging database (requires env vars or kubectl)"
            echo "  production  Production database (requires env vars or kubectl)"
            echo ""
            echo "Options:"
            echo "  --apply     Apply the extraction (default: preview only)"
            echo "  --help      Show this help"
            echo ""
            echo "Environment Variables (override defaults):"
            echo "  PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE"
            exit 0
            ;;
        *)
            echo_error "Unknown argument: $1"
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
            export CONTAINER_NAME="backend-postgres-1"
            export USE_DOCKER=true
            ;;
        legacy)
            # Legacy PostgreSQL container
            export PG_HOST="${PG_HOST:-127.0.0.1}"
            export PG_PORT="${PG_PORT:-5433}"
            export PG_USER="${PG_USER:-oms_user}"
            export PG_PASSWORD="${PG_PASSWORD:-oms_password}"
            export PG_DATABASE="${PG_DATABASE:-oms_legacy}"
            export CONTAINER_NAME="oms_postgres_legacy"
            export USE_DOCKER=true
            ;;
        staging)
            # Staging environment — DigitalOcean Managed PG (SSL required).
            # Defaults are READ FROM backend/.env.staging if present (do not hard-code).
            # Override any var by exporting it in the shell before running.
            load_env_file "$BACKEND_ROOT/.env.staging"
            export PG_HOST="${PG_HOST:-${DATABASE_HOST:-}}"
            export PG_PORT="${PG_PORT:-${DATABASE_PORT:-25060}}"
            export PG_USER="${PG_USER:-${DATABASE_USERNAME:-doadmin}}"
            export PG_PASSWORD="${PG_PASSWORD:-${DATABASE_PASSWORD:-}}"
            export PG_DATABASE="${PG_DATABASE:-${DATABASE_NAME:-oms-nest-staging}}"
            export PGSSLMODE="${PGSSLMODE:-require}"
            export USE_DOCKER=false
            if [ -z "$PG_HOST" ]; then
                echo_error "Staging requires PG_HOST (or DATABASE_HOST in .env.staging)"
                exit 1
            fi
            if [ -z "$PG_PASSWORD" ]; then
                echo_error "Staging requires PG_PASSWORD (or DATABASE_PASSWORD in .env.staging)"
                exit 1
            fi
            ;;
        production)
            # Production environment — DigitalOcean Managed PG (SSL required).
            # Defaults are READ FROM backend/.env.production if present.
            load_env_file "$BACKEND_ROOT/.env.production"
            export PG_HOST="${PG_HOST:-${DATABASE_HOST:-}}"
            export PG_PORT="${PG_PORT:-${DATABASE_PORT:-25060}}"
            export PG_USER="${PG_USER:-${DATABASE_USERNAME:-doadmin}}"
            export PG_PASSWORD="${PG_PASSWORD:-${DATABASE_PASSWORD:-}}"
            export PG_DATABASE="${PG_DATABASE:-${DATABASE_NAME:-oms-nest-production}}"
            export PGSSLMODE="${PGSSLMODE:-require}"
            export USE_DOCKER=false
            if [ -z "$PG_HOST" ]; then
                echo_error "Production requires PG_HOST (or DATABASE_HOST in .env.production)"
                exit 1
            fi
            if [ -z "$PG_PASSWORD" ]; then
                echo_error "Production requires PG_PASSWORD (or DATABASE_PASSWORD in .env.production)"
                exit 1
            fi
            ;;
        *)
            echo_error "Unknown environment: $ENVIRONMENT"
            echo "Valid environments: local, legacy, staging, production"
            exit 1
            ;;
    esac

    echo_env "Environment: $ENVIRONMENT"
    echo_env "Host: $PG_HOST:$PG_PORT"
    echo_env "Database: $PG_DATABASE"
    echo_env "User: $PG_USER"
    if [ "$USE_DOCKER" = true ]; then
        echo_env "Container: $CONTAINER_NAME"
    fi
}

# Execute SQL based on environment
execute_sql() {
    local sql=$1
    if [ "$USE_DOCKER" = true ]; then
        docker exec -i $CONTAINER_NAME psql -U $PG_USER -d $PG_DATABASE -c "$sql" 2>/dev/null
    else
        PGPASSWORD=$PG_PASSWORD psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DATABASE -c "$sql" 2>/dev/null
    fi
}

execute_sql_heredoc() {
    if [ "$USE_DOCKER" = true ]; then
        docker exec -i $CONTAINER_NAME psql -U $PG_USER -d $PG_DATABASE 2>/dev/null
    else
        PGPASSWORD=$PG_PASSWORD psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DATABASE 2>/dev/null
    fi
}

# Check PostgreSQL connection
check_postgres() {
    echo_info "Checking PostgreSQL connection..."
    if [ "$USE_DOCKER" = true ]; then
        if ! docker exec $CONTAINER_NAME pg_isready -U $PG_USER -d $PG_DATABASE >/dev/null 2>&1; then
            echo_error "PostgreSQL container '$CONTAINER_NAME' is not running."
            echo "For local dev: docker-compose up -d postgres"
            echo "For legacy: ./setup-postgres.sh"
            exit 1
        fi
    else
        if ! PGPASSWORD=$PG_PASSWORD pg_isready -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DATABASE >/dev/null 2>&1; then
            echo_error "Cannot connect to PostgreSQL at $PG_HOST:$PG_PORT"
            exit 1
        fi
    fi
    echo_info "PostgreSQL connection OK"
}

# Check if seat_sizes column exists
check_column() {
    echo_info "Checking seat_sizes column..."
    local result=$(execute_sql "SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='seat_sizes';" 2>/dev/null | grep -c "seat_sizes" || true)
    if [ "$result" -eq 0 ]; then
        echo_warn "seat_sizes column does not exist. Creating it..."
        execute_sql "ALTER TABLE orders ADD COLUMN IF NOT EXISTS seat_sizes JSONB DEFAULT NULL;"
        execute_sql "CREATE INDEX IF NOT EXISTS idx_orders_seat_sizes ON orders USING GIN (seat_sizes);"
        echo_info "Column created"
    else
        echo_info "seat_sizes column exists"
    fi
}

# Check if extraction functions exist
check_function() {
    echo_info "Checking extraction functions..."

    # Check orders_info function
    local result1=$(execute_sql "SELECT proname FROM pg_proc WHERE proname='get_seat_size_from_orders_info';" 2>/dev/null | grep -c "get_seat_size_from_orders_info" || true)
    if [ "$result1" -eq 0 ]; then
        echo_warn "get_seat_size_from_orders_info function does not exist. Creating it..."
        create_orders_info_function
    else
        echo_info "get_seat_size_from_orders_info function exists"
    fi

    # Check special_notes function
    local result2=$(execute_sql "SELECT proname FROM pg_proc WHERE proname='extract_seat_sizes';" 2>/dev/null | grep -c "extract_seat_sizes" || true)
    if [ "$result2" -eq 0 ]; then
        echo_warn "extract_seat_sizes function does not exist. Creating it..."
        create_special_notes_function
    else
        echo_info "extract_seat_sizes function exists"
    fi
}

# Create function to extract from orders_info table (PRIMARY source)
create_orders_info_function() {
    echo_step "Creating get_seat_size_from_orders_info function..."

    execute_sql_heredoc <<'EOSQL'
CREATE OR REPLACE FUNCTION get_seat_size_from_orders_info(p_order_id INTEGER)
RETURNS JSONB AS $$
DECLARE
    result TEXT[] := '{}';
    size_name TEXT;
BEGIN
    -- Get seat size from orders_info (option_id = 1 is 'Seat Size')
    -- Join with options_items to get the actual size value
    FOR size_name IN
        SELECT oi2.name
        FROM orders_info oi
        JOIN options_items oi2 ON oi.option_item_id = oi2.id
        WHERE oi.order_id = p_order_id
          AND oi.option_id = 1
          AND oi2.option_id = 1
    LOOP
        IF size_name IS NOT NULL AND TRIM(size_name) != '' THEN
            -- Normalize to European notation (comma decimal)
            size_name := REPLACE(size_name, '.', ',');
            IF NOT size_name = ANY(result) THEN
                result := array_append(result, size_name);
            END IF;
        END IF;
    END LOOP;

    IF array_length(result, 1) IS NULL OR array_length(result, 1) = 0 THEN
        RETURN NULL;
    END IF;

    RETURN to_jsonb(result);
END;
$$ LANGUAGE plpgsql STABLE;
EOSQL

    echo_info "Function created"
}

# Create function to extract from special_notes (FALLBACK source)
create_special_notes_function() {
    echo_step "Creating extract_seat_sizes function..."

    execute_sql_heredoc <<'EOSQL'
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
        SELECT (regexp_matches(LOWER(notes), 'seat\s*size[:\s]+(\d{1,2}(?:[.,]\d)?)', 'gi'))[1] AS size
    LOOP
        size_value := match_record.size;
        normalized_size := REPLACE(size_value, '.', ',');
        IF NOT normalized_size = ANY(result) THEN
            result := array_append(result, normalized_size);
        END IF;
    END LOOP;

    -- Pattern 2: "X.X seat" or "X seat" (not followed by "size")
    FOR match_record IN
        SELECT (regexp_matches(LOWER(notes), '(\d{1,2}(?:[.,]\d)?)\s*seat(?!\s*size)', 'gi'))[1] AS size
    LOOP
        size_value := match_record.size;
        normalized_size := REPLACE(size_value, '.', ',');
        IF NOT normalized_size = ANY(result) THEN
            result := array_append(result, normalized_size);
        END IF;
    END LOOP;

    -- Pattern 3: X.X" or X.X inch (14-20 range for valid saddle sizes)
    FOR match_record IN
        SELECT (regexp_matches(notes, '(\d{1,2}(?:[.,]\d)?)\s*(?:"|''''|inch)', 'gi'))[1] AS size
    LOOP
        size_value := match_record.size;
        BEGIN
            IF REPLACE(size_value, ',', '.')::NUMERIC BETWEEN 14 AND 20 THEN
                normalized_size := REPLACE(size_value, '.', ',');
                IF NOT normalized_size = ANY(result) THEN
                    result := array_append(result, normalized_size);
                END IF;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore invalid numbers
        END;
    END LOOP;

    -- Pattern 4: "stamped X.X" (14-20 range)
    FOR match_record IN
        SELECT (regexp_matches(LOWER(notes), 'stamped(?:\s+in)?\s+(\d{1,2}(?:[.,]\d)?)', 'gi'))[1] AS size
    LOOP
        size_value := match_record.size;
        BEGIN
            IF REPLACE(size_value, ',', '.')::NUMERIC BETWEEN 14 AND 20 THEN
                normalized_size := REPLACE(size_value, '.', ',');
                IF NOT normalized_size = ANY(result) THEN
                    result := array_append(result, normalized_size);
                END IF;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore invalid numbers
        END;
    END LOOP;

    IF array_length(result, 1) IS NULL OR array_length(result, 1) = 0 THEN
        RETURN NULL;
    END IF;

    RETURN to_jsonb(result);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
EOSQL

    echo_info "Function created"
}

# Preview extraction
preview() {
    echo ""
    echo "=============================================="
    echo "Source 1: orders_info table (PRIMARY)"
    echo "=============================================="

    execute_sql "
        SELECT
            o.id,
            get_seat_size_from_orders_info(o.id) AS seat_size
        FROM orders o
        WHERE get_seat_size_from_orders_info(o.id) IS NOT NULL
        LIMIT 10;
    "

    echo ""
    echo "=============================================="
    echo "Source 2: special_notes field (FALLBACK)"
    echo "=============================================="

    execute_sql "
        SELECT
            id,
            SUBSTRING(special_notes FROM 1 FOR 50) AS notes_preview,
            extract_seat_sizes(special_notes) AS extracted
        FROM orders
        WHERE extract_seat_sizes(special_notes) IS NOT NULL
        LIMIT 10;
    "

    echo ""
    echo "=============================================="
    echo "Statistics"
    echo "=============================================="

    execute_sql "
        SELECT
            COUNT(DISTINCT oi.order_id) AS from_orders_info,
            COUNT(*) FILTER (WHERE extract_seat_sizes(o.special_notes) IS NOT NULL) AS from_special_notes,
            COUNT(*) FILTER (WHERE o.seat_sizes IS NOT NULL) AS already_populated,
            COUNT(*) AS total_orders
        FROM orders o
        LEFT JOIN orders_info oi ON o.id = oi.order_id AND oi.option_id = 1;
    "
}

# Apply extraction
apply() {
    echo ""
    echo_step "Step 1: Extracting from orders_info table (PRIMARY source)..."

    execute_sql "
        UPDATE orders o
        SET seat_sizes = get_seat_size_from_orders_info(o.id)
        WHERE get_seat_size_from_orders_info(o.id) IS NOT NULL
          AND (o.seat_sizes IS NULL OR o.seat_sizes = '[]'::jsonb);
    "

    echo_info "orders_info extraction complete"

    echo ""
    echo_step "Step 2: Extracting from special_notes (FALLBACK for remaining orders)..."

    execute_sql "
        UPDATE orders
        SET seat_sizes = extract_seat_sizes(special_notes)
        WHERE extract_seat_sizes(special_notes) IS NOT NULL
          AND (seat_sizes IS NULL OR seat_sizes = '[]'::jsonb);
    "

    echo_info "special_notes extraction complete"

    echo ""
    echo "=============================================="
    echo "Results"
    echo "=============================================="

    execute_sql "
        SELECT
            COUNT(*) FILTER (WHERE seat_sizes IS NOT NULL) AS orders_with_seat_sizes,
            COUNT(*) AS total_orders,
            ROUND(100.0 * COUNT(*) FILTER (WHERE seat_sizes IS NOT NULL) / COUNT(*), 1) AS percentage
        FROM orders;
    "

    echo ""
    echo_step "Seat size distribution:"
    execute_sql "
        SELECT seat_sizes, COUNT(*) as count
        FROM orders
        WHERE seat_sizes IS NOT NULL
        GROUP BY seat_sizes
        ORDER BY count DESC
        LIMIT 15;
    "
}

# Main
main() {
    echo ""
    echo "=============================================="
    echo "  Seat Size Extraction Script"
    echo "=============================================="
    echo ""

    configure_environment
    echo ""

    check_postgres
    check_column
    check_function

    if [ "$APPLY_MODE" = true ]; then
        preview
        echo ""
        if [ "$ENVIRONMENT" = "production" ]; then
            echo_warn "⚠️  PRODUCTION DATABASE - This will modify data!"
            echo_warn "Type 'yes' to confirm:"
            read -r confirmation
            if [ "$confirmation" != "yes" ]; then
                echo_info "Aborted."
                exit 0
            fi
        else
            echo_warn "Applying extraction in 3 seconds... (Ctrl+C to cancel)"
            sleep 3
        fi
        apply
    else
        preview
        echo ""
        echo_info "This was a preview. To apply changes, run:"
        echo "  ./extract-seat-sizes.sh --env $ENVIRONMENT --apply"
    fi
}

main "$@"
