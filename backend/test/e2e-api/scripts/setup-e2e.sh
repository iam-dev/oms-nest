#!/bin/bash
# =============================================================================
# E2E API Test Setup Script
# =============================================================================
# This script sets up a fresh Docker environment for E2E API testing:
# 1. Stops any existing E2E containers
# 2. Starts fresh PostgreSQL, Redis, and MailDev containers
# 3. Waits for services to be ready
# 4. Runs TypeORM migrations
# 5. Seeds the database with production data
#
# Usage:
#   ./setup-e2e.sh              # Full setup
#   ./setup-e2e.sh --clean      # Clean up only
#   ./setup-e2e.sh --skip-seed  # Setup without seeding production data
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$(dirname "$(dirname "$E2E_DIR")")"
PROJECT_DIR="$(dirname "$BACKEND_DIR")"

# Docker Compose file
COMPOSE_FILE="$E2E_DIR/docker-compose.e2e.yaml"

# Database configuration
DB_HOST="127.0.0.1"
DB_PORT="5434"
DB_USER="oms_e2e_user"
DB_PASSWORD="oms_e2e_password"
DB_NAME="oms_e2e_test"
CONTAINER_NAME="oms_postgres_e2e"

# Production data location
PROD_DATA_DIR="$BACKEND_DIR/src/database/seeds/relational/production-data/postgres"

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

# Clean up existing containers
cleanup() {
    echo_step "Cleaning up existing E2E containers..."
    cd "$E2E_DIR"
    docker compose -f docker-compose.e2e.yaml down -v --remove-orphans 2>/dev/null || true
    echo_info "Cleanup complete"
}

# Start Docker containers
start_containers() {
    echo_step "Starting fresh E2E Docker containers..."
    cd "$E2E_DIR"
    docker compose -f docker-compose.e2e.yaml up -d
    echo_info "Containers started"
}

# Wait for PostgreSQL to be ready
wait_for_postgres() {
    echo_step "Waiting for PostgreSQL to be ready..."
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker exec $CONTAINER_NAME pg_isready -U $DB_USER -d $DB_NAME >/dev/null 2>&1; then
            echo_info "PostgreSQL is ready"
            return 0
        fi
        echo "  Attempt $attempt/$max_attempts - waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo_error "PostgreSQL failed to become ready"
    exit 1
}

# Wait for Redis to be ready
wait_for_redis() {
    echo_step "Waiting for Redis to be ready..."
    local max_attempts=15
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker exec oms_redis_e2e redis-cli ping >/dev/null 2>&1; then
            echo_info "Redis is ready"
            return 0
        fi
        echo "  Attempt $attempt/$max_attempts - waiting..."
        sleep 1
        attempt=$((attempt + 1))
    done

    echo_error "Redis failed to become ready"
    exit 1
}

# Install required PostgreSQL extensions
install_extensions() {
    echo_step "Installing PostgreSQL extensions..."
    docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME <<EOF
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
EOF
    echo_info "Extensions installed"
}

# Run TypeORM migrations
run_migrations() {
    echo_step "Running TypeORM migrations..."
    cd "$BACKEND_DIR"

    # Run TypeORM directly with E2E database configuration
    # Note: We bypass npm run migration:run because env-cmd reads from .env
    # which has development database settings (port 5432 instead of 5434)
    DATABASE_HOST=$DB_HOST \
    DATABASE_PORT=$DB_PORT \
    DATABASE_USERNAME=$DB_USER \
    DATABASE_PASSWORD=$DB_PASSWORD \
    DATABASE_NAME=$DB_NAME \
    DATABASE_TYPE=postgres \
    NODE_ENV=test \
    npx typeorm-ts-node-commonjs --dataSource=src/database/data-source.ts migration:run

    echo_info "Migrations complete"
}

# Seed the database with NestJS seed data
seed_nestjs_data() {
    echo_step "Seeding database with NestJS seed data..."
    cd "$BACKEND_DIR"

    # Run seed directly with E2E database configuration
    DATABASE_HOST=$DB_HOST \
    DATABASE_PORT=$DB_PORT \
    DATABASE_USERNAME=$DB_USER \
    DATABASE_PASSWORD=$DB_PASSWORD \
    DATABASE_NAME=$DB_NAME \
    DATABASE_TYPE=postgres \
    NODE_ENV=test \
    npx ts-node -r tsconfig-paths/register ./src/database/seeds/relational/run-seed.ts

    echo_info "NestJS seed data complete"
}

# Import production data from PostgreSQL dump files
import_production_data() {
    echo_step "Importing production data..."

    # Check if production data exists
    if [ ! -d "$PROD_DATA_DIR/schema" ] || [ ! -d "$PROD_DATA_DIR/data" ]; then
        echo_warn "Production data not found at $PROD_DATA_DIR"
        echo_warn "Skipping production data import. Using only NestJS seed data."
        return 0
    fi

    # Disable triggers for bulk import
    echo_info "Disabling triggers for bulk import..."
    docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "SET session_replication_role = 'replica';" 2>/dev/null

    # Import data files in order (skip schema since we use TypeORM migrations)
    echo_info "Importing production data files..."

    # System Admin Data
    import_sql_file "$PROD_DATA_DIR/data/system-admin/user-types.sql" "User Types"
    import_sql_file "$PROD_DATA_DIR/data/system-admin/statuses.sql" "Statuses"
    import_sql_file "$PROD_DATA_DIR/data/system-admin/credentials.sql" "Credentials"

    # Product Catalog Data
    import_sql_file "$PROD_DATA_DIR/data/product-catalog/brands.sql" "Brands"
    import_sql_file "$PROD_DATA_DIR/data/product-catalog/leather-types.sql" "Leather Types"
    import_sql_file "$PROD_DATA_DIR/data/product-catalog/options.sql" "Options"
    import_sql_file "$PROD_DATA_DIR/data/product-catalog/options-items.sql" "Options Items"
    import_sql_file "$PROD_DATA_DIR/data/product-catalog/saddles.sql" "Saddles"

    # Core Business Data
    import_sql_file "$PROD_DATA_DIR/data/core-business/factories.sql" "Factories"
    import_sql_file "$PROD_DATA_DIR/data/core-business/fitters.sql" "Fitters"
    import_sql_file "$PROD_DATA_DIR/data/core-business/customers.sql" "Customers"
    import_sql_file "$PROD_DATA_DIR/data/core-business/orders.sql" "Orders"

    # Relationship Data
    import_sql_file "$PROD_DATA_DIR/data/relationships/saddle-leathers.sql" "Saddle Leathers"
    import_sql_file "$PROD_DATA_DIR/data/relationships/orders-info.sql" "Orders Info (partial)"

    # Re-enable triggers
    echo_info "Re-enabling triggers..."
    docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "SET session_replication_role = 'origin';" 2>/dev/null

    # Update sequences
    update_sequences

    echo_info "Production data import complete"
}

# Helper function to import SQL file
import_sql_file() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        echo "  Importing: $description"
        docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < "$file" 2>/dev/null || true
    fi
}

# Update sequences after bulk import
update_sequences() {
    echo_info "Updating sequences..."
    docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME <<'EOF' 2>/dev/null || true
-- Update all sequences to match imported data
DO $$
DECLARE
    seq_name TEXT;
    table_name TEXT;
    col_name TEXT;
    max_val BIGINT;
BEGIN
    FOR seq_name, table_name, col_name IN
        SELECT
            pg_get_serial_sequence(c.table_name::text, c.column_name::text) as seq,
            c.table_name,
            c.column_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        AND pg_get_serial_sequence(c.table_name::text, c.column_name::text) IS NOT NULL
    LOOP
        EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I', col_name, table_name) INTO max_val;
        IF max_val > 0 THEN
            EXECUTE format('SELECT setval(%L, %s)', seq_name, max_val);
        END IF;
    END LOOP;
END;
$$;
EOF
}

# Show data statistics
show_statistics() {
    echo ""
    echo "=============================================="
    echo "E2E Test Database Statistics"
    echo "=============================================="

    docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME <<'EOF'
SELECT 'users' as table_name, COUNT(*) as count FROM "user"
UNION ALL SELECT 'roles', COUNT(*) FROM role
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'customers', COUNT(*) FROM customer
UNION ALL SELECT 'fitters', COUNT(*) FROM fitters
UNION ALL SELECT 'factories', COUNT(*) FROM factories
UNION ALL SELECT 'brands', COUNT(*) FROM brands
UNION ALL SELECT 'models', COUNT(*) FROM models
UNION ALL SELECT 'options', COUNT(*) FROM options
UNION ALL SELECT 'leathertypes', COUNT(*) FROM leather_type
ORDER BY table_name;
EOF

    echo ""
}

# Main execution
main() {
    echo ""
    echo "=============================================="
    echo "E2E API Test Environment Setup"
    echo "=============================================="
    echo ""

    case "$1" in
        --clean)
            cleanup
            echo_info "E2E environment cleaned up"
            exit 0
            ;;
        --skip-seed)
            cleanup
            start_containers
            wait_for_postgres
            wait_for_redis
            install_extensions
            run_migrations
            echo_info "E2E environment ready (without seed data)"
            ;;
        *)
            cleanup
            start_containers
            wait_for_postgres
            wait_for_redis
            install_extensions
            run_migrations
            seed_nestjs_data
            import_production_data
            show_statistics
            echo_info "E2E environment ready with production data!"
            ;;
    esac

    echo ""
    echo "=============================================="
    echo "Connection Details"
    echo "=============================================="
    echo "PostgreSQL: postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
    echo "Redis: redis://$DB_HOST:6380"
    echo ""
}

main "$@"
