#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/dministrator/claudeworkspace/web-terminal"
NODE_BIN="/home/dministrator/.nvm/versions/node/v24.12.0/bin/node"

export HOME="/home/dministrator"
export PORT="${PORT:-3456}"
export WEB_TERMINAL_DATA_DIR="${WEB_TERMINAL_DATA_DIR:-$PROJECT_DIR/.web-terminal}"

if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PROJECT_DIR/.env"
  set +a
fi

cd "$PROJECT_DIR"
exec "$NODE_BIN" server.js
