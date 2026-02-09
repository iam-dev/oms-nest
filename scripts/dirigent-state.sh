#!/usr/bin/env bash
# scripts/dirigent-state.sh — State management for Dirigent pipeline
# Usage:
#   bash scripts/dirigent-state.sh init <taskId> <type> <slug> <mode>
#   bash scripts/dirigent-state.sh update <phase> <status>
#   bash scripts/dirigent-state.sh get
#   bash scripts/dirigent-state.sh resume
#   bash scripts/dirigent-state.sh tokens <model> <count>
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

STATE_DIR=$(resolve_dirigent_home)
STATE_FILE="$STATE_DIR/state.json"

mkdir -p "$STATE_DIR"

cmd="${1:-get}"

case "$cmd" in
  init)
    TASK_ID="${2:-unnamed}"
    TYPE="${3:-unknown}"
    SLUG="${4:-unknown}"
    MODE="${5:-interactive}"

    # Detect workflow type if not specified
    if [ "$TYPE" = "unknown" ] || [ -z "$TYPE" ]; then
      WORKFLOW_TYPE=$(bash scripts/dirigent-workflow.sh detect "$TASK_ID" 2>/dev/null || echo "feature")
    else
      # Map legacy types to workflow types
      case "$TYPE" in
        new-feature) WORKFLOW_TYPE="feature" ;;
        bug-fix) WORKFLOW_TYPE="bugfix" ;;
        hotfix) WORKFLOW_TYPE="hotfix" ;;
        refactor) WORKFLOW_TYPE="refactor" ;;
        *) WORKFLOW_TYPE="$TYPE" ;;
      esac
    fi

    # Load phases from workflow configuration
    WORKFLOW_PHASES=$(bash scripts/dirigent-workflow.sh get-phases "$WORKFLOW_TYPE" 2>/dev/null)
    if [ -n "$WORKFLOW_PHASES" ]; then
      # Build phases JSON from workflow
      PHASES="{"
      FIRST=true
      while IFS= read -r phase; do
        [ "$FIRST" = true ] && FIRST=false || PHASES="${PHASES},"
        PHASES="${PHASES}\"${phase}\":{\"status\":\"pending\"}"
      done <<< "$WORKFLOW_PHASES"
      PHASES="${PHASES}}"
    else
      # Fallback to default phases
      case "$TYPE" in
        new-feature|feature)
          PHASES='{"analyse":{"status":"pending"},"design":{"status":"pending"},"plan":{"status":"pending"},"migrate":{"status":"pending"},"implement":{"status":"pending"},"test":{"status":"pending"},"validate":{"status":"pending"},"update":{"status":"pending"},"ship":{"status":"pending"}}'
          ;;
        bug-fix|bugfix)
          PHASES='{"analyse":{"status":"pending"},"plan":{"status":"pending"},"implement":{"status":"pending"},"test":{"status":"pending"},"validate":{"status":"pending"},"update":{"status":"pending"},"ship":{"status":"pending"}}'
          ;;
        hotfix)
          PHASES='{"analyse":{"status":"pending"},"implement":{"status":"pending"},"test":{"status":"pending"},"ship":{"status":"pending"}}'
          ;;
        refactor)
          PHASES='{"analyse":{"status":"pending"},"design":{"status":"pending"},"plan":{"status":"pending"},"implement":{"status":"pending"},"test":{"status":"pending"},"validate":{"status":"pending"}}'
          ;;
        security-fix)
          PHASES='{"analyse":{"status":"pending"},"plan":{"status":"pending"},"implement":{"status":"pending"},"test":{"status":"pending"},"validate":{"status":"pending"},"update":{"status":"pending"},"ship":{"status":"pending"}}'
          ;;
        *)
          PHASES='{"analyse":{"status":"pending"},"implement":{"status":"pending"},"test":{"status":"pending"},"validate":{"status":"pending"}}'
          ;;
      esac
    fi

    BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

    cat > "$STATE_FILE" << EOF
{
  "taskId": "$TASK_ID",
  "type": "$TYPE",
  "workflowType": "$WORKFLOW_TYPE",
  "slug": "$SLUG",
  "branch": "$BRANCH",
  "mode": "$MODE",
  "startedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "phases": $PHASES,
  "currentPhase": null,
  "tokensUsed": {"opus": 0, "sonnet": 0, "haiku": 0},
  "errors": [],
  "communications": [],
  "validations": {},
  "decisions": []
}
EOF
    echo "✅ State initialized: $TASK_ID ($TYPE)"
    ;;

  update)
    PHASE="${2:-unknown}"
    STATUS="${3:-done}"

    if [ ! -f "$STATE_FILE" ]; then
      echo "⚠️ No state file. Run 'init' first."
      exit 1
    fi

    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Update current phase when starting
    if [ "$STATUS" = "in-progress" ] || [ "$STATUS" = "active" ]; then
      jq --arg phase "$PHASE" '.currentPhase = $phase' \
        "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
    fi

    # Update phase status — only set completedAt on terminal states
    if [ "$STATUS" = "done" ] || [ "$STATUS" = "failed" ]; then
      jq --arg phase "$PHASE" --arg status "$STATUS" --arg ts "$TIMESTAMP" \
        '.phases[$phase].status = $status | .phases[$phase].completedAt = $ts | .currentPhase = null' \
        "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"

      # Get agent recommendations for next phase if workflow configured
      WORKFLOW_TYPE=$(jq -r '.workflowType // .type' "$STATE_FILE")
      if [ -n "$WORKFLOW_TYPE" ]; then
        NEXT_PHASE=$(jq -r '.phases | to_entries[] | select(.value.status != "done") | .key' "$STATE_FILE" | head -1)
        if [ -n "$NEXT_PHASE" ]; then
          NEXT_AGENT=$(bash scripts/dirigent-workflow.sh get-agent "$WORKFLOW_TYPE" "$NEXT_PHASE" 2>/dev/null)
          echo "   Next: $NEXT_PHASE (agent: $NEXT_AGENT)"
        fi
      fi
    else
      jq --arg phase "$PHASE" --arg status "$STATUS" \
        '.phases[$phase].status = $status' \
        "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
    fi

    echo "✅ Phase '$PHASE' → $STATUS"
    ;;

  get)
    if [ ! -f "$STATE_FILE" ]; then
      echo "No active pipeline."
      exit 0
    fi
    cat "$STATE_FILE" | jq .
    ;;

  resume)
    if [ ! -f "$STATE_FILE" ]; then
      echo "No state to resume."
      exit 1
    fi

    # Find first non-done phase
    NEXT=$(jq -r '.phases | to_entries[] | select(.value.status != "done") | .key' "$STATE_FILE" | head -1)
    if [ -z "$NEXT" ]; then
      echo "✅ All phases complete."
    else
      TASK=$(jq -r '.taskId' "$STATE_FILE")
      echo "🔄 Resume: $TASK → continue from phase: $NEXT"
      echo "   Run: /dirigent --phase=$NEXT"
    fi
    ;;

  tokens)
    MODEL="${2:-sonnet}"
    COUNT="${3:-0}"
    if [ -f "$STATE_FILE" ]; then
      jq --arg model "$MODEL" --argjson count "$COUNT" \
        '.tokensUsed[$model] += $count' \
        "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
    fi
    ;;

  error)
    MSG="${2:-unknown error}"
    PHASE="${3:-unknown}"
    if [ -f "$STATE_FILE" ]; then
      jq --arg msg "$MSG" --arg phase "$PHASE" --arg ts "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
        '.errors += [{"phase": $phase, "message": $msg, "at": $ts}]' \
        "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
    fi
    ;;

  clean)
    rm -rf "$STATE_DIR/state.json" "$STATE_DIR/changes.log"
    echo "🧹 State cleaned"
    ;;

  *)
    echo "Usage: dirigent-state.sh <init|update|get|resume|tokens|error|clean>"
    exit 1
    ;;
esac
