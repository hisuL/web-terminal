#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -z "${HOME:-}" ]; then
  HOME="$(getent passwd "$(id -un)" | cut -d: -f6 || true)"
fi
if [ -z "${HOME:-}" ]; then
  HOME="$(cd ~ && pwd)"
fi

NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
if [ -z "$NODE_BIN" ]; then
  echo "node command not found in PATH" >&2
  exit 1
fi
NODE_BIN_DIR="$(dirname "$NODE_BIN")"

PATH_PREFIX="$HOME/.local/bin:$HOME/.bun/bin:$HOME/.npm-global/bin:$HOME/.nvm/bin:$NODE_BIN_DIR"

export HOME
export SHELL="${SHELL:-/bin/bash}"
export PORT="${PORT:-3456}"
export WEB_TERMINAL_DATA_DIR="${WEB_TERMINAL_DATA_DIR:-$PROJECT_DIR/.web-terminal}"
export PATH="$PATH_PREFIX:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PROJECT_DIR/.env"
  set +a
fi

cd "$PROJECT_DIR"
exec "$NODE_BIN" server.js
