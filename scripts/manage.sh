#!/usr/bin/env bash
# ==============================================================================
# SuperApp V2 - Production Release Manager & Deployment Controller
# ==============================================================================
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASES_DIR="$APP_ROOT/releases"
DIST_DIR="$APP_ROOT/dist"
LOGS_DIR="$APP_ROOT/logs"
LOG_FILE="$LOGS_DIR/deploy.log"
CURRENT_VER_FILE="$APP_ROOT/current_version.txt"
PREVIOUS_VER_FILE="$APP_ROOT/previous_ver.txt"
SERVICE_NAME="superapp.service"

mkdir -p "$RELEASES_DIR" "$LOGS_DIR"

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE"
}

check_health() {
    local retries=15
    local wait_sec=2
    log "🔍 Probing health endpoint on http://127.0.0.1:5000/health..."
    for i in $(seq 1 $retries); do
        local response
        response=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:5000/health" || true)
        if [ "$response" = "200" ]; then
            log "✅ Health check PASSED on attempt $i (HTTP 200 OK)!"
            return 0
        fi
        sleep $wait_sec
    done
    log "❌ Health check FAILED! (HTTP status: $response after $retries attempts)"
    return 1
}

do_rollback() {
    if [ ! -f "$PREVIOUS_VER_FILE" ]; then
        log "⚠️ No previous version recorded in $PREVIOUS_VER_FILE! Cannot rollback."
        return 1
    fi

    local prev_tag
    prev_tag=$(cat "$PREVIOUS_VER_FILE" | tr -d '\r\n')
    local prev_release_dir="$RELEASES_DIR/release_$prev_tag"

    if [ ! -d "$prev_release_dir" ]; then
        log "⚠️ Previous release directory $prev_release_dir does not exist! Cannot rollback."
        return 1
    fi

    log "⏪ ROLLING BACK to last known healthy release: $prev_tag..."

    # Re-point dist or copy back
    if [ -L "$DIST_DIR" ]; then
        rm -f "$DIST_DIR"
        ln -sfn "$prev_release_dir" "$DIST_DIR"
    else
        rm -rf "$DIST_DIR"/*
        cp -a "$prev_release_dir"/* "$DIST_DIR"/
    fi

    systemctl restart "$SERVICE_NAME"

    if check_health; then
        echo "$prev_tag" > "$CURRENT_VER_FILE"
        log "✅ Rollback SUCCESSFUL! Service restored to $prev_tag."
        return 0
    else
        log "🚨 CRITICAL: Rollback failed healthcheck! Check logs with: journalctl -u $SERVICE_NAME -n 50"
        return 1
    fi
}

prune_old_releases() {
    local keep=5
    log "🧹 Cleaning up older releases (keeping latest $keep)..."
    cd "$RELEASES_DIR"
    local count
    count=$(ls -dt release_* 2>/dev/null | wc -l)
    if [ "$count" -gt "$keep" ]; then
        ls -dt release_* | tail -n +$((keep + 1)) | while read -r old_release; do
            log "  Removing old release: $old_release"
            rm -rf "$old_release"
        done
    fi
    cd "$APP_ROOT"
}

action="${1:-deploy}"
target_tag="${2:-}"

case "$action" in
    deploy)
        if [ -z "$target_tag" ]; then
            target_tag="v-$(git rev-parse --short HEAD 2>/dev/null || date +%s)"
        fi
        log "=========================================================="
        log "🚀 Starting deployment for release: $target_tag"
        log "=========================================================="

        # 1. Record current active version as previous
        if [ -f "$CURRENT_VER_FILE" ]; then
            cp "$CURRENT_VER_FILE" "$PREVIOUS_VER_FILE"
        fi

        # 2. Pull latest git code if git repo is clean
        cd "$APP_ROOT"
        log "📥 Pulling latest code from origin main..."
        git fetch origin main
        git reset --hard origin/main

        # 3. Create fresh versioned release directory
        NEW_RELEASE_DIR="$RELEASES_DIR/release_$target_tag"
        mkdir -p "$NEW_RELEASE_DIR"

        # 4. Build and publish .NET 10 API
        log "🔨 Building and publishing SuperApp.API to $NEW_RELEASE_DIR..."
        dotnet publish backend/SuperApp.API/SuperApp.API.csproj \
            -c Release \
            -o "$NEW_RELEASE_DIR" \
            --nologo

        # 5. Preserve .env file in new release
        if [ -f "$APP_ROOT/.env" ]; then
            cp "$APP_ROOT/.env" "$NEW_RELEASE_DIR/.env"
        fi

        # 6. Update dist directory / symlink
        log "🔄 Updating dist to point to release $target_tag..."
        if [ -L "$DIST_DIR" ]; then
            rm -f "$DIST_DIR"
            ln -sfn "$NEW_RELEASE_DIR" "$DIST_DIR"
        else
            # If dist is a normal folder, backup & copy
            rm -rf "$DIST_DIR"/*
            cp -a "$NEW_RELEASE_DIR"/* "$DIST_DIR"/
        fi

        # 7. Restart systemd service
        log "🔄 Restarting $SERVICE_NAME..."
        systemctl restart "$SERVICE_NAME"

        # 8. Run Health Check with Auto-Rollback
        if check_health; then
            echo "$target_tag" > "$CURRENT_VER_FILE"
            log "🎉 Deployment of $target_tag COMPLETED SUCCESSFULLY!"
            prune_old_releases
            exit 0
        else
            log "⚠️ New release $target_tag failed health check! Initiating auto-rollback..."
            do_rollback
            exit 1
        fi
        ;;

    rollback)
        log "Manual rollback triggered..."
        do_rollback
        ;;

    list)
        echo "=========================================================="
        echo "📋 Available Releases in $RELEASES_DIR:"
        echo "=========================================================="
        if [ -d "$RELEASES_DIR" ]; then
            ls -dt "$RELEASES_DIR"/release_* 2>/dev/null | xargs -n1 basename || echo "No releases yet."
        fi
        echo ""
        echo "Active Version:    $(cat "$CURRENT_VER_FILE" 2>/dev/null || echo 'Unknown')"
        echo "Previous Healthy:  $(cat "$PREVIOUS_VER_FILE" 2>/dev/null || echo 'None')"
        ;;

    status)
        echo "=========================================================="
        echo "📊 Service Status ($SERVICE_NAME):"
        echo "=========================================================="
        systemctl status "$SERVICE_NAME" --no-pager || true
        echo ""
        echo "🩺 Health Check Probe:"
        curl -s "http://127.0.0.1:5000/health" || echo "API Unreachable"
        echo ""
        echo "Active Version:    $(cat "$CURRENT_VER_FILE" 2>/dev/null || echo 'Unknown')"
        ;;

    logs)
        journalctl -u "$SERVICE_NAME" -f -n 100
        ;;

    *)
        echo "Usage: $0 {deploy [tag]|rollback|list|status|logs}"
        exit 1
        ;;
esac
