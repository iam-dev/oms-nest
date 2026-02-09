#!/usr/bin/env bash
# scripts/dirigent-memory.sh — Shell wrapper for Dirigent Memory
# Agents call this via Bash. Delegates to TypeScript implementation or
# falls back to a pure-SQLite implementation if ts-node isn't available.
#
# SECURITY: All user input is escaped via escape_sql() and passed through
# printf into sqlite3 .param set commands. Heredocs are avoided to prevent
# heredoc-termination attacks. SQL statements use quoted heredocs (<<'SQL')
# so no shell expansion occurs in the SQL itself.
#
# Usage:
#   bash scripts/dirigent-memory.sh store <type> <content> [--phase=X] [--agent=X] [--feature=X]
#   bash scripts/dirigent-memory.sh search <query> [--type=X] [--limit=N]
#   bash scripts/dirigent-memory.sh context <task-description>
#   bash scripts/dirigent-memory.sh stats
#
# Environment:
#   DIRIGENT_HOME — Override the Dirigent state directory (default: .dirigent or ~/.dirigent)

set -uo pipefail

# ─── Determine Dirigent home directory ────────────────────────────
# Priority: DIRIGENT_HOME env > ./.dirigent > ~/.dirigent
resolve_dirigent_home() {
  if [[ -n "${DIRIGENT_HOME:-}" ]]; then
    echo "$DIRIGENT_HOME"
  elif [[ -d ".dirigent" ]]; then
    echo ".dirigent"
  elif [[ -d "$HOME/.dirigent" ]]; then
    echo "$HOME/.dirigent"
  else
    # Default to project-local, will be created
    echo ".dirigent"
  fi
}

DIRIGENT_HOME_DIR=$(resolve_dirigent_home)
DB_PATH="$DIRIGENT_HOME_DIR/memory.db"
mkdir -p "$DIRIGENT_HOME_DIR"

CMD="${1:-help}"
shift 2>/dev/null || true

# ─── Check if TypeScript version is available ──────────
if command -v npx >/dev/null 2>&1 && [ -f "scripts/dirigent-memory.ts" ]; then
  # Try TypeScript version (full featured); fall back to SQLite if it fails
  npx ts-node scripts/dirigent-memory.ts "$CMD" "$@" 2>/dev/null && exit $?
fi

# ─── Pure SQLite Fallback (no Node.js needed) ──────────

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "⚠️ sqlite3 not found. Install SQLite3 or Node.js for full memory support."
  exit 1
fi

# ─── Input validation ──────────────────────────────────

VALID_TYPES="pattern|convention|decision|tech_debt|dependency|api_contract|error_pattern|performance|security|test_pattern|deployment|migration|review_finding|workaround|agent_communication|validation_request|consensus|custom"

validate_type() {
  local TYPE="$1"
  if ! echo "$TYPE" | grep -qE "^($VALID_TYPES)$"; then
    echo "❌ Invalid memory type: $TYPE"
    echo "   Valid types: $(echo "$VALID_TYPES" | tr '|' ', ')"
    exit 1
  fi
}

# Sanitize values: strip null bytes and control characters (but keep utf-8)
sanitize() {
  tr -d '\0' <<< "$1"
}

# Escape a value for use in sqlite3 .param set (double single quotes, strip newlines)
escape_sql() {
  printf '%s' "$1" | tr '\n' ' ' | sed "s/'/''/g"
}

# ─── Init database ─────────────────────────────────────

sqlite3 "$DB_PATH" "
  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    category TEXT DEFAULT '',
    content TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    phase TEXT DEFAULT '',
    agent TEXT DEFAULT '',
    feature TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    relevance_score REAL DEFAULT 1.0,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    content, type, category, tags, feature,
    content='memories', content_rowid='rowid',
    tokenize='porter unicode61'
  );
  CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, content, type, category, tags, feature)
    VALUES (new.rowid, new.content, new.type, new.category, new.tags, new.feature);
  END;
  CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, content, type, category, tags, feature)
    VALUES ('delete', old.rowid, old.content, old.type, old.category, old.tags, old.feature);
    INSERT INTO memories_fts(rowid, content, type, category, tags, feature)
    VALUES (new.rowid, new.content, new.type, new.category, new.tags, new.feature);
  END;
" 2>/dev/null

# Parse named args
get_arg() {
  local NAME="$1"
  shift
  for arg in "$@"; do
    case "$arg" in
      --${NAME}=*) echo "${arg#*=}"; return ;;
    esac
  done
  echo ""
}

case "$CMD" in
  store)
    TYPE="${1:-custom}"
    shift 2>/dev/null || true

    validate_type "$TYPE"

    # Collect positional content (everything that's not a flag)
    CONTENT=""
    for arg in "$@"; do
      case "$arg" in
        --*) ;; # skip flags
        *) CONTENT="$CONTENT $arg" ;;
      esac
    done
    CONTENT=$(echo "$CONTENT" | xargs) # trim

    if [ -z "$CONTENT" ]; then
      echo "❌ No content provided."
      echo "   Usage: dirigent-memory.sh store <type> <content> [--phase=X] [--agent=X] [--feature=X]"
      exit 1
    fi

    PHASE=$(get_arg phase "$@")
    AGENT=$(get_arg agent "$@")
    FEATURE=$(get_arg feature "$@")

    ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "mem-$(date +%s)")

    # Sanitize all inputs
    CONTENT=$(sanitize "$CONTENT")
    PHASE=$(sanitize "$PHASE")
    AGENT=$(sanitize "$AGENT")
    FEATURE=$(sanitize "$FEATURE")

    # Use printf-pipe to avoid heredoc termination attacks and shell expansion risks
    {
      printf '.param init\n'
      printf ".param set :id '%s'\n" "$(escape_sql "$ID")"
      printf ".param set :type '%s'\n" "$(escape_sql "$TYPE")"
      printf ".param set :content '%s'\n" "$(escape_sql "$CONTENT")"
      printf ".param set :phase '%s'\n" "$(escape_sql "$PHASE")"
      printf ".param set :agent '%s'\n" "$(escape_sql "$AGENT")"
      printf ".param set :feature '%s'\n" "$(escape_sql "$FEATURE")"
      cat <<'SQL'
INSERT INTO memories (id, type, content, phase, agent, feature)
VALUES (:id, :type, :content, :phase, :agent, :feature);
SQL
    } | sqlite3 "$DB_PATH"

    echo "✅ Stored: $ID [$TYPE]"
    ;;

  search)
    # Collect positional query terms (everything that's not a flag)
    QUERY=""
    for arg in "$@"; do
      case "$arg" in
        --*) ;; # skip flags
        *) QUERY="$QUERY $arg" ;;
      esac
    done
    QUERY=$(echo "$QUERY" | xargs)

    TYPE_FILTER=$(get_arg type "$@")
    LIMIT=$(get_arg limit "$@")
    LIMIT=${LIMIT:-10}

    # Validate limit is numeric
    if ! echo "$LIMIT" | grep -qE '^[0-9]+$'; then
      LIMIT=10
    fi

    # Build FTS query — strip everything except alphanum+space for safety
    FTS_QUERY=$(echo "$QUERY" | sed 's/[^a-zA-Z0-9 ]//g' | tr ' ' '\n' | awk 'length>1{printf "\"%s\"* OR ", $0}' | sed 's/ OR $//')

    if [ -n "$FTS_QUERY" ]; then
      if [ -n "$TYPE_FILTER" ]; then
        {
          printf '.param init\n'
          printf ".param set :fts '%s'\n" "$(escape_sql "$FTS_QUERY")"
          printf ".param set :type '%s'\n" "$(escape_sql "$TYPE_FILTER")"
          printf ".param set :limit %d\n" "$LIMIT"
          cat <<'SQL'
SELECT m.type, substr(m.content, 1, 120) as content, m.feature, m.phase, m.id
FROM memories_fts fts
JOIN memories m ON m.rowid = fts.rowid
WHERE memories_fts MATCH :fts
AND m.type = :type
ORDER BY rank
LIMIT :limit;
SQL
        } | sqlite3 -header -column "$DB_PATH"
      else
        {
          printf '.param init\n'
          printf ".param set :fts '%s'\n" "$(escape_sql "$FTS_QUERY")"
          printf ".param set :limit %d\n" "$LIMIT"
          cat <<'SQL'
SELECT m.type, substr(m.content, 1, 120) as content, m.feature, m.phase, m.id
FROM memories_fts fts
JOIN memories m ON m.rowid = fts.rowid
WHERE memories_fts MATCH :fts
ORDER BY rank
LIMIT :limit;
SQL
        } | sqlite3 -header -column "$DB_PATH"
      fi
    else
      echo "No search terms provided."
    fi
    ;;

  context)
    QUERY="$*"
    echo "# Dirigent Memory — Relevant Context"
    echo ""
    bash "$0" search "$QUERY" --limit=15 2>/dev/null
    ;;

  list)
    TYPE_FILTER=$(get_arg type "$@")
    LIMIT=$(get_arg limit "$@")
    LIMIT=${LIMIT:-20}

    # Validate limit is numeric
    if ! echo "$LIMIT" | grep -qE '^[0-9]+$'; then
      LIMIT=20
    fi

    if [ -n "$TYPE_FILTER" ]; then
      {
        printf '.param init\n'
        printf ".param set :type '%s'\n" "$(escape_sql "$TYPE_FILTER")"
        printf ".param set :limit %d\n" "$LIMIT"
        cat <<'SQL'
SELECT type, substr(content, 1, 100) as content, feature, phase, updated_at
FROM memories
WHERE type = :type
ORDER BY updated_at DESC
LIMIT :limit;
SQL
      } | sqlite3 -header -column "$DB_PATH"
    else
      {
        printf '.param init\n'
        printf ".param set :limit %d\n" "$LIMIT"
        cat <<'SQL'
SELECT type, substr(content, 1, 100) as content, feature, phase, updated_at
FROM memories
ORDER BY updated_at DESC
LIMIT :limit;
SQL
      } | sqlite3 -header -column "$DB_PATH"
    fi
    ;;

  stats)
    echo "🎼 Dirigent Memory Stats"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
    TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM memories;")
    echo "  Total entries: $TOTAL"
    SIZE=$(du -h "$DB_PATH" 2>/dev/null | cut -f1)
    echo "  Database size: $SIZE"
    echo ""
    echo "  By type:"
    sqlite3 "$DB_PATH" "SELECT '    ' || type || ': ' || COUNT(*) FROM memories GROUP BY type ORDER BY COUNT(*) DESC;"
    echo ""
    ;;

  prune)
    OLDER_THAN=$(get_arg older-than "$@")
    OLDER_THAN=${OLDER_THAN:-90d}
    DAYS=$(echo "$OLDER_THAN" | sed 's/d$//')

    # Validate days is numeric
    if ! echo "$DAYS" | grep -qE '^[0-9]+$'; then
      echo "❌ Invalid format: $OLDER_THAN. Use: 30d, 90d, etc."
      exit 1
    fi

    DELETED=$({
      printf '.param init\n'
      printf ".param set :days %d\n" "$DAYS"
      cat <<'SQL'
DELETE FROM memories
WHERE created_at < datetime('now', '-' || :days || ' days')
AND relevance_score < 5.0
AND access_count < 3;
SELECT changes();
SQL
    } | sqlite3 "$DB_PATH")
    echo "🧹 Pruned $DELETED entries"
    ;;

  export)
    sqlite3 "$DB_PATH" "SELECT json_group_array(json_object(
      'id', id, 'type', type, 'content', content,
      'phase', phase, 'agent', agent, 'feature', feature,
      'tags', tags, 'relevance_score', relevance_score,
      'created_at', created_at
    )) FROM memories;"
    ;;

  help|*)
    echo "Usage: dirigent-memory.sh <store|search|context|list|stats|prune|export>"
    echo ""
    echo "  store <type> <content> [--phase=X] [--agent=X] [--feature=X]"
    echo "  search <query> [--type=X] [--limit=N]"
    echo "  context <task description>"
    echo "  list [--type=X] [--limit=N]"
    echo "  stats"
    echo "  prune [--older-than=90d]"
    echo "  export"
    echo ""
    echo "  Types: $(echo "$VALID_TYPES" | tr '|' ', ')"
    ;;
esac
