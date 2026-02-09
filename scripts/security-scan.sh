#!/usr/bin/env bash
set -uo pipefail

# ─── Dirigent Security Scanner ─────────────────────────
# Usage:
#   scripts/security-scan.sh              # Full scan
#   scripts/security-scan.sh --staged     # Staged files only (pre-commit)
#   scripts/security-scan.sh --dir        # Directory scan only
#   scripts/security-scan.sh --full       # Everything (default)

SCAN_LEVEL="${1:---full}"
FAIL=0

echo ""
echo "🔐 Dirigent Security Scanner"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── Gitleaks ──────────────────────────────────────────

has_gitleaks() {
  command -v gitleaks >/dev/null 2>&1
}

run_gitleaks() {
  if ! has_gitleaks; then
    echo "⚠️  gitleaks not installed"
    echo "   macOS:  brew install gitleaks"
    echo "   Linux:  see https://github.com/gitleaks/gitleaks#installing"
    echo "   Skip:   set SKIP_GITLEAKS=1"
    return 0
  fi

  local MODE="$1"
  local LABEL="$2"

  echo ""
  echo "🔑 Gitleaks — $LABEL..."

  case "$MODE" in
    staged)
      OUTPUT=$(gitleaks git --pre-commit --staged --verbose --config="$(git rev-parse --show-toplevel)/.gitleaks.toml" 2>&1) || true
      ;;
    dir)
      OUTPUT=$(gitleaks dir --verbose --no-git --source . --config="$(git rev-parse --show-toplevel)/.gitleaks.toml" 2>&1) || true
      ;;
    history)
      OUTPUT=$(gitleaks git --verbose --config="$(git rev-parse --show-toplevel)/.gitleaks.toml" 2>&1) || true
      ;;
  esac

  if echo "$OUTPUT" | grep -q "no leaks found\|0 leaks"; then
    echo "   ✅ Clean"
    return 0
  elif echo "$OUTPUT" | grep -qi "leak\|finding\|secret"; then
    echo "   ❌ SECRETS DETECTED:"
    echo "$OUTPUT" | grep -E "Secret:|RuleID:|File:|Line:" | head -20 | sed 's/^/      /'
    FAIL=1
    return 1
  else
    echo "   ✅ Clean"
    return 0
  fi
}

# ─── Dependency Audit ──────────────────────────────────

run_audit() {
  echo ""
  echo "📦 Dependency audit..."

  local AUDIT_EXIT=0
  local OUTPUT
  OUTPUT=$(pnpm audit --audit-level=high 2>&1) || AUDIT_EXIT=$?

  if [ $AUDIT_EXIT -eq 0 ]; then
    echo "   ✅ No high/critical vulnerabilities"
  else
    local HIGH
    local CRIT
    HIGH=$(echo "$OUTPUT" | grep -ic "high" || echo "0")
    CRIT=$(echo "$OUTPUT" | grep -ic "critical" || echo "0")
    echo "   ⚠️  Vulnerabilities found: $HIGH high, $CRIT critical"
    echo "$OUTPUT" | grep -A2 -E "high|critical" | head -15 | sed 's/^/      /'
    # Audit is advisory, not blocking
  fi
}

# ─── Dangerous Code Patterns ──────────────────────────

run_pattern_scan() {
  echo ""
  echo "🔍 Code pattern scan..."

  local FOUND=0

  # Auto-detect source directories (supports monorepos and varied layouts)
  local SRC_DIRS=""
  for dir in src/ app/ lib/ packages/*/src/; do
    [ -d "$dir" ] && SRC_DIRS="$SRC_DIRS $dir"
  done
  SRC_DIRS=$(echo "$SRC_DIRS" | xargs)

  if [ -z "$SRC_DIRS" ]; then
    echo "   ⚠️  No source directories found (src/, app/, lib/, packages/*/src/), skipping"
    return 0
  fi

  scan() {
    local PATTERN="$1"
    local SEVERITY="$2"
    local DESC="$3"
    local RESULTS
    # shellcheck disable=SC2086 — intentional word splitting on SRC_DIRS
    RESULTS=$(grep -rn "$PATTERN" $SRC_DIRS \
      --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
      2>/dev/null \
      | grep -v "node_modules" \
      | grep -v "\.test\." \
      | grep -v "__mocks__" \
      | grep -v "\.spec\." \
      || true)

    if [ -n "$RESULTS" ]; then
      FOUND=$((FOUND + 1))
      local COUNT
      COUNT=$(echo "$RESULTS" | wc -l | tr -d ' ')
      echo "   $SEVERITY $DESC ($COUNT occurrence$([ "$COUNT" -gt 1 ] && echo 's'))"
      echo "$RESULTS" | head -3 | sed 's/^/         /'
      [ "$COUNT" -gt 3 ] && echo "         ... and $((COUNT - 3)) more"

      # Critical patterns block
      if [ "$SEVERITY" = "🔴" ]; then
        FAIL=1
      fi
    fi
  }

  # Critical — block on these
  scan 'eval(' '🔴' 'eval() — arbitrary code execution'
  scan 'new Function(' '🔴' 'new Function() — dynamic code execution'
  scan 'console\.log.*\(.*password\|console\.log.*secret\|console\.log.*token' '🔴' 'Logging sensitive data'

  # High — warn strongly
  scan 'dangerouslySetInnerHTML' '🟠' 'dangerouslySetInnerHTML — XSS risk'
  scan '\.innerHTML\s*=' '🟠' 'innerHTML assignment — XSS risk'
  scan 'document\.write' '🟠' 'document.write() — XSS risk'
  scan 'child_process' '🟡' 'child_process import — injection risk'
  scan 'exec(' '🟡' 'exec() — potential command injection'

  # Low — informational
  scan 'http://' '🔵' 'Insecure HTTP (should be HTTPS)'
  scan 'FIXME\|HACK\|XXX' '⚪' 'Code markers — review before ship'

  if [ $FOUND -eq 0 ]; then
    echo "   ✅ No dangerous patterns found"
  fi
}

# ─── Execute Based on Level ────────────────────────────

case "$SCAN_LEVEL" in
  --staged)
    run_gitleaks staged "scanning staged files"
    ;;
  --dir)
    run_gitleaks dir "scanning working directory"
    run_pattern_scan
    ;;
  --full|*)
    run_gitleaks staged "scanning staged files"
    run_gitleaks dir "scanning working directory"
    run_gitleaks history "scanning full git history"
    run_audit
    run_pattern_scan
    ;;
esac

# ─── Final Report ──────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FAIL -ne 0 ]; then
  echo "❌ Security scan FAILED — blocking issues found"
  echo "   Fix all 🔴 issues before proceeding."
  echo "   False positive? Add to .gitleaksignore"
  exit 1
else
  echo "✅ Security scan passed"
fi
