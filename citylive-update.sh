#!/usr/bin/env bash
# CityLive — KDE Plasma wallpaper auto-updater.
#
# Checks the latest GitHub release; if it is newer than the installed plugin, downloads the release
# SOURCE TARBALL, extracts the wallpaper, PRESERVES your baked personal settings (localcfg.js), and
# ATOMICALLY swaps the new version into place.
#
# STAGE-ONLY BY DESIGN: it does NOT restart plasmashell. plasmashell keeps the old QML in memory, so
# swapping the files mid-session is invisible and harmless — the new version takes effect at your next
# login/reboot. (Run ./install.sh to apply immediately.) This means the daily timer can never flash your
# desktop or interrupt a game.
#
# Installed by install.sh as ~/.local/bin/citylive-update + a daily systemd --user timer. Logs to the
# journal: `journalctl --user -u citylive-update.service`.
set -euo pipefail

REPO="Deluxescout1/citylive"
DEST="$HOME/.local/share/plasma/wallpapers/org.citylive.wallpaper"
META="$DEST/metadata.json"

log(){ echo "[citylive-update] $*"; }

# read .KPlugin.Version out of a metadata.json (python3 → jq → grep fallback)
getver(){
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("KPlugin",{}).get("Version",""))' "$1" 2>/dev/null && return
  fi
  if command -v jq >/dev/null 2>&1; then
    jq -r '.KPlugin.Version // ""' "$1" 2>/dev/null && return
  fi
  grep -oE '"Version"[[:space:]]*:[[:space:]]*"[0-9.]+"' "$1" 2>/dev/null | grep -oE '[0-9.]+' | head -1
}

# read tag_name out of the GitHub releases/latest JSON on stdin
gettag(){
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys; print(json.load(sys.stdin).get("tag_name",""))' 2>/dev/null && return
  fi
  if command -v jq >/dev/null 2>&1; then
    jq -r '.tag_name // ""' 2>/dev/null && return
  fi
  grep -oE '"tag_name"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | grep -oE 'v?[0-9][0-9.]*'
}

# is $1 a strictly-newer version than $2? (semver-aware via sort -V)
newer(){ [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -1)" = "$1" ]; }

# must already be installed (via install.sh) before we can update it
[ -f "$META" ] || { log "no installed plugin at $DEST — run install.sh first"; exit 0; }
INST="$(getver "$META")"; [ -n "$INST" ] || { log "could not read installed version"; exit 0; }

# what's the latest release?
JSON="$(curl -fsSL --max-time 30 -H 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null)" \
  || { log "offline or GitHub unreachable — will retry next run"; exit 0; }
TAG="$(printf '%s' "$JSON" | gettag)"; [ -n "$TAG" ] || { log "could not read latest release tag"; exit 0; }
LATEST="${TAG#v}"

if ! newer "$LATEST" "$INST"; then log "up to date (installed $INST, latest $LATEST)"; exit 0; fi
log "new release available: $INST -> $LATEST"

# download + extract the release source tarball into a temp dir (GitHub wraps it in <owner>-<repo>-<sha>/)
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
if ! curl -fsSL --max-time 120 "https://github.com/$REPO/archive/refs/tags/$TAG.tar.gz" -o "$TMP/src.tgz"; then
  log "download failed — will retry next run"; exit 0
fi
tar -xzf "$TMP/src.tgz" -C "$TMP" 2>/dev/null || { log "extract failed"; exit 0; }
NEWPLUG="$(find "$TMP" -maxdepth 2 -type d -name org.citylive.wallpaper 2>/dev/null | head -1)"
[ -n "$NEWPLUG" ] && [ -f "$NEWPLUG/metadata.json" ] || { log "plugin not found in tarball"; exit 0; }

# validate the downloaded plugin parses + is the version we expected (never swap in something broken)
NEWVER="$(getver "$NEWPLUG/metadata.json")"
[ "$NEWVER" = "$LATEST" ] || { log "tarball version mismatch ($NEWVER != $LATEST) — aborting"; exit 0; }

# keep the user's baked personal settings (birthdays/location/cycle) — the release ships an empty localcfg.js
if [ -f "$DEST/contents/js/localcfg.js" ]; then
  cp -f "$DEST/contents/js/localcfg.js" "$NEWPLUG/contents/js/localcfg.js"
  log "preserved your baked settings (localcfg.js)"
fi

# stage into the SAME filesystem as $DEST so the final swap is an atomic rename, then swap with a backup + rollback
STAGE="$(dirname "$DEST")/.citylive.update.$$"
BK="$(dirname "$DEST")/.citylive.bak.$$"
rm -rf "$STAGE" "$BK"
cp -r "$NEWPLUG" "$STAGE" || { log "stage copy failed"; rm -rf "$STAGE"; exit 1; }
if mv "$DEST" "$BK" && mv "$STAGE" "$DEST"; then
  rm -rf "$BK"
  log "updated $INST -> $LATEST (applies at your next login; run install.sh to apply now)"
else
  log "swap failed — rolling back to $INST"
  [ -d "$DEST" ] || mv "$BK" "$DEST" 2>/dev/null || true
  rm -rf "$STAGE"
  exit 1
fi
