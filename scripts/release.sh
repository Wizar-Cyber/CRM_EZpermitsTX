#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_DIR="$ROOT_DIR/client"
SERVER_DIR="$ROOT_DIR/server"

# Configurables (override as env vars)
CLIENT_DIST_TARGET="${CLIENT_DIST_TARGET:-/var/www/crm}"
SERVER_SERVICE_NAME="${SERVER_SERVICE_NAME:-}"
WEB_SERVICE_NAME="${WEB_SERVICE_NAME:-nginx}"
INSTALL_SERVER_DEPS="${INSTALL_SERVER_DEPS:-1}"
PM2_PROCESS_NAME="${PM2_PROCESS_NAME:-crm-backend}"
RELEASES_DIR="${RELEASES_DIR:-/var/www/crm-releases}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
ASSET_RETENTION_DAYS="${ASSET_RETENTION_DAYS:-14}"

log() {
  printf "\n[%s] %s\n" "$(date +"%Y-%m-%d %H:%M:%S")" "$*"
}

log "Preparing frontend build metadata"
node "$ROOT_DIR/scripts/write-build-info.mjs"

log "Installing frontend dependencies"
npm --prefix "$CLIENT_DIR" ci

log "Building frontend (production mode)"
npm --prefix "$CLIENT_DIR" run build:prod

prune_old_assets() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    return
  fi

  local deleted_count
  deleted_count="$(find "$dir" -type f -mtime +"$ASSET_RETENTION_DAYS" | wc -l | tr -d ' ')"
  if [[ "$deleted_count" == "0" ]]; then
    log "No old assets to prune in $dir (retention ${ASSET_RETENTION_DAYS}d)"
    return
  fi

  log "Pruning $deleted_count old asset file(s) from $dir (older than ${ASSET_RETENTION_DAYS}d)"
  find "$dir" -type f -mtime +"$ASSET_RETENTION_DAYS" -print -delete
}

log "Pruning old assets in local dist cache"
prune_old_assets "$CLIENT_DIR/dist/assets"

RELEASE_ID="$(date +"%Y%m%d-%H%M%S")"
RELEASE_PATH="$RELEASES_DIR/$RELEASE_ID"

log "Creating frontend backup snapshot"
mkdir -p "$RELEASES_DIR"
if [[ -f "$CLIENT_DIST_TARGET/index.html" ]]; then
  mkdir -p "$RELEASE_PATH"
  rsync -a --delete "$CLIENT_DIST_TARGET/" "$RELEASE_PATH/"
  printf "%s\n" "$RELEASE_ID" > "$RELEASES_DIR/.last_release"
  log "Backup created: $RELEASE_PATH"
else
  log "No previous frontend found in $CLIENT_DIST_TARGET (first publish or empty target)"
fi

log "Publishing client dist to $CLIENT_DIST_TARGET"
mkdir -p "$CLIENT_DIST_TARGET"
rsync -av --delete "$CLIENT_DIR/dist/" "$CLIENT_DIST_TARGET/"

log "Pruning old assets on deployed frontend"
prune_old_assets "$CLIENT_DIST_TARGET/assets"

if [[ -d "$RELEASES_DIR" ]]; then
  log "Pruning old backups (keeping $KEEP_RELEASES)"
  ls -1dt "$RELEASES_DIR"/* 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
fi

if [[ "$INSTALL_SERVER_DEPS" == "1" ]]; then
  log "Installing server dependencies"
  npm --prefix "$SERVER_DIR" ci --omit=dev
fi

if [[ -n "$SERVER_SERVICE_NAME" ]]; then
  log "Restarting server service: $SERVER_SERVICE_NAME"
  sudo systemctl restart "$SERVER_SERVICE_NAME"
  sudo systemctl status "$SERVER_SERVICE_NAME" --no-pager -l | head -n 25
else
  if command -v pm2 >/dev/null 2>&1; then
    if pm2 describe "$PM2_PROCESS_NAME" >/dev/null 2>&1; then
      log "Restarting PM2 process: $PM2_PROCESS_NAME"
      pm2 restart "$PM2_PROCESS_NAME"
      pm2 save || true
    else
      # Intento de autodetección por script path
      DETECTED_PM2_NAME="$(pm2 jlist 2>/dev/null | node -e '
        let data="";
        process.stdin.on("data", c => data += c);
        process.stdin.on("end", () => {
          try {
            const list = JSON.parse(data);
            const found = list.find(p =>
              (p?.pm2_env?.pm_exec_path || "").includes("/opt/crm/server/index.js")
            );
            if (found?.name) process.stdout.write(found.name);
          } catch {}
        });
      ')"

      if [[ -n "$DETECTED_PM2_NAME" ]]; then
        log "Restarting auto-detected PM2 process: $DETECTED_PM2_NAME"
        pm2 restart "$DETECTED_PM2_NAME"
        pm2 save || true
      else
        log "SERVER_SERVICE_NAME not set and PM2 process not found; skipping backend restart"
      fi
    fi
  else
    log "SERVER_SERVICE_NAME not set and PM2 not installed; skipping backend restart"
  fi
fi

if [[ -n "$WEB_SERVICE_NAME" ]]; then
  log "Reloading web service: $WEB_SERVICE_NAME"
  sudo systemctl reload "$WEB_SERVICE_NAME" || true
fi

log "Release completed"
log "Verify deployed build: curl -s http://69.62.69.98:8081/build-info.json"
