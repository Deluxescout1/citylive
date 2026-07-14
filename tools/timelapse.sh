#!/bin/bash
# CityLive TIMELAPSE — renders a whole civilization's life as a video.
# Usage: timelapse.sh [lifeIndex] [frames] [monitor: left|mid|right|world]
# The sim is deterministic, so any life (past or future!) can be filmed at any time.
set -e
LIFE="${1:-$(node -e 'const fs=require("fs"),os=require("os");const c=fs.readFileSync(os.homedir()+"/.local/share/plasma/wallpapers/org.citylive.wallpaper/contents/js/city.js","utf8");const e=/GROW_EPOCH=(\d+)/.exec(c),g=/GROW_CYCLE=(\d+)/.exec(c);console.log(Math.floor((Date.now()-+e[1])/+g[1]))')}"
FRAMES="${2:-360}"
MON="${3:-mid}"
case "$MON" in
  left)  WOFF=0;    CW=640; CH=360;;
  mid)   WOFF=582;  CW=640; CH=360;;
  right) WOFF=1222; CW=480; CH=270;;
  world) WOFF=0;    CW=1702; CH=360;;
esac
read EPOCH CYCLE < <(node -e 'const fs=require("fs"),os=require("os");const c=fs.readFileSync(os.homedir()+"/.local/share/plasma/wallpapers/org.citylive.wallpaper/contents/js/city.js","utf8");console.log(/GROW_EPOCH=(\d+)/.exec(c)[1],/GROW_CYCLE=(\d+)/.exec(c)[1])')
T0=$(( EPOCH + LIFE*CYCLE ))
OUT=~/CityLive/timelapses
TMP=$(mktemp -d)
echo "Rendering life $LIFE, $FRAMES frames ($MON view)…"
for i in $(seq 0 $((FRAMES-1))); do
  T=$(( T0 + CYCLE*i/FRAMES ))
  QF="$TMP/f.qml"
  cat > "$QF" <<QML
import QtQuick 2.15
import QtQuick.Window 2.15
import "file://$HOME/.local/share/plasma/wallpapers/org.citylive.wallpaper/contents/js/city.js" as City
Window { visible:true; width:$CW; height:$CH
  Canvas { id:cv; width:$CW; height:$CH; smooth:false
    onPaint:{ var g=getContext("2d");
      try{ City.CLOCK=$T; City.NOWOVR=$T;
        City.setup("neon",{cw:$CW,ch:$CH,woff:$WOFF,ww:1702,pxk:4,quality:"performance"});
        City.draw(g);
      }catch(e){ g.fillStyle="#f0f"; g.fillRect(0,0,20,20); }
    }
    Component.onCompleted: requestPaint()
    onPainted: cv.grabToImage(function(r){ r.saveToFile("$TMP/$(printf %04d $i).png"); Qt.quit(); })
  }
}
QML
  QT_QPA_PLATFORM=offscreen timeout 30 qml6 "$QF" >/dev/null 2>&1 || true
  [ $((i % 30)) -eq 0 ] && echo "  frame $i/$FRAMES"
done
NAME=$(node ~/CityLive/tools/lifename.js "$LIFE" 2>/dev/null || echo "life")
ffmpeg -y -framerate 24 -i "$TMP/%04d.png" -vf "scale=iw*2:ih*2:flags=neighbor" -c:v libx264 -pix_fmt yuv420p -crf 20 "$OUT/life-$LIFE-timelapse.mp4" >/dev/null 2>&1
rm -rf "$TMP"
echo "wrote $OUT/life-$LIFE-timelapse.mp4"
