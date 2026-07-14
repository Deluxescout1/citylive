#!/usr/bin/env bash
# Remove CityLive and switch desktops back to a plain image wallpaper.
set -euo pipefail
DEST="$HOME/.local/share/plasma/wallpapers/org.citylive.wallpaper"
DB="$(command -v qdbus6 || command -v qdbus || true)"
if [ -n "$DB" ]; then
  "$DB" org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.evaluateScript '
    var ds = desktops();
    for (var i = 0; i < ds.length; i++) ds[i].wallpaperPlugin = "org.kde.image";
  ' || true
fi
rm -rf "$DEST"
if command -v systemctl >/dev/null && systemctl --user is-active plasma-plasmashell.service >/dev/null 2>&1; then
  systemctl --user restart plasma-plasmashell.service
else
  kquitapp6 plasmashell 2>/dev/null || true; sleep 1; (nohup plasmashell >/dev/null 2>&1 &) || true
fi
echo "CityLive removed; desktops reset to a plain image wallpaper."
