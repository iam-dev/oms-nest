#!/usr/bin/env bash
# scripts/dirigent-workflow.sh — Workflow management for Dirigent pipeline
# Usage:
#   bash scripts/dirigent-workflow.sh detect <task_description>
#   bash scripts/dirigent-workflow.sh load <workflow_type>
#   bash scripts/dirigent-workflow.sh get-phases <workflow_type>
#   bash scripts/dirigent-workflow.sh validate-phase <workflow> <phase> <status>
#   bash scripts/dirigent-workflow.sh get-agent <workflow> <phase>
#   bash scripts/dirigent-workflow.sh should-communicate <workflow> <phase> <agent>

set -uo pipefail

WORKFLOW_DIR=".claude/workflows"
STATE_FILE=".dirigent/state.json"
MEMORY_SCRIPT="scripts/dirigent-memory.sh"

# Detect workflow type from task description
detect_workflow() {
  local TASK="$1"
  local TASK_LOWER=$(echo "$TASK" | tr '[:upper:]' '[:lower:]')

  # Security-related keywords
  if echo "$TASK_LOWER" | grep -qE "(security|vulnerability|cve|exploit|injection|xss|csrf|sqli)"; then
    echo "security-fix"
    return
  fi

  # Hotfix/urgent keywords
  if echo "$TASK_LOWER" | grep -qE "(hotfix|urgent|critical|emergency|production.*down|crash|breaking)"; then
    echo "hotfix"
    return
  fi

  # Bug fix keywords
  if echo "$TASK_LOWER" | grep -qE "(fix|bug|issue|error|broken|fail|crash|repair)"; then
    echo "bugfix"
    return
  fi

  # Migration keywords
  if echo "$TASK_LOWER" | grep -qE "(migration|migrate|database.*change|schema.*update|upgrade)"; then
    echo "migration"
    return
  fi

  # Optimization/performance keywords
  if echo "$TASK_LOWER" | grep -qE "(optimize|performance|speed|slow|bottleneck|improve.*performance|reduce.*memory)"; then
    echo "optimization"
    return
  fi

  # Refactor keywords
  if echo "$TASK_LOWER" | grep -qE "(refactor|clean|reorganize|restructure|simplify|improve.*code)"; then
    echo "refactor"
    return
  fi

  # Default to feature for new additions
  echo "feature"
}

# Load workflow configuration
load_workflow() {
  local WORKFLOW_TYPE="$1"
  local WORKFLOW_FILE="$WORKFLOW_DIR/${WORKFLOW_TYPE}.yaml"

  if [ ! -f "$WORKFLOW_FILE" ]; then
    # Return default workflow if specific one doesn't exist
    cat <<EOF
{
  "type": "$WORKFLOW_TYPE",
  "phases": ["analyse", "implement", "test", "validate", "ship"],
  "agents": {
    "analyse": "architect",
    "implement": "implementer",
    "test": "tester",
    "validate": "reviewer",
    "ship": "self"
  },
  "communication": {}
}
EOF
  else
    # Parse YAML to JSON (simplified parser for basic structure)
    python3 -c "
import yaml, json, sys
with open('$WORKFLOW_FILE', 'r') as f:
    data = yaml.safe_load(f)
print(json.dumps(data))
" 2>/dev/null || echo '{"type": "'$WORKFLOW_TYPE'", "phases": ["analyse", "implement", "test", "validate"], "agents": {}}'
  fi
}

# Get phases for workflow
get_phases() {
  local WORKFLOW_TYPE="$1"
  local WORKFLOW=$(load_workflow "$WORKFLOW_TYPE")
  echo "$WORKFLOW" | jq -r '.phases[]'
}

# Validate if phase can transition based on workflow rules
validate_phase_transition() {
  local WORKFLOW_TYPE="$1"
  local CURRENT_PHASE="$2"
  local NEXT_PHASE="$3"

  local WORKFLOW=$(load_workflow "$WORKFLOW_TYPE")

  # Check if both phases exist in workflow
  local HAS_CURRENT=$(echo "$WORKFLOW" | jq --arg phase "$CURRENT_PHASE" '.phases | contains([$phase])')
  local HAS_NEXT=$(echo "$WORKFLOW" | jq --arg phase "$NEXT_PHASE" '.phases | contains([$phase])')

  if [ "$HAS_CURRENT" != "true" ] || [ "$HAS_NEXT" != "true" ]; then
    echo "invalid"
    return
  fi

  # Check dependencies if defined
  local DEPENDENCIES=$(echo "$WORKFLOW" | jq -r --arg phase "$NEXT_PHASE" '.dependencies[$phase][]?' 2>/dev/null)
  if [ -n "$DEPENDENCIES" ]; then
    while IFS= read -r dep; do
      # Check if dependency is completed
      if [ -f "$STATE_FILE" ]; then
        local DEP_STATUS=$(jq -r --arg phase "$dep" '.phases[$phase].status' "$STATE_FILE")
        if [ "$DEP_STATUS" != "done" ]; then
          echo "dependency_not_met:$dep"
          return
        fi
      fi
    done <<< "$DEPENDENCIES"
  fi

  echo "valid"
}

# Get agent assignment for phase
get_agent_for_phase() {
  local WORKFLOW_TYPE="$1"
  local PHASE="$2"

  local WORKFLOW=$(load_workflow "$WORKFLOW_TYPE")
  local AGENT=$(echo "$WORKFLOW" | jq -r --arg phase "$PHASE" '.agents[$phase] // "self"')

  # Check for conditional agent selection based on context
  if [ "$AGENT" = "conditional" ]; then
    # Analyze context to select appropriate agent
    local CONTEXT=$(bash "$MEMORY_SCRIPT" context "$PHASE execution" 2>/dev/null | head -5)

    case "$PHASE" in
      design)
        if echo "$CONTEXT" | grep -qi "frontend\|ui\|component"; then
          AGENT="designer"
        else
          AGENT="architect"
        fi
        ;;
      implement)
        # Could select specialist based on detected stack
        AGENT="implementer"
        ;;
      *)
        AGENT="self"
        ;;
    esac
  fi

  echo "$AGENT"
}

# Check if agents should communicate in this phase
should_communicate() {
  local WORKFLOW_TYPE="$1"
  local PHASE="$2"
  local FROM_AGENT="$3"
  local TO_AGENT="${4:-}"

  local WORKFLOW=$(load_workflow "$WORKFLOW_TYPE")

  # Check communication rules
  local COMM_RULES=$(echo "$WORKFLOW" | jq -r --arg phase "$PHASE" '.communication[$phase][]?' 2>/dev/null)

  if [ -n "$COMM_RULES" ]; then
    while IFS= read -r rule; do
      local FROM=$(echo "$rule" | cut -d: -f1)
      local TO=$(echo "$rule" | cut -d: -f2)

      if [ "$FROM" = "$FROM_AGENT" ]; then
        if [ -z "$TO_AGENT" ] || [ "$TO" = "$TO_AGENT" ]; then
          echo "true"
          return
        fi
      fi
    done <<< "$COMM_RULES"
  fi

  # Default communication patterns
  case "$PHASE:$FROM_AGENT" in
    "design:designer")
      echo "true:architect"  # Designer should validate with architect
      ;;
    "implement:implementer")
      if [ "$WORKFLOW_TYPE" = "feature" ]; then
        echo "true:designer,architect"  # Check back with designers
      fi
      ;;
    "validate:reviewer")
      echo "true:architect,designer"  # Reviewer validates against design
      ;;
    *)
      echo "false"
      ;;
  esac
}

# Record inter-agent communication
record_communication() {
  local FROM_AGENT="$1"
  local TO_AGENT="$2"
  local MESSAGE="$3"
  local PHASE="${4:-unknown}"

  # Store in memory system as communication record
  bash "$MEMORY_SCRIPT" store "agent_communication" \
    "[$FROM_AGENT → $TO_AGENT] $MESSAGE" \
    --phase="$PHASE" \
    --agent="$FROM_AGENT" 2>/dev/null

  # Also append to state file if exists
  if [ -f "$STATE_FILE" ]; then
    jq --arg from "$FROM_AGENT" \
       --arg to "$TO_AGENT" \
       --arg msg "$MESSAGE" \
       --arg phase "$PHASE" \
       --arg ts "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
       '.communications += [{
          "from": $from,
          "to": $to,
          "message": $msg,
          "phase": $phase,
          "timestamp": $ts
        }]' \
       "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
  fi
}

# Get workflow recommendations
get_recommendations() {
  local WORKFLOW_TYPE="$1"
  local PHASE="$2"

  case "$WORKFLOW_TYPE:$PHASE" in
    "feature:design")
      echo "- Consider both frontend UI/UX and backend architecture"
      echo "- Document API contracts and data models"
      echo "- Include error handling and edge cases"
      ;;
    "bugfix:analyse")
      echo "- Identify root cause, not just symptoms"
      echo "- Check for similar issues in codebase"
      echo "- Consider regression test requirements"
      ;;
    "security-fix:*")
      echo "- Follow OWASP guidelines"
      echo "- Ensure complete fix without introducing new vulnerabilities"
      echo "- Add security tests to prevent regression"
      ;;
    "optimization:analyse")
      echo "- Profile current performance metrics"
      echo "- Identify bottlenecks with data"
      echo "- Set measurable improvement targets"
      ;;
    "migration:plan")
      echo "- Ensure backward compatibility"
      echo "- Create rollback plan"
      echo "- Test with production-like data"
      ;;
    *)
      echo "- Follow established patterns in codebase"
      ;;
  esac
}

# Main command dispatcher
CMD="${1:-help}"
shift 2>/dev/null || true

case "$CMD" in
  detect)
    TASK="${*:-}"
    if [ -z "$TASK" ]; then
      echo "Error: Task description required"
      exit 1
    fi
    detect_workflow "$TASK"
    ;;

  load)
    WORKFLOW_TYPE="${1:-feature}"
    load_workflow "$WORKFLOW_TYPE"
    ;;

  get-phases)
    WORKFLOW_TYPE="${1:-feature}"
    get_phases "$WORKFLOW_TYPE"
    ;;

  validate-transition)
    WORKFLOW_TYPE="${1:-feature}"
    CURRENT="${2:-}"
    NEXT="${3:-}"
    validate_phase_transition "$WORKFLOW_TYPE" "$CURRENT" "$NEXT"
    ;;

  get-agent)
    WORKFLOW_TYPE="${1:-feature}"
    PHASE="${2:-analyse}"
    get_agent_for_phase "$WORKFLOW_TYPE" "$PHASE"
    ;;

  should-communicate)
    WORKFLOW_TYPE="${1:-feature}"
    PHASE="${2:-}"
    FROM_AGENT="${3:-}"
    TO_AGENT="${4:-}"
    should_communicate "$WORKFLOW_TYPE" "$PHASE" "$FROM_AGENT" "$TO_AGENT"
    ;;

  record-communication)
    FROM="${1:-unknown}"
    TO="${2:-unknown}"
    MESSAGE="${3:-}"
    PHASE="${4:-unknown}"
    record_communication "$FROM" "$TO" "$MESSAGE" "$PHASE"
    ;;

  recommendations)
    WORKFLOW_TYPE="${1:-feature}"
    PHASE="${2:-analyse}"
    get_recommendations "$WORKFLOW_TYPE" "$PHASE"
    ;;

  help|*)
    cat <<EOF
Usage: dirigent-workflow.sh <command> [options]

Commands:
  detect <task>                    Detect workflow type from task description
  load <workflow>                  Load workflow configuration
  get-phases <workflow>            Get phases for workflow
  validate-transition <wf> <from> <to>  Check if phase transition is valid
  get-agent <workflow> <phase>     Get agent for phase
  should-communicate <wf> <phase> <from> [to]  Check communication requirements
  record-communication <from> <to> <msg> [phase]  Record agent communication
  recommendations <workflow> <phase>  Get phase-specific recommendations

Workflow Types:
  feature       Full feature development
  bugfix        Bug fixing workflow
  hotfix        Emergency fixes
  refactor      Code refactoring
  migration     Database/API migrations
  optimization  Performance improvements
  security-fix  Security vulnerability fixes
EOF
    ;;
esac