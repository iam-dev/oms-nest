#!/bin/bash
# =============================================================================
# MySQL Legacy Database Setup Script
# =============================================================================
# This script sets up a fresh MySQL database using Docker for legacy data validation
#
# Usage:
#   ./setup-mysql.sh           # Start MySQL and wait for ready
#   ./setup-mysql.sh --clean   # Remove existing container and start fresh
#
# After running:
#   - MySQL will be available at: localhost:3307
#   - Database: oms_legacy
#   - User: oms_user / Password: oms_password
#   - Root password: root_password
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

# Start MySQL container
start_mysql() {
    echo_info "Starting MySQL container..."
    cd "$SCRIPT_DIR"
    docker-compose up -d

    echo_info "Waiting for MySQL to be ready..."
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        # TCP on purpose: the image's temporary init server only listens on the socket,
        # so a socket ping reports "ready" before the real server is up.
        if docker exec $CONTAINER_NAME mysqladmin ping -h 127.0.0.1 --protocol=TCP -u root -proot_password --silent 2>/dev/null; then
            echo_info "MySQL is ready!"
            return 0
        fi
        echo "  Attempt $attempt/$max_attempts - waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo_error "MySQL failed to start within timeout"
    exit 1
}

# Display connection info
show_connection_info() {
    echo ""
    echo "=============================================="
    echo -e "${GREEN}MySQL Legacy Database is Ready!${NC}"
    echo "=============================================="
    echo "Connection Details:"
    echo "  Host:     $MYSQL_HOST"
    echo "  Port:     $MYSQL_PORT"
    echo "  Database: $MYSQL_DATABASE"
    echo "  User:     $MYSQL_USER"
    echo "  Password: $MYSQL_PASSWORD"
    echo ""
    echo "Connect with:"
    echo "  mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE"
    echo ""
    echo "Or use Docker:"
    echo "  docker exec -it $CONTAINER_NAME mysql -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE"
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
    start_mysql
    show_connection_info
}

main "$@"
