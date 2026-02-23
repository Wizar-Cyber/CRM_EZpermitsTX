#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Configurables (override as env vars)
CLIENT_DIST_TARGET="${CLIENT_DIST_TARGET:-/var/www/crm}"
RELEASES_DIR="${RELEASES_DIR:-/var/www/crm-releases}"
SERVER_SERVICE_NAME="${SERVER_SERVICE_NAME:-}"
WEB_SERVICE_NAME="${WEB_SERVICE_NAME:-nginx}"
PM2_PROCESS_NAME="${PM2_PROCESS_NAME:-crm-backend}"
ROLLBACK_ID="${1:-latest}"

log() {
  printf "\n[%s] %s\n" "$(date +"%Y-%m-%d %H:%M:%S")" "$*"
}

if [[ ! -d "$RELEASES_DIR" ]]; then
  echo "❌ Releases dir not found: $RELEASES_DIR"
  exit 1
fi

if [[ "$ROLLBACK_ID" == "latest" ]]; then
  ROLLBACK_ID="$(ls -1dt "$RELEASES_DIR"/* 2>/dev/null | head -n 1 | xargs -r basename || true)"
fi

if [[ -z "$ROLLBACK_ID" || ! -d "$RELEASES_DIR/$ROLLBACK_ID" ]]; then
  echo "❌ Rollback release not found: $ROLLBACK_ID"
  echo "Available releases:"
  ls -1dt "$RELEASES_DIR"/* 2>/dev/null | xargs -r -n1 basename || true
  exit 1
fi

log "Rolling back frontend to release: $ROLLBACK_ID"
mkdir -p "$CLIENT_DIST_TARGET"
rsync -av --delete "$RELEASES_DIR/$ROLLBACK_ID/" "$CLIENT_DIST_TARGET/"

if [[ -n "$SERVER_SERVICE_NAME" ]]; then
  log "Restarting server service: $SERVER_SERVICE_NAME"
  sudo systemctl restart "$SERVER_SERVICE_NAME"
else
  if command -v pm2 >/dev/null 2>&1; then
    if pm2 describe "$PM2_PROCESS_NAME" >/dev/null 2>&1; then
      log "Restarting PM2 process: $PM2_PROCESS_NAME"
      pm2 restart "$PM2_PROCESS_NAME"
      pm2 save || true
    fi
  fi
fi

if [[ -n "$WEB_SERVICE_NAME" ]]; then
  log "Reloading web service: $WEB_SERVICE_NAME"
  sudo systemctl reload "$WEB_SERVICE_NAME" || true
fi

log "Rollback completed"
log "Verify: curl -s http://69.62.69.98:8081/build-info.json"
