import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// CAN A FISSURE ON THE FLOOR EVEN BE SEEN? Nick's locked rift is "fissures on the ground, BEHIND the
// city" — which is the exact band the Ashlands' own code comment (city.js:25390) says everything below
// HORIZON gets occluded in. So before building a fourth invisible feature, measure the band: per column,
// how many pixels of bare rock sit between the near ridge's skyline and the top of whatever the city
// puts in front of it.
//
// Reports, per screen: the median and the 10th/90th percentile of that gap, and what share of columns
// have less than 40px — the point below which a fissure has nowhere to draw.
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-hell-gap.qml
Item {
    id: root
    width: 1552; height: 874
    property var woffs: [0, 776, 1629]
    property int wi: 0
    property bool armed: false
    Canvas {
        id: bg; anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        onPaint: { City.draw(getContext("2d"), "bg"); }
    }
    function pct(a, p) { if (!a.length) return -1; var s = a.slice().sort(function(x,y){return x-y;}); return s[Math.min(s.length-1, Math.max(0,Math.round((s.length-1)*p)))]; }
    function report() {
        var CYC = 604800000, EPOCH = 1783972450746;
        City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null; City.FORCEDIS = null;
        City.FORCEBIOME = "hell"; City.FORCEVARIANT = 0;
        var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
        d.setHours(13, 10, 0, 0);
        City.NOWOVR = City.CLOCK = d.getTime();
        City.setup('city', { cw:1552, ch:874, woff:root.woffs[root.wi], ww:2269, pxk:2, zoom:2,
                             taskbarWp:28, quality:'balanced', frameMs:125 });
        City.FORCEAGE = 0.80;
        City.weather.code = 0; City.weather.wind = 10; City.weather.temp = 70; City.weather.cloud = 20;
        City.mtsCache = null;
        bg.requestPaint();
    }
    // ⚠ requestPaint is ASYNC. Reading mtsCache in the same tick that asks for the paint reads it
    // BEFORE draw() has built it, and reports "no mtsCache" three times. Arm on one tick, read on the next.
    function measure() {
        var C = City.mtsCache;
        if (!C) { console.log("no mtsCache"); return; }
        var SW = C.h[1].length, gy = City.HORIZON;
        // the highest thing the city puts in front of each column, across all three depth layers
        var top = new Array(SW); for (var i=0;i<SW;i++) top[i] = 1e9;
        var layers = [City.far, City.mid, City.near];
        for (var li=0; li<layers.length; li++) {
            var Ly = layers[li]; if (!Ly || !Ly.blds) continue;
            for (var b=0; b<Ly.blds.length; b++) {
                var B = Ly.blds[b];
                var x0 = Math.round(B.x), x1 = Math.round(B.x + B.w), ty = Math.round(gy - B.h);
                for (var x=Math.max(0,x0); x<Math.min(SW,x1); x++) if (ty < top[x]) top[x] = ty;
            }
        }
        var gaps = [], bare = 0, small = 0;
        for (var x2=0; x2<SW; x2++) {
            var rt = gy - C.h[1][x2];              // near ridge skyline
            var bt = (top[x2] > 1e8) ? gy : top[x2];
            if (top[x2] > 1e8) bare++;
            var g2 = bt - rt; if (g2 < 0) g2 = 0;
            gaps.push(g2); if (g2 < 40) small++;
        }
        console.log("WOFF " + root.woffs[root.wi] + "  SW=" + SW + " HORIZON=" + gy + " KSP=" + City.KSP
                    + "  ridgeTop p10/med/p90=" + pct(gaps,0.10) + "/" + pct(gaps,0.50) + "/" + pct(gaps,0.90)
                    + "  cols<40px=" + (100*small/SW).toFixed(1) + "%"
                    + "  cols with NO building=" + (100*bare/SW).toFixed(1) + "%");
    }
    Timer {
        interval: 300; running: true; repeat: true
        onTriggered: {
            if (root.wi >= root.woffs.length) { Qt.quit(); return; }
            if (root.armed) { measure(); root.armed = false; root.wi++; }
            else { report(); root.armed = true; }
        }
    }
}
