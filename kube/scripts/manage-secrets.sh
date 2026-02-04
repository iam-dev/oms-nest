#!/usr/bin/env bash
#
# manage-secrets.sh - Secure secret management for OMS Kubernetes deployments
#
# Usage:
#   ./manage-secrets.sh seal   <namespace> <env-file> [--name <secret-name>] [--output <dir>]
#   ./manage-secrets.sh create <namespace> <env-file> [--name <secret-name>]
#   ./manage-secrets.sh rotate <namespace>            [--name <secret-name>] [--output <dir>]
#   ./manage-secrets.sh verify <namespace>            [--name <secret-name>]
#   ./manage-secrets.sh audit  <namespace>
#
# Options:
#   --name <name>    Override the Kubernetes secret name (default: oms-nest-secrets)
#   --output <dir>   Override the output directory for sealed YAML (default: kube/helm/oms-nest)
#
# Examples:
#   ./manage-secrets.sh seal   oms-nest-staging  secrets.env
#   ./manage-secrets.sh create oms-nest-staging  secrets.env
#   ./manage-secrets.sh verify oms-nest-production
#   ./manage-secrets.sh seal   oms-staging-v2 kube/secrets.env --name oms-app-secrets --output kubernetes/staging-v2
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="${SCRIPT_DIR}/../helm/oms-nest"

SECRET_NAME="oms-nest-secrets"
SEALED_SECRETS_CONTROLLER="sealed-secrets-controller"
SEALED_SECRETS_NS="kube-system"

# Required secret keys for the application
REQUIRED_KEYS=(
  DATABASE_HOST DATABASE_PORT DATABASE_USERNAME DATABASE_PASSWORD
  DATABASE_NAME DATABASE_SSL_ENABLED
  AUTH_JWT_SECRET AUTH_JWT_TOKEN_EXPIRES_IN
  AUTH_REFRESH_SECRET AUTH_REFRESH_TOKEN_EXPIRES_IN
  REDIS_HOST REDIS_PORT REDIS_PASSWORD
  MAIL_HOST MAIL_PORT MAIL_USER MAIL_PASSWORD
  MAIL_DEFAULT_EMAIL MAIL_DEFAULT_NAME
  ENCRYPTION_SECRET
)

log()  { echo "[INFO]  $*"; }
warn() { echo "[WARN]  $*" >&2; }
err()  { echo "[ERROR] $*" >&2; exit 1; }

# Parse --name and --output flags from remaining arguments
# Sets SECRET_NAME and OUTPUT_DIR as side effects
parse_flags() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --name)
        [[ $# -ge 2 ]] || err "--name requires a value"
        SECRET_NAME="$2"; shift 2 ;;
      --output)
        [[ $# -ge 2 ]] || err "--output requires a value"
        OUTPUT_DIR="$2"; shift 2 ;;
      *)
        err "Unknown flag: $1" ;;
    esac
  done
}

check_deps() {
  for cmd in kubectl; do
    command -v "$cmd" >/dev/null 2>&1 || err "'$cmd' is required but not installed"
  done
}

check_seal_deps() {
  command -v kubeseal >/dev/null 2>&1 || err "'kubeseal' is required. Install: brew install kubeseal"
}

# Load a .env file into an associative array, skipping comments and blank lines
load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || err "Environment file not found: $file"

  # Validate no obvious plaintext leaks in the file path itself
  if [[ "$file" == *".git/"* ]]; then
    err "Refusing to load secrets from inside .git directory"
  fi

  local -n _map=$2
  while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
    # Trim whitespace
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    # Remove surrounding quotes
    value="${value#\"}"
    value="${value%\"}"
    value="${value#\'}"
    value="${value%\'}"
    _map["$key"]="$value"
  done < "$file"
}

validate_keys() {
  local -n _secrets=$1
  local missing=()
  for key in "${REQUIRED_KEYS[@]}"; do
    if [[ -z "${_secrets[$key]:-}" ]]; then
      missing+=("$key")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    warn "Missing required keys: ${missing[*]}"
    return 1
  fi
  log "All required keys present"
  return 0
}

cmd_seal() {
  local namespace="$1"
  local env_file="$2"
  shift 2
  parse_flags "$@"
  check_seal_deps

  declare -A secrets
  load_env_file "$env_file" secrets
  validate_keys secrets || err "Cannot seal: missing required keys"

  log "Fetching sealed-secrets public cert..."
  local cert_file
  cert_file=$(mktemp /tmp/sealed-secrets-cert-XXXXXX.pem)
  trap "rm -f '$cert_file'" EXIT

  kubeseal --fetch-cert \
    --controller-name="$SEALED_SECRETS_CONTROLLER" \
    --controller-namespace="$SEALED_SECRETS_NS" \
    > "$cert_file"

  log "Creating raw secret and sealing..."
  local from_literal_args=()
  for key in "${!secrets[@]}"; do
    from_literal_args+=("--from-literal=${key}=${secrets[$key]}")
  done

  local dest_dir="${OUTPUT_DIR:-$CHART_DIR}"
  local output_file="${dest_dir}/sealed-secret.yaml"
  mkdir -p "$dest_dir"

  kubectl create secret generic "$SECRET_NAME" \
    --namespace="$namespace" \
    "${from_literal_args[@]}" \
    --dry-run=client -o yaml | \
  kubeseal --cert "$cert_file" \
    --controller-name="$SEALED_SECRETS_CONTROLLER" \
    --controller-namespace="$SEALED_SECRETS_NS" \
    --scope namespace-wide \
    --format yaml \
    > "$output_file"

  log "Sealed secret written to: $output_file"
  log "This file is safe to commit to Git."
  log "Apply with: kubectl apply -f $output_file"
}

cmd_create() {
  local namespace="$1"
  local env_file="$2"
  shift 2
  parse_flags "$@"

  declare -A secrets
  load_env_file "$env_file" secrets
  validate_keys secrets || warn "Proceeding with missing keys..."

  local from_literal_args=()
  for key in "${!secrets[@]}"; do
    from_literal_args+=("--from-literal=${key}=${secrets[$key]}")
  done

  log "Creating secret '$SECRET_NAME' in namespace '$namespace'..."
  kubectl create secret generic "$SECRET_NAME" \
    --namespace="$namespace" \
    "${from_literal_args[@]}" \
    --dry-run=client -o yaml | kubectl apply -f -

  log "Secret created/updated successfully"
}

cmd_rotate() {
  local namespace="$1"
  shift 1
  parse_flags "$@"
  check_seal_deps

  log "Fetching current secret values from cluster..."
  local raw
  raw=$(kubectl get secret "$SECRET_NAME" -n "$namespace" -o json 2>/dev/null) \
    || err "Secret '$SECRET_NAME' not found in namespace '$namespace'"

  log "Fetching new sealed-secrets certificate..."
  local cert_file
  cert_file=$(mktemp /tmp/sealed-secrets-cert-XXXXXX.pem)
  trap "rm -f '$cert_file'" EXIT

  kubeseal --fetch-cert \
    --controller-name="$SEALED_SECRETS_CONTROLLER" \
    --controller-namespace="$SEALED_SECRETS_NS" \
    > "$cert_file"

  log "Re-sealing with new certificate..."
  local dest_dir="${OUTPUT_DIR:-$CHART_DIR}"
  local output_file="${dest_dir}/sealed-secret.yaml"
  mkdir -p "$dest_dir"

  echo "$raw" | \
  kubeseal --cert "$cert_file" \
    --controller-name="$SEALED_SECRETS_CONTROLLER" \
    --controller-namespace="$SEALED_SECRETS_NS" \
    --scope namespace-wide \
    --format yaml \
    > "$output_file"

  log "Rotated sealed secret written to: $output_file"
}

cmd_verify() {
  local namespace="$1"
  shift 1
  parse_flags "$@"

  log "Verifying secrets in namespace '$namespace'..."

  # Check the secret exists
  if ! kubectl get secret "$SECRET_NAME" -n "$namespace" >/dev/null 2>&1; then
    err "Secret '$SECRET_NAME' not found in namespace '$namespace'"
  fi
  log "Secret '$SECRET_NAME' exists"

  # Check that all required keys are present
  local existing_keys
  existing_keys=$(kubectl get secret "$SECRET_NAME" -n "$namespace" \
    -o jsonpath='{.data}' | python3 -c "import sys,json; print(' '.join(json.load(sys.stdin).keys()))" 2>/dev/null || true)

  local missing=()
  for key in "${REQUIRED_KEYS[@]}"; do
    if ! echo "$existing_keys" | grep -qw "$key"; then
      missing+=("$key")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    warn "Missing keys in cluster secret: ${missing[*]}"
  else
    log "All ${#REQUIRED_KEYS[@]} required keys are present"
  fi

  # Check ghcr-credentials
  if kubectl get secret ghcr-credentials -n "$namespace" >/dev/null 2>&1; then
    log "Registry credentials (ghcr-credentials) exist"
  else
    warn "Registry credentials (ghcr-credentials) NOT found"
  fi

  log "Verification complete for namespace '$namespace'"
}

cmd_audit() {
  local namespace="$1"

  log "Auditing secret access in namespace '$namespace'..."

  # List all secrets
  log "Secrets in namespace:"
  kubectl get secrets -n "$namespace" --no-headers 2>/dev/null | while read -r line; do
    echo "  $line"
  done

  # Check RBAC bindings
  log "RoleBindings in namespace:"
  kubectl get rolebindings -n "$namespace" --no-headers 2>/dev/null | while read -r line; do
    echo "  $line"
  done

  # Check which pods mount the secret
  log "Pods referencing secrets:"
  kubectl get pods -n "$namespace" -o json 2>/dev/null | \
    python3 -c "
import sys, json
data = json.load(sys.stdin)
for pod in data.get('items', []):
  name = pod['metadata']['name']
  for c in pod['spec'].get('containers', []) + pod['spec'].get('initContainers', []):
    for ef in c.get('envFrom', []):
      ref = ef.get('secretRef', {}).get('name', '')
      if ref:
        print(f'  {name} -> {ref}')
" 2>/dev/null || warn "Could not inspect pods"

  log "Audit complete"
}

# --- Main ---
check_deps

case "${1:-help}" in
  seal)
    [[ $# -ge 3 ]] || err "Usage: $0 seal <namespace> <env-file> [--name <name>] [--output <dir>]"
    cmd_seal "$2" "$3" "${@:4}"
    ;;
  create)
    [[ $# -ge 3 ]] || err "Usage: $0 create <namespace> <env-file> [--name <name>]"
    cmd_create "$2" "$3" "${@:4}"
    ;;
  rotate)
    [[ $# -ge 2 ]] || err "Usage: $0 rotate <namespace> [--name <name>] [--output <dir>]"
    cmd_rotate "$2" "${@:3}"
    ;;
  verify)
    [[ $# -ge 2 ]] || err "Usage: $0 verify <namespace> [--name <name>]"
    cmd_verify "$2" "${@:3}"
    ;;
  audit)
    [[ $# -ge 2 ]] || err "Usage: $0 audit <namespace>"
    cmd_audit "$2"
    ;;
  help|--help|-h)
    head -25 "$0" | grep '^#' | sed 's/^# \?//'
    ;;
  *)
    err "Unknown command: $1. Use '$0 help' for usage."
    ;;
esac
