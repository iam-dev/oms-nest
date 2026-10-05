#!/bin/bash
# =============================================================================
# PostgreSQL Legacy Database Setup Script
# =============================================================================
# This script sets up a fresh PostgreSQL database using Docker for legacy data validation
#
# Usage:
#   ./setup-postgres.sh           # Start PostgreSQL and wait for ready
#   ./setup-postgres.sh --clean   # Remove existing container and start fresh
#
# After running:
#   - PostgreSQL will be available at: localhost:5433
#   - Database: oms_legacy
#   - User: oms_user / Password: oms_password
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_HOST="127.0.0.1"
PG_PORT="5433"
PG_USER="oms_user"
PG_PASSWORD="oms_password"
PG_DATABASE="oms_legacy"
CONTAINER_NAME="oms_postgres_legacy"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
echo_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        echo_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    echo_info "Docker is running"
}

# Clean up existing container if --clean flag is passed
cleanup() {
    if [ "$1" == "--clean" ]; then
        echo_warn "Cleaning up existing container and volumes..."
        docker-compose -f "$SCRIPT_DIR/docker-compose.yml" down -v 2>/dev/null || true
        docker rm -f $CONTAINER_NAME 2>/dev/null || true
        echo_info "Cleanup complete"
    fi
}

# Start PostgreSQL container
start_postgres() {
    echo_info "Starting PostgreSQL container..."
    cd "$SCRIPT_DIR"
    docker-compose up -d

    echo_info "Waiting for PostgreSQL to be ready..."
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker exec $CONTAINER_NAME pg_isready -U $PG_USER -d $PG_DATABASE >/dev/null 2>&1; then
            echo_info "PostgreSQL is ready!"
            return 0
        fi
        echo "  Attempt $attempt/$max_attempts - waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo_error "PostgreSQL failed to start within timeout"
    exit 1
}

# Display connection info
show_connection_info() {
    echo ""
    echo "=============================================="
    echo -e "${GREEN}PostgreSQL Legacy Database is Ready!${NC}"
    echo "=============================================="
    echo "Connection Details:"
    echo "  Host:     $PG_HOST"
    echo "  Port:     $PG_PORT"
    echo "  Database: $PG_DATABASE"
    echo "  User:     $PG_USER"
    echo "  Password: $PG_PASSWORD"
    echo ""
    echo "Connect with:"
    echo "  PGPASSWORD=$PG_PASSWORD psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DATABASE"
    echo ""
    echo "Or use Docker:"
    echo "  docker exec -it $CONTAINER_NAME psql -U $PG_USER -d $PG_DATABASE"
    echo ""
    echo "Next steps:"
    echo "  1. Run: ./import-data.sh     # Import all legacy data"
    echo "  2. Run: ./validate-data.sh   # Validate the imported data"
    echo "=============================================="
}

# Main execution
main() {
    check_docker
    cleanup "$1"
    start_postgres
    show_connection_info
}

main "$@"
