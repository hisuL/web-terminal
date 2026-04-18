#!/bin/bash
# ============================================================
# Web Terminal Notify Script for Codex CLI config.toml notify
# Called by Codex's notify mechanism (different JSON format)
# Receives: {type, thread-id, turn-id, cwd, input-messages, last-assistant-message}
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
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [codex-notify] $1" >> "$LOG_FILE" 2>/dev/null || true
}

# Read stdin
INPUT=$(cat 2>/dev/null || echo '{}')
log "Received notify: $(echo "$INPUT" | head -c 500)"

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

# Extract fields from Codex notify JSON
EVENT_TYPE=$(echo "$INPUT" | grep -o '"type"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"type"[[:space:]]*:[[:space:]]*"//;s/"$//')
CWD=$(echo "$INPUT" | grep -o '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"cwd"[[:space:]]*:[[:space:]]*"//;s/"$//')
THREAD_ID=$(echo "$INPUT" | grep -o '"thread-id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"thread-id"[[:space:]]*:[[:space:]]*"//;s/"$//')

# Build message based on event type
case "$EVENT_TYPE" in
  agent-turn-complete) MESSAGE="Codex 回合完成" ;;
  approval-requested) MESSAGE="Codex 等待审批" ;;
  *) MESSAGE="Codex 通知: $EVENT_TYPE" ;;
esac

TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

# Build JSON payload
PAYLOAD="{\"tool\":\"codex\",\"event\":\"notify:$EVENT_TYPE\",\"cwd\":\"$CWD\",\"message\":\"$MESSAGE\",\"sessionId\":\"$THREAD_ID\",\"timestamp\":\"$TIMESTAMP\",\"secret\":\"$WT_SECRET\"}"

log "Posting to $WT_URL/api/notify event=notify:$EVENT_TYPE cwd=$CWD"

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
