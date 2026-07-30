import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// WHAT IS THE DUNE FIELD ACTUALLY SHAPED LIKE? The rendered frame shows dune-ish forms, but the two
// things that decide whether sand reads as sand are numbers, not impressions:
//   1. HOW TALL IS A DUNE AGAINST HOW WIDE — a real dune is roughly 1:6 to 1:10, and the slip face is at
//      the angle of repose (~34°, dy/dx ~ 0.67). If the profile is 17px tall over a 450px cell, no amount
//      of shading will make it read; it is a ripple, not a dune.
//   2. DOES THE LIT/SHADOW FACE CODE ACTUALLY FIRE? It keys off `(pr[x+5]-pr[x-5])*0.4` against
//      thresholds 1.4 / -0.6. The whole diagnosis of this land is that it has never fired, so the share
//      of columns landing in sun / shadow / neutral is the number that says whether it does now.
// ⚠ Also reports how much of each band is the BAND BASE rather than the dune profile — if the base steps
// dominate, the "dunes" you see are cardboard flats and the profile is decoration on them.
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-dune-probe.qml
Item {
    id: root
    width: 1552; height: 874
    property var variants: [0, 1, 2]
    property int vi: 0
    property bool armed: false
    Canvas {
        id: bg; anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        onPaint: { City.draw(getContext("2d"), "bg"); }
    }
    function arm() {
        var CYC = 604800000, EPOCH = 1783972450746;
        City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null; City.FORCEDIS = null;
        City.FORCEBIOME = "dunes"; City.FORCEVARIANT = root.variants[root.vi];
        var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
        d.setHours(13, 10, 0, 0);
        City.NOWOVR = City.CLOCK = d.getTime();
        City.setup('city', { cw:1552, ch:874, woff:0, ww:2269, pxk:2, zoom:2,
                             taskbarWp:28, quality:'balanced', frameMs:125 });
        City.FORCEAGE = 0.80;
        City.weather.code = 0; City.weather.wind = 10; City.weather.temp = 70; City.weather.cloud = 20;
        City.duneCache = null;
        bg.requestPaint();
    }
    function measure() {
        var C = City.duneCache;
        if (!C || !C.length) { console.log("no duneCache"); return; }
        var gy = City.HORIZON, SW = C[0].length, K = Math.max(1, City.KSP);
        var out = "VARIANT " + root.variants[root.vi] + "  " + City.curBiome.name
                + "  HORIZON=" + gy + " SW=" + SW + " KSP=" + City.KSP.toFixed(2) + " amp=" + City.curBiome.amp;
        for (var b = 0; b < C.length; b++) {
            var pr = C[b];
            var lo = 1e9, hi = -1e9, sun = 0, shad = 0, body = 0, maxSlope = 0, minSlope = 0;
            for (var x = 0; x < SW; x++) {
                if (pr[x] < lo) lo = pr[x];
                if (pr[x] > hi) hi = pr[x];
                var slope = (pr[Math.min(SW-1, x+5)] - pr[Math.max(0, x-5)]) * 0.4;
                if (slope > maxSlope) maxSlope = slope;
                if (slope < minSlope) minSlope = slope;
                if (slope > 1.4) shad++; else if (slope < -0.6) sun++; else body++;
            }
            // the steepest real gradient, in degrees, using the same 10px span the shader samples over
            var deg = Math.atan((maxSlope / 0.4) / 10) * 180 / Math.PI;
            out += "\n  band" + b + ": relief=" + (hi - lo).toFixed(1) + "px"
                 + "  top=" + lo.toFixed(0) + " bottom=" + hi.toFixed(0)
                 + "  fills to HORIZON so covers " + (gy - lo).toFixed(0) + "px ("
                 + (100*(gy - lo)/gy).toFixed(0) + "% of sky)"
                 + "\n          steepest lee slope=" + deg.toFixed(1) + "deg (repose is ~34)"
                 + "   FACES: sun " + (100*sun/SW).toFixed(1) + "%  shadow " + (100*shad/SW).toFixed(1)
                 + "%  neutral " + (100*body/SW).toFixed(1) + "%";
        }
        console.log(out);
    }
    Timer {
        interval: 320; running: true; repeat: true
        onTriggered: {
            if (root.vi >= root.variants.length) { Qt.quit(); return; }
            if (root.armed) { measure(); root.armed = false; root.vi++; }
            else { arm(); root.armed = true; }
        }
    }
}
