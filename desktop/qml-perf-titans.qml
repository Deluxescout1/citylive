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
            // 🚨 "logout" IS ALSO AN APOCALYPSE. It is the right control for "did MY change cost
            // anything", and it is the WRONG one for "is the wallpaper slower than usual", which is
            // what Nick can actually see. `peak` is a normal living city — the thing the titans are
            // replacing on screen — and it is the only arm that answers his question.
            var ends = ["thetitans", "logout", "peak"];
            var tot = {}, cnt = {};
            for (var i = 0; i < ends.length; i++) { tot[ends[i]] = 0; cnt[ends[i]] = 0; }
            // ap 0.70 — the wall is close, all ranks exist and the footfall fires are running, i.e. the
            // most expensive part of the arc. APOC_BAND(0.02) * GROW_CYCLE, so ap = ms / 12096000.
            // 🚨🔑🔑 ONE POINT ON AN ARC IS NOT THE ENDING'S COST — same mistake as judging a land
            // from one life. At ap 0.70 the city is already flattened, so the wall is drawn INSTEAD of
            // buildings/traffic/people and comes out CHEAPER than normal. The expensive frame is the
            // APPROACH: a fully alive city with three-to-four ranks of titans drawn on top of it. And
            // `c6e56b7` made that worse on purpose — fixing the premature panic keeps the city
            // populated far longer, which is correct and is not free.
            var APS = [0.15, 0.25, 0.35, 0.55, 0.70, 1.00];
            function one(death, AP) {
                var MS = Math.round(AP * 0.02 * CYC);
                var normal = (death === "peak");
                City.FORCEBIOME = "plains"; City.FORCEVARIANT = 0;
                var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
                d.setHours(13, 10, 0, 0);
                City.NOWOVR = City.CLOCK = d.getTime();
                City.setup('city', { cw:1552, ch:874, woff:1629, ww:2269, pxk:2, zoom:2,
                                     taskbarWp:28, quality:'balanced', frameMs:125 });
                City.FORCEAGE = 0.80;
                if (normal) { City.FORCEDEATH = null; City.FORCEAPOCMS = null; }
                else { City.FORCEDEATH = death; City.FORCEAPOCMS = MS; }
                City.weather.code = 0; City.weather.wind = 10; City.weather.temp = 70; City.weather.cloud = 20;
                City.mtsCache = null;
                City.draw(g, "bg");                       // build caches — not what we are timing
                City.draw(g, "live");
                var t0 = Date.now();
                for (var k = 0; k < 20; k++) { City.NOWOVR = City.CLOCK = d.getTime() + k*140; City.draw(g, "live"); }
                return (Date.now() - t0) / 20;
            }
            var out = "WALL COST ISOLATED (ms per LIVE frame, woff=1629)\n";
            var pk = 0;
            for (var r = 0; r < 3; r++) pk += one("peak", 0);
            pk /= 3;
            out += "  peak (NORMAL LIVING CITY) = " + pk.toFixed(2) + "ms   <-- the bar\n";
            for (var a = 0; a < APS.length; a++) {
                var on = 0, off = 0;
                for (var r2 = 0; r2 < 3; r2++) { City.PERFNOWALL = false; on += one("thetitans", APS[a]);
                                                 City.PERFNOWALL = true;  off += one("thetitans", APS[a]); }
                on /= 3; off /= 3; City.PERFNOWALL = false;
                out += "  ap " + APS[a].toFixed(2) + "  full=" + on.toFixed(1) + "  no-wall=" + off.toFixed(1)
                     + "   WALL COSTS " + (on-off).toFixed(1) + "ms   (x" + (on/pk).toFixed(2) + " of normal)\n";
            }
            console.log(out);
            Qt.callLater(Qt.quit);
        }
        Component.onCompleted: requestPaint()
    }
}
