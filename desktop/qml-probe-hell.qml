import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// NUMBERS, NOT PIXELS. What is the volcanic cone actually shaped like, and where does it stand?
// Reports HORIZON/KSP/WW, the authored cone's world x / height / half-width, and the near-band
// profile as seen from each of Nick's three screens — because "the whole cone in frame" is a claim
// about a profile, and it has now been asserted twice from one geometry.
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-cone-probe.qml
Item {
    id: root
    width: 1552; height: 874
    property var woffs: [0]
    property int wi: 0
    property int variant: 1
    property bool blown: false
    property var arcFs: [0.0]
    property int ai: 0
    property bool pinState: false
    Canvas {
        id: bg; anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        onPaint: { City.draw(getContext("2d"), "bg"); }
    }
    function report() {
        var CYC = 604800000, EPOCH = 1783972450746;
        City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null; 
        City.FORCEBIOME = "hell"; City.FORCEVARIANT = root.variant;
        // ⚠ PIN THE ERUPTION STATE. `volcanoErupted` scans this life's real disaster history, so an
        // unforced probe can silently measure a COLLAPSED cone and read as "the framed height never
        // arrives" — it cost a wrong diagnosis once already. f=0 forces intact, f=1 forces blown.
        City.FORCEDIS = { type:"volcano", intensity:4, xf:0.42, w:58, seed:451, f:root.arcFs[root.ai] };
        var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
        d.setHours(13, 10, 0, 0);
        City.NOWOVR = City.CLOCK = d.getTime();
        City.setup('city', { cw:1552, ch:874, woff:root.woffs[root.wi], ww:2269, pxk:2, zoom:2,
                             taskbarWp:28, quality:'balanced', frameMs:125 });
        City.FORCEAGE = 0.80;
        City.weather.code = 0; City.weather.wind = 12; City.weather.temp = 70; City.weather.cloud = 20;
        City.mtsCache = null;
        bg.requestPaint();
    }
    function dump() {
        var w = root.woffs[root.wi];
        console.log("=== f=" + root.arcFs[root.ai] + " woff " + w + " | SW=" + City.SW + " SH=" + City.SH + " WW=" + City.WW
                    + " KSP=" + City.KSP + " HORIZON=" + City.HORIZON + " SEA_Y=" + City.SEA_Y);
        var vE = City.volcanoErupted(City.NOWOVR);
        console.log("   volcanoErupted -> " + (vE ? ("HIT x="+Math.round(vE.x)+" i="+vE.i+" since="+Math.round(vE.since/1000)+"s") : "null (intact)") + "   mtsCache.blown=" + (City.mtsCache?City.mtsCache.blown:"?"));
        var near = City.mts ? City.mts.near : null;
        if (near) for (var i = 0; i < near.length; i++)
            console.log("   near[" + i + "] x=" + Math.round(near[i].x) + " h=" + Math.round(near[i].h)
                        + " w=" + Math.round(near[i].w));
        var hs = (City.mtsCache && City.mtsCache.h) ? City.mtsCache.h[1] : null;
        if (!hs) { console.log("   NO PROFILE"); return; }
        var line = "", peak = 0, peakX = -1;
        for (var x = 0; x < City.SW; x += 97) {
            var v = hs[x] == null ? 0 : Math.round(hs[x]);
            line += x + ":" + v + "  ";
        }
        for (var x2 = 0; x2 < City.SW; x2++) if (hs[x2] > peak) { peak = hs[x2]; peakX = x2; }
        console.log("   profile " + line);
        console.log("   PEAK screenx=" + peakX + " h=" + Math.round(peak)
                    + " (HORIZON=" + City.HORIZON + " -> summit y=" + Math.round(City.HORIZON - peak)
                    + ", sky above summit=" + Math.round(City.HORIZON - peak) + "px of " + City.SH + ")");
        console.log("   edge heights: x0=" + Math.round(hs[0]||0) + " xEnd=" + Math.round(hs[City.SW-1]||0));
        console.log("   WOFF=" + City.WOFF + " (setup woff=" + w + ")  KSP=" + City.KSP);
        if (near) {
            var sxp = Math.round(near[0].x - City.WOFF);
            var got = (sxp >= 0 && sxp < City.SW && hs[sxp] != null) ? Math.round(hs[sxp]) : "offscreen";
            console.log("   dominant cone world x=" + Math.round(near[0].x) + " -> screen x=" + sxp
                        + "  h there=" + got + "  (authored h=" + Math.round(near[0].h) + ")");
        }
    }
    Timer {
        interval: 400; running: true; repeat: true
        onTriggered: {
            if (root.wi >= root.woffs.length) { Qt.quit(); return; }
            if (!bg.available) return;
            root.report();
            dumpTimer.restart();
            running = false;
        }
    }
    Timer {
        id: dumpTimer; interval: 500
        onTriggered: { root.dump(); root.ai++; if (root.ai >= root.arcFs.length) { Qt.quit(); return; } stepTimer.restart(); }
    }
    Timer {
        id: stepTimer; interval: 200
        onTriggered: { root.report(); dumpTimer.restart(); }
    }
}
