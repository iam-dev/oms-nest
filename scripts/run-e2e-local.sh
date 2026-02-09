#!/bin/bash
# =============================================================================
# Local E2E Test Runner (Docker-based)
# =============================================================================
# Runs Playwright E2E tests locally using isolated Docker infrastructure.
# Playwright's webServer config auto-starts the backend and frontend on the host.
#
# Usage:
#   ./scripts/run-e2e-local.sh                  # Run chromium tests, teardown after
#   ./scripts/run-e2e-local.sh --keep           # Keep infra running for debugging
#   ./scripts/run-e2e-local.sh --all-browsers   # Run all browser projects
#   ./scripts/run-e2e-local.sh --headed         # Run with visible browser
#
# Skip in pre-push hook:
#   SKIP_E2E=1 git push
# =============================================================================

set -e

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
E2E_DIR="$PROJECT_ROOT/e2e"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.e2e.yml"

# Docker container names (must match docker-compose.e2e.yml)
PG_CONTAINER="oms_e2e_postgres"
REDIS_CONTAINER="oms_e2e_redis"

# Database configuration (must match docker-compose.e2e.yml)
DB_HOST="localhost"
DB_PORT="5433"
DB_USER="oms"
DB_PASSWORD="oms_e2e_password" # gitleaks:allow (local-only test password)
DB_NAME="oms_e2e"
REDIS_PORT="6380"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
echo_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }
echo_step()  { echo -e "${BLUE}[STEP]${NC} $1"; }

# Parse arguments
KEEP_INFRA=false
ALL_BROWSERS=false
HEADED=""
EXTRA_ARGS=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --keep)
      KEEP_INFRA=true
      shift
      ;;
    --all-browsers)
      ALL_BROWSERS=true
      shift
      ;;
    --headed)
      HEADED="--headed"
      shift
      ;;
    *)
      EXTRA_ARGS="$EXTRA_ARGS $1"
      shift
      ;;
  esac
done

# Track elapsed time
START_TIME=$(date +%s)
elapsed() {
  local now=$(date +%s)
  local diff=$((now - START_TIME))
  printf "%dm%02ds" $((diff / 60)) $((diff % 60))
}

# Cleanup function
cleanup() {
  local exit_code=$?
  if [ "$KEEP_INFRA" = true ]; then
    echo ""
    echo_info "Keeping infrastructure running (--keep flag)"
    echo_info "PostgreSQL: postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
    echo_info "Redis: redis://$DB_HOST:$REDIS_PORT"
    echo_info "To stop: docker compose -f docker-compose.e2e.yml down -v"
  else
    echo ""
    echo_step "Tearing down E2E infrastructure..."
    cd "$PROJECT_ROOT"
    docker compose -f "$COMPOSE_FILE" down -v --remove-orphans 2>/dev/null || true
    echo_info "Infrastructure removed"
  fi
  echo ""
  if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}E2E tests completed successfully in $(elapsed)${NC}"
  else
    echo -e "${RED}E2E tests failed after $(elapsed)${NC}"
  fi
  exit $exit_code
}

trap cleanup EXIT

# =============================================================================
# Step 1: Check ports are free
# =============================================================================
echo ""
echo "=============================================="
echo "  Local E2E Test Runner"
echo "=============================================="
echo ""

echo_step "Checking ports are free..."

check_port() {
  local port=$1
  local service=$2
  if lsof -i ":$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo_error "Port $port is in use ($service). Stop any running dev servers first."
    echo_error "  lsof -i :$port  # to see what's using it"
    exit 1
  fi
}

check_port 3000 "frontend"
check_port 3001 "backend"
echo_info "Ports 3000 and 3001 are free"

# =============================================================================
# Step 2: Start Docker infrastructure (clean slate)
# =============================================================================
echo_step "Starting E2E Docker infrastructure..."
cd "$PROJECT_ROOT"
docker compose -f "$COMPOSE_FILE" down -v --remove-orphans 2>/dev/null || true
docker compose -f "$COMPOSE_FILE" up -d

# =============================================================================
# Step 3: Wait for services to be ready
# =============================================================================
echo_step "Waiting for PostgreSQL to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=1
while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  if docker exec $PG_CONTAINER pg_isready -U $DB_USER -d $DB_NAME >/dev/null 2>&1; then
    echo_info "PostgreSQL is ready"
    break
  fi
  if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo_error "PostgreSQL failed to become ready after $MAX_ATTEMPTS attempts"
    exit 1
  fi
  echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS - waiting..."
  sleep 2
  ATTEMPT=$((ATTEMPT + 1))
done

echo_step "Waiting for Redis to be ready..."
ATTEMPT=1
MAX_ATTEMPTS=15
while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  if docker exec $REDIS_CONTAINER redis-cli ping >/dev/null 2>&1; then
    echo_info "Redis is ready"
    break
  fi
  if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo_error "Redis failed to become ready after $MAX_ATTEMPTS attempts"
    exit 1
  fi
  echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS - waiting..."
  sleep 1
  ATTEMPT=$((ATTEMPT + 1))
done

# =============================================================================
# Step 4: Install PostgreSQL extensions
# =============================================================================
echo_step "Installing PostgreSQL extensions..."
docker exec -i $PG_CONTAINER psql -U $DB_USER -d $DB_NAME <<EOF
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
EOF
echo_info "Extensions installed"

# =============================================================================
# Step 5: Run migrations
# =============================================================================
echo_step "Running TypeORM migrations..."
cd "$BACKEND_DIR"

# Bypass env-cmd — pass E2E database config directly (same pattern as setup-e2e.sh)
DATABASE_HOST=$DB_HOST \
DATABASE_PORT=$DB_PORT \
DATABASE_USERNAME=$DB_USER \
DATABASE_PASSWORD=$DB_PASSWORD \
DATABASE_NAME=$DB_NAME \
DATABASE_TYPE=postgres \
NODE_ENV=test \
npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js \
    --dataSource=src/database/data-source.ts migration:run

echo_info "Migrations complete"

# =============================================================================
# Step 6: Run seeds
# =============================================================================
echo_step "Seeding database..."
cd "$BACKEND_DIR"

DATABASE_HOST=$DB_HOST \
DATABASE_PORT=$DB_PORT \
DATABASE_USERNAME=$DB_USER \
DATABASE_PASSWORD=$DB_PASSWORD \
DATABASE_NAME=$DB_NAME \
DATABASE_TYPE=postgres \
NODE_ENV=test \
npx ts-node -r tsconfig-paths/register ./src/database/seeds/relational/run-seed.ts

echo_info "Seeding complete"

# =============================================================================
# Step 7: Run Playwright E2E tests
# =============================================================================
echo_step "Running Playwright E2E tests..."
cd "$E2E_DIR"

# Build the project args
PROJECT_ARGS=""
if [ "$ALL_BROWSERS" = false ]; then
  PROJECT_ARGS="--project=chromium"
fi

# Export all env vars so Playwright's webServer inherits them for backend/frontend
export ENVIRONMENT=local
export NODE_ENV=test
export DATABASE_TYPE=postgres
export DATABASE_HOST=$DB_HOST
export DATABASE_PORT=$DB_PORT
export DATABASE_USERNAME=$DB_USER
export DATABASE_PASSWORD=$DB_PASSWORD
export DATABASE_NAME=$DB_NAME
export AUTH_JWT_SECRET=e2e-local-jwt-secret
export AUTH_JWT_TOKEN_EXPIRES_IN=7d
export AUTH_REFRESH_SECRET=e2e-local-refresh-secret
export AUTH_REFRESH_TOKEN_EXPIRES_IN=3650d
export AUTH_FORGOT_SECRET=e2e-local-forgot-secret
export AUTH_FORGOT_TOKEN_EXPIRES_IN=30m
export AUTH_CONFIRM_EMAIL_SECRET=e2e-local-confirm-email-secret
export AUTH_CONFIRM_EMAIL_TOKEN_EXPIRES_IN=1d
export REDIS_HOST=localhost
export REDIS_PORT=$REDIS_PORT
export MAIL_HOST=localhost
export MAIL_PORT=1025
export MAIL_USER=
export MAIL_PASSWORD=
export MAIL_IGNORE_TLS=true
export MAIL_SECURE=false
export MAIL_REQUIRE_TLS=false
export MAIL_DEFAULT_EMAIL=noreply@example.com
export MAIL_DEFAULT_NAME=Api
export MAIL_CLIENT_PORT=1080
export FILE_DRIVER=local
export APP_PORT=3001

# Run Playwright
set +e
npx playwright test $PROJECT_ARGS $HEADED $EXTRA_ARGS
TEST_EXIT_CODE=$?
set -e

exit $TEST_EXIT_CODE
