import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// COAST PERF PROBE. qml-perf-biome.qml times at 853px, and that is the wrong width for the water
// lands specifically: every coast now paints its shoreline and depth grading PER ROW across a bay that
// is a fraction of SW, and `drawHarbor` runs in the LIVE pass, not only the cached backdrop. So the
// cost scales with screen width in a way the ordinary harness cannot see.
// This times at 1552x874 — the canvas Nick's 4K@165% screen actually uses — and it times the coast
// lands against a FIXED set of lives in ONE run, because ratios taken across different runs are not
// comparable: every time a biome is added the life map re-rolls and each land gets timed against a
// different city. Only within-run numbers mean anything.
Item {
    width: 1552; height: 874
    Canvas {
        id: cv; anchors.fill: parent; renderTarget: Canvas.FramebufferObject
        property bool done: false
        onPaint: {
            if (done) return; done = true;
            var g = getContext("2d");
            var CYC = 604800000, EPOCH = 1783972450746;
            City.GROW_CYCLE = CYC;
            function timeLife(life, label, N, age) {
                City.NOWOVR = EPOCH + life*CYC + Math.round(0.45*CYC);
                City.CLOCK  = City.NOWOVR;
                City.setup('neon', { cw: 1552, ch: 874, woff: 0, ww: 4656, pxk: 3, zoom: 1, quality: 'spectacle' });
                City.FORCEAGE = age;
                var biome = City.curBiome.k, vname = City.curBiome.name;
                City.draw(g, "bg");
                var t0 = Date.now();
                for (var i = 0; i < N; i++) { City.CLOCK = City.NOWOVR + i*40; City.draw(g, "live"); }
                var el = Date.now() - t0;
                console.log("COAST " + label + "  " + biome + "/" + vname + "  " + (el/N).toFixed(2) + " ms/frame");
                return el/N;
            }
            City.weather.wind = 14; City.weather.temp = 62;
            var N = 90;
            // Reference: a land with no water work at all, timed in the same run.
            var alp = timeLife(2, "alpine   ", N, 0.85);
            // Every coast, and every beach variant, so a slow VARIANT cannot hide behind a fast average.
            var b1 = timeLife(1,  "beach BLACK", N, 0.85);
            var b2 = timeLife(4,  "beach PINK ", N, 0.85);
            var b3 = timeLife(153,"beach CORAL", N, 0.85);
            var cl = timeLife(21, "cliffs   ", N, 0.85);
            var sw = timeLife(55, "swamp    ", N, 0.85);
            var ar = timeLife(29, "arctic   ", N, 0.85);
            console.log("COAST RATIOS vs alpine @1552 — beach " + (b1/alp).toFixed(2) + "/" + (b2/alp).toFixed(2)
                        + "/" + (b3/alp).toFixed(2) + "  cliffs " + (cl/alp).toFixed(2)
                        + "  swamp " + (sw/alp).toFixed(2) + "  arctic " + (ar/alp).toFixed(2));
            Qt.quit();
        }
    }
    Timer { interval: 300; running: true; repeat: true; onTriggered: cv.requestPaint() }
}
