#!/bin/bash
# CityLive ATLAS — renders the FULL world of the current life (all 1702 world px, not one monitor's
# slice) to a single PNG, so the dashboard can show "today's world" and the household owner can
# actually EYEBALL lands that the wallpaper's real estate hides behind windows.
# Usage: atlas.sh            → ~/CityLive/atlas-current.png (life running right now)
#        atlas.sh <lifeIndex> → ~/CityLive/atlas-life-<n>.png
# The engine is deterministic: a past life is a legitimate subject. One offscreen QML frame, the
# same renderer the plasma surface runs — nothing here is a reimplementation.
set -e
LIFE="${1:-$(node ~/CityLive/tools/lifeindex.js life)}"
read EPOCH CYCLE < <(node ~/CityLive/tools/lifeindex.js epoch cycle)
# live mode: render the REAL wall clock, so the dashboard shows the state of the world NOW.
if [ "$1" = "" ]; then T=$(date +%s)000; else T=$(( EPOCH + LIFE*CYCLE + CYCLE/2 )); fi
NAME=$(node ~/CityLive/tools/lifename.js "$LIFE" 2>/dev/null || echo life)
OUT="$HOME/CityLive/atlas-$([ "$1" = "" ] && echo current || echo "life-$LIFE").png"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
QF="$TMP/atlas.qml"
cat > "$QF" <<QML
import QtQuick 2.15
import QtQuick.Window 2.15
import "file://$HOME/.local/share/plasma/wallpapers/org.citylive.wallpaper/contents/js/city.js" as City
Window { visible:true; width:1702; height:400
  Canvas { id:cv; width:1702; height:400; smooth:false
    onPaint:{ var g=getContext("2d");
      try{ City.CLOCK=$T; City.NOWOVR=$T;
        City.setup("neon",{cw:1702,ch:400,woff:0,ww:1702,pxk:4,quality:"performance"});
        City.draw(g);
      }catch(e){ g.fillStyle="#f0f"; g.fillRect(0,0,30,30); }
    }
    Component.onCompleted: requestPaint()
    onPainted: cv.grabToImage(function(r){ r.saveToFile("$TMP/atlas.png"); Qt.quit(); })
  }
}
QML
QT_QPA_PLATFORM=offscreen timeout 60 qml6 "$QF" >/dev/null 2>&1
[ -f "$TMP/atlas.png" ] || { echo "atlas render failed" >&2; exit 1; }
mv "$TMP/atlas.png" "$OUT"
echo "wrote $OUT (life $LIFE: $NAME)"