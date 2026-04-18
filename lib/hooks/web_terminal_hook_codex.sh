#!/bin/bash
# ============================================================
# Web Terminal Hook Script for Codex CLI
# Called by Codex hooks mechanism (stdin = JSON payload)
# Posts notification to Web Terminal's /api/notify endpoint
# MUST always exit 0 to never break Codex CLI
# ============================================================
set +e
trap 'exit 0' ERR EXIT

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK_CONFIG="$WT_ROOT/.web-terminal/hook-config.json"
LOG_DIR="$WT_ROOT/.web-terminal/logs"
LOG_FILE="$LOG_DIR/hook.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR" 2>/dev/null || true

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [codex] $1" >> "$LOG_FILE" 2>/dev/null || true
}

# Read stdin
INPUT=$(cat 2>/dev/null || echo '{}')
log "Received event: $(echo "$INPUT" | head -c 500)"

# Read hook config
if [ ! -f "$HOOK_CONFIG" ]; then
  log "ERROR: hook-config.json not found at $HOOK_CONFIG"
  exit 0
fi

WT_URL=$(cat "$HOOK_CONFIG" 2>/dev/null | grep -o '"url"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"url"[[:space:]]*:[[:space:]]*"//;s/"$//')
WT_SECRET=$(cat "$HOOK_CONFIG" 2>/dev/null | grep -o '"secret"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"secret"[[:space:]]*:[[:space:]]*"//;s/"$//')

if [ -z "$WT_URL" ] || [ -z "$WT_SECRET" ]; then
  log "ERROR: Missing url or secret in hook-config.json"
  exit 0
fi

# Extract fields from Codex hook JSON
HOOK_EVENT=$(echo "$INPUT" | grep -o '"hook_event_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"hook_event_name"[[:space:]]*:[[:space:]]*"//;s/"$//')
SESSION_ID=$(echo "$INPUT" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"session_id"[[:space:]]*:[[:space:]]*"//;s/"$//')
CWD=$(echo "$INPUT" | grep -o '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"cwd"[[:space:]]*:[[:space:]]*"//;s/"$//')
TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"tool_name"[[:space:]]*:[[:space:]]*"//;s/"$//')

# Build human-readable message
case "$HOOK_EVENT" in
  SessionStart) MESSAGE="会话开始" ;;
  Stop) MESSAGE="回合结束" ;;
  PreToolUse) MESSAGE="工具调用前: $TOOL_NAME" ;;
  PostToolUse) MESSAGE="工具调用后: $TOOL_NAME" ;;
  UserPromptSubmit) MESSAGE="用户提交输入" ;;
  *) MESSAGE="事件: $HOOK_EVENT" ;;
esac

TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

# Build JSON payload
PAYLOAD="{\"tool\":\"codex\",\"event\":\"$HOOK_EVENT\",\"cwd\":\"$CWD\",\"message\":\"$MESSAGE\",\"sessionId\":\"$SESSION_ID\",\"toolName\":\"$TOOL_NAME\",\"timestamp\":\"$TIMESTAMP\",\"secret\":\"$WT_SECRET\"}"

log "Posting to $WT_URL/api/notify event=$HOOK_EVENT cwd=$CWD"

# Send to Web Terminal
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  --connect-timeout 5 \
  --max-time 10 \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "$WT_URL/api/notify" 2>/dev/null || echo "000")

log "Response: HTTP $HTTP_CODE"

if [ "$HTTP_CODE" != "200" ]; then
  log "WARNING: notify API returned HTTP $HTTP_CODE (non-fatal)"
fi

exit 0
