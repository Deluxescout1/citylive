import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// COST OF THE BACKDROP PASS, under against alpine. Everything the Ashlands gained — hashed crags, the rift
// notch, the rib field, the flows, the floor fissures — is in `draw(g,"bg")`, which the live-pass harness
// never touches, so timing the live pass would have reported a clean bill for work it did not run.
//
// ⚠⚠ INTERLEAVED, AND REPORTED AS A RATIO. A perf A/B across two separate processes measured a real 18%
// win as a REGRESSION once already in this project, because the two runs had different harness shapes.
// Alternating the two lands inside ONE process removes per-run drift, and comparing under/alpine rather than
// under alone removes machine drift between the before and after runs as well.
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-perf-bg-under.qml
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
            var tot = { under: 0, alpine: 0 }, cnt = { under: 0, alpine: 0 };
            function one(land, hour) {
                City.FORCEBIOME = land; City.FORCEVARIANT = 1;
                var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
                d.setHours(hour, 10, 0, 0);
                City.NOWOVR = City.CLOCK = d.getTime();
                City.setup('city', { cw:1552, ch:874, woff:0, ww:2269, pxk:2, zoom:2,
                                     taskbarWp:28, quality:'balanced', frameMs:125 });
                City.FORCEAGE = 0.80;
                City.weather.code = 0; City.weather.wind = 10; City.weather.temp = 70; City.weather.cloud = 20;
                City.mtsCache = null;
                City.draw(g, "bg");                       // build the cache first — not what we are timing
                var t0 = Date.now();
                for (var i = 0; i < 12; i++) City.draw(g, "bg");
                var el = Date.now() - t0;
                tot[land] += el; cnt[land] += 12;
            }
            // alternate, both hours, several rounds
            for (var r = 0; r < 3; r++) {
                one("under", 13); one("alpine", 13); one("alpine", 23); one("under", 23);
            }
            var h = tot.under / cnt.under, a = tot.alpine / cnt.alpine;
            console.log("BGPERF under=" + h.toFixed(2) + "ms alpine=" + a.toFixed(2)
                        + "ms  ratio=" + (h / a).toFixed(3));
            Qt.callLater(Qt.quit);
        }
        Component.onCompleted: requestPaint()
    }
}
