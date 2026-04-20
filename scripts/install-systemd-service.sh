#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_PATH="$PROJECT_DIR/systemd/web-terminal.service"

SERVICE_MODE="${1:-system}"
SERVICE_NAME="${SERVICE_NAME:-web-terminal}"
CURRENT_USER="$(id -un)"
CURRENT_GROUP="$(id -gn)"
CURRENT_HOME="${HOME:-$(getent passwd "$CURRENT_USER" | cut -d: -f6 || true)}"
CURRENT_SHELL="${SHELL:-$(getent passwd "$CURRENT_USER" | cut -d: -f7 || true)}"
CURRENT_PATH="${PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"

if [ ! -f "$TEMPLATE_PATH" ]; then
  echo "service template not found: $TEMPLATE_PATH" >&2
  exit 1
fi

if [ -z "${CURRENT_HOME:-}" ]; then
  echo "cannot determine HOME for user $CURRENT_USER" >&2
  exit 1
fi

if [ -z "${CURRENT_SHELL:-}" ]; then
  CURRENT_SHELL="/bin/bash"
fi

if [ -z "${NODE_BIN:-}" ]; then
  echo "node command not found in PATH" >&2
  exit 1
fi

NODE_BIN_DIR="$(dirname "$NODE_BIN")"

normalize_path_list() {
  local raw="$1"
  local part
  local -a parts=()
  local -a result=()
  declare -A seen=()

  IFS=: read -r -a parts <<< "$raw"
  for part in "${parts[@]}"; do
    [ -n "$part" ] || continue
    case "$part" in
      "~/"*)
        part="$CURRENT_HOME/${part#~/}"
        ;;
    esac
    part="${part%/}"
    [ -d "$part" ] || continue
    case "$part" in
      */.codex/tmp/*)
        continue
        ;;
    esac
    if [ -z "${seen[$part]:-}" ]; then
      seen["$part"]=1
      result+=("$part")
    fi
  done

  (IFS=:; printf '%s' "${result[*]}")
}

SERVICE_PATH_PREFIX="$(normalize_path_list "$CURRENT_HOME/.local/bin:$CURRENT_HOME/.bun/bin:$CURRENT_HOME/.npm-global/bin:$CURRENT_HOME/.nvm/bin:$NODE_BIN_DIR:$CURRENT_PATH")"

escape_sed() {
  printf '%s' "$1" | sed -e 's/[\\/&]/\\&/g'
}

render_template() {
  sed \
    -e "s/__WT_USER__/$(escape_sed "$CURRENT_USER")/g" \
    -e "s/__WT_GROUP__/$(escape_sed "$CURRENT_GROUP")/g" \
    -e "s#__WT_PROJECT_DIR__#$(escape_sed "$PROJECT_DIR")#g" \
    -e "s#__WT_HOME__#$(escape_sed "$CURRENT_HOME")#g" \
    -e "s#__WT_SHELL__#$(escape_sed "$CURRENT_SHELL")#g" \
    -e "s#__WT_PATH__#$(escape_sed "$SERVICE_PATH_PREFIX")#g" \
    "$TEMPLATE_PATH"
}

install_system_service() {
  local target="/etc/systemd/system/${SERVICE_NAME}.service"
  render_template | sudo tee "$target" >/dev/null
  sudo systemctl daemon-reload
  sudo systemctl enable "$SERVICE_NAME"
  sudo systemctl restart "$SERVICE_NAME"
  echo "installed system service: $target"
}

install_user_service() {
  local unit_dir="${XDG_CONFIG_HOME:-$CURRENT_HOME/.config}/systemd/user"
  local target="$unit_dir/${SERVICE_NAME}.service"
  mkdir -p "$unit_dir/default.target.wants"
  render_template \
    | sed 's/^WantedBy=multi-user.target$/WantedBy=default.target/' \
    | grep -v '^User=' \
    | grep -v '^Group=' \
    > "$target"
  ln -sf "../${SERVICE_NAME}.service" "$unit_dir/default.target.wants/${SERVICE_NAME}.service"
  systemctl --user daemon-reload
  systemctl --user enable "$SERVICE_NAME"
  systemctl --user restart "$SERVICE_NAME"
  echo "installed user service: $target"
}

case "$SERVICE_MODE" in
  system)
    install_system_service
    ;;
  user)
    install_user_service
    ;;
  print)
    render_template
    ;;
  *)
    echo "usage: $0 [system|user|print]" >&2
    exit 1
    ;;
esac
