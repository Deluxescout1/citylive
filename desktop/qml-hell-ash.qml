import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// THE ASHFALL, AND WHETHER IT REACHES THE PEOPLE.
// Two things to establish, in this order:
//   1. does `ashfallK` actually produce the shape Nick asked for — a light permanent haze with occasional
//      heavy falls — or is it flat? Scanned over 48 h at 15-minute steps and reported as a histogram plus
//      the peaks, BEFORE rendering anything. A render of a frame that happens to be at baseline would
//      "prove" the feature absent.
//   2. at the worst minute found, does the street actually empty, do the lamps come on, is there dust?
//      Rendered against a baseline minute at the SAME hour of day, so daylight cannot be the difference.
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-hell-ash.qml
Item {
    id: root
    width: 1552; height: 874
    property double tPeak: 0
    property double tCalm: 0
    property int phase: 0
    property int warm: 0
    property double t0: 0
    property var labels: ["calm", "peak"]
    property int si: 0
    property string outDir: "/tmp/claude-1000/-home-deluxescout/4918a477-0edb-4bc7-806e-a62894ab0912/scratchpad"

    function base(t) {
        var CYC = 604800000, EPOCH = 1783972450746;
        City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null; City.FORCEDIS = null;
        City.FORCEBIOME = "hell"; City.FORCEVARIANT = 0;
        City.NOWOVR = City.CLOCK = t;
        City.setup('city', { cw:1552, ch:874, woff:776, ww:2269, pxk:2, zoom:2,
                             taskbarWp:28, quality:'balanced', frameMs:125 });
        City.FORCEAGE = 0.80;
        City.weather.code = 0; City.weather.cloud = 15; City.weather.wind = 12; City.weather.temp = 70;
        City.wetness = 0; City.ashQuench = 0;
    }
    function scan() {
        var CYC = 604800000, EPOCH = 1783972450746;
        var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
        d.setHours(13, 0, 0, 0);
        var t00 = d.getTime();
        base(t00);
        var bins = [0,0,0,0,0], n = 0, best = -1, bestT = 0, worst = 2, worstT = 0;
        // ⚠ only compare like with like: sample the SAME hour-of-day (13:00) on successive half-days so the
        // calm and peak frames cannot differ by daylight.
        for (var m = 0; m < 48*4; m++) {
            var t = t00 + m*900000;
            var k = City.ashfallK(t);
            bins[Math.min(4, Math.floor(k*5))]++; n++;
            var hh = new Date(t).getHours();
            if (hh === 13) {
                if (k > best) { best = k; bestT = t; }
                if (k < worst) { worst = k; worstT = t; }
            }
        }
        console.log("ASHK 48h bins(0-.2/.2-.4/.4-.6/.6-.8/.8-1) = " + bins.join(" / ") + "  n=" + n);
        console.log("ASHK at 13:00 — calmest=" + worst.toFixed(3) + "  heaviest=" + best.toFixed(3));
        root.tCalm = worstT; root.tPeak = bestT;
    }
    Canvas {
        id: bg; anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        onPaint: { City.NOWOVR = City.CLOCK = root.t0; City.draw(getContext("2d"), "bg"); }
    }
    Canvas {
        id: live; anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        onPaint: { City.NOWOVR = City.CLOCK = root.t0; City.draw(getContext("2d"), "live"); }
    }
    Timer {
        interval: 350; running: true; repeat: true
        onTriggered: {
            if (root.phase === 0) { scan(); root.phase = 1; return; }
            if (root.si >= 2) { Qt.quit(); return; }
            if (root.warm === 0) { root.t0 = (root.si === 0) ? root.tCalm : root.tPeak; base(root.t0); }
            bg.requestPaint(); live.requestPaint();
            if (root.warm < 1) { root.warm++; return; }
            // ⚠ GUARDED. An exception thrown in this handler leaves `si` un-incremented, so the timer
            // re-fires forever and the harness hangs instead of failing — which is exactly what a bad
            // property reference in this log line did on the first run.
            try {
                console.log("FRAME " + root.labels[root.si] + " ashK=" + City.ashK.toFixed(3)
                            + " ashHeavy=" + City.ashHeavy.toFixed(3)
                            + " maskK=" + City.curMaskK.toFixed(3)
                            + " dust=" + City.ashDustK(root.t0).toFixed(3));
            } catch (e) { console.log("FRAME " + root.labels[root.si] + " LOG FAILED: " + e); }
            root.grabToImage(function(res){
                res.saveToFile(root.outDir + "/ash-hell-" + root.labels[root.si] + ".png");
                root.warm = 0; root.si++;
            });
        }
    }
}
