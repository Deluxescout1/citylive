import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// ⏱️ WHAT DOES PACKING THE RUMBLING COST? Nick asked for the wall shoulder-to-shoulder, which is ~2x
// the titans per rank, and a per-body muscle/steam rebuild is queued behind it. Timing those together
// would tell me the total and nothing about which half to fix, so this measures DENSITY ALONE, before
// the bodies change.
//
// 🚨 THE CONTROL IS `logout`, AND THE CHOICE IS NOT ARBITRARY. This log already records a run where
// warmachine (+0.94) and `thepit` (+1.02) both looked like regressions and BOTH were APOC_SWEEP —
// they were measuring the same new code as the thing under test. `logout` deliberately demolishes
// nothing and shares no sweep machinery, so it moves only with the machine.
// 🖥️ That matters more than usual right now: he is gaming while this runs (load ~17), so the absolute
// numbers are noise. THE RATIO IS THE MEASUREMENT. Interleaved so drift hits both arms equally.
//
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-perf-titans.qml
Item {
    width: 1552; height: 874
    Canvas {
        id: cv; anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        property bool done: false
        onPaint: {
            if (done) return; done = true;
            var g = getContext("2d");
            var CYC = 604800000, EPOCH = 1783972450746;
            City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null; City.FORCEDIS = null;
            var ends = ["thetitans", "logout"];
            var tot = {}, cnt = {};
            for (var i = 0; i < ends.length; i++) { tot[ends[i]] = 0; cnt[ends[i]] = 0; }
            // ap 0.70 — the wall is close, all ranks exist and the footfall fires are running, i.e. the
            // most expensive part of the arc. APOC_BAND(0.02) * GROW_CYCLE, so ap = ms / 12096000.
            var AP = 0.70, MS = Math.round(AP * 0.02 * CYC);
            function one(death) {
                City.FORCEBIOME = "plains"; City.FORCEVARIANT = 0;
                var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
                d.setHours(13, 10, 0, 0);
                City.NOWOVR = City.CLOCK = d.getTime();
                City.setup('city', { cw:1552, ch:874, woff:1629, ww:2269, pxk:2, zoom:2,
                                     taskbarWp:28, quality:'balanced', frameMs:125 });
                City.FORCEAGE = 0.80;
                City.FORCEDEATH = death; City.FORCEAPOCMS = MS;
                City.weather.code = 0; City.weather.wind = 10; City.weather.temp = 70; City.weather.cloud = 20;
                City.mtsCache = null;
                City.draw(g, "bg");                       // build caches — not what we are timing
                City.draw(g, "live");
                var t0 = Date.now();
                for (var k = 0; k < 20; k++) { City.NOWOVR = City.CLOCK = d.getTime() + k*140; City.draw(g, "live"); }
                tot[death] += Date.now() - t0; cnt[death] += 20;
            }
            for (var r = 0; r < 4; r++)
                for (var j = 0; j < ends.length; j++) one(ends[j]);
            var ctl = tot["logout"] / cnt["logout"];
            var tit = tot["thetitans"] / cnt["thetitans"];
            console.log("TITANPERF (ms per LIVE frame, ap=" + AP + ", woff=1629)"
                      + "\n  logout    (control) = " + ctl.toFixed(2) + "ms"
                      + "\n  thetitans           = " + tit.toFixed(2) + "ms"
                      + "\n  RATIO thetitans/logout = " + (tit/ctl).toFixed(3));
            Qt.callLater(Qt.quit);
        }
        Component.onCompleted: requestPaint()
    }
}
