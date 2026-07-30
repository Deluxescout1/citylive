import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// WHAT DOES THE VOLCANO COST PER LIVE FRAME? — timed on the REAL Qt Canvas, at Nick's REAL primary
// geometry, on the variant with the most surface on it.
//
// Why this exists: `drawVolcano` runs in the LIVE pass, which on his `balanced` setting repaints every
// 125 ms, while the bg canvas repaints every 2000 ms. Everything static in that function is therefore
// being redrawn 16x more often than it needs to be, on three screens. Before moving any of it, measure
// how big that actually is — a split is only worth its risk if the number justifies it.
//
// ⚠ TIMED BY DIRECT CALL, not by biome life index. `qml-perf-biome.qml` selects lands by life number
// and its own header records that those indices have gone stale FIVE times as biomes were added. This
// pins the land with FORCEBIOME instead, so it cannot silently time the wrong map.
// ⚠ INTERLEAVED. Blocks alternate A/B/A/B and the MEDIAN of each is reported, because a single
// back-to-back pair on a busy machine has been wrong here before.
// ⚠ Paint the bg pass twice before timing: the first is the one that BUILDS mtsCache.
//
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-perf-volcano.qml
Item {
    id: root
    width: 1552; height: 874
    property int variant: 0          // THE GREEN ISLAND — the canopy makes it the heaviest surface
    property int hour: 13
    property bool liveOnly: true     // time ONLY whole live frames, for a clean before/after of the split
    Canvas {
        id: cv; anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        property bool done: false
        onPaint: {
            if (done) return; done = true;
            var g = getContext("2d");
            var CYC = 604800000, EPOCH = 1783972450746;
            City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null; City.FORCEDIS = null;
            City.FORCEBIOME = "sprawl"; City.FORCEVARIANT = root.variant;
            var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
            d.setHours(root.hour, 10, 0, 0);
            var t0 = d.getTime();
            City.NOWOVR = City.CLOCK = t0;
            // woff 776 puts the dominant cone on screen — timing a screen that only sees a flank
            // measures the wrong thing entirely.
            City.setup('city', { cw:1552, ch:874, woff:776, ww:2269, pxk:2, zoom:2,
                                 taskbarWp:28, quality:'balanced', frameMs:125 });
            City.FORCEAGE = 0.80;
            City.weather.code = 0; City.weather.wind = 12; City.weather.temp = 70; City.weather.cloud = 20;
            City.draw(g, "bg"); City.draw(g, "bg");        // the second one has mtsCache built

            function med(a){ a = a.slice().sort(function(x,y){return x-y}); return a[a.length>>1]; }
            function timeIt(fn, N) {
                var s = Date.now();
                for (var i = 0; i < N; i++) { City.CLOCK = t0 + i*125; fn(i); }
                return (Date.now() - s) / N;
            }
            var N = 60, ROUNDS = root.liveOnly ? 9 : 5;
            var live = [], volc = [], surf = [];
            var L = City.dayLight ? City.dayLight(new Date(t0)) : 0.95;
            for (var r = 0; r < ROUNDS; r++) {
                // A: a whole live frame
                live.push(timeIt(function(){ City.draw(g, "live"); }, N));
                if (root.liveOnly) continue;
                // B: the volcano's LIVE half — what still runs eight times a second
                volc.push(timeIt(function(){ City.drawVolcanoLive(g, L, City.CLOCK, new Date(City.CLOCK)); }, N));
                // C: the static surface, for the record — this now runs at bg cadence (0.5/s), not here
                surf.push(timeIt(function(){ City.drawVolcanoSurface(g, L, City.CLOCK, new Date(City.CLOCK)); }, N));
            }
            if (root.liveOnly) {
                console.log("PERF LIVEONLY frame    " + med(live).toFixed(3) + " ms   (median of " + ROUNDS + " x " + N + ")");
                console.log("PERF LIVEONLY samples  " + live.map(function(v){return v.toFixed(2)}).join("  "));
                Qt.callLater(Qt.quit); return;
            }
            var mLive = med(live), mVolc = med(volc), mSurf = med(surf);
            console.log("PERF live frame        " + mLive.toFixed(3) + " ms   (median of " + ROUNDS + " x " + N + ")");
            console.log("PERF drawVolcanoLive   " + mVolc.toFixed(3) + " ms   = "
                        + (100*mVolc/mLive).toFixed(1) + "% of a live frame  (still per-frame)");
            console.log("PERF drawVolcanoSurface " + mSurf.toFixed(3) + " ms   = "
                        + (100*mSurf/mLive).toFixed(1) + "% of a live frame  (MOVED to bg, 0.5/s)");
            console.log("PERF live samples      " + live.map(function(v){return v.toFixed(2)}).join("  "));
            console.log("PERF live-half samples " + volc.map(function(v){return v.toFixed(2)}).join("  "));
            console.log("PERF surface samples   " + surf.map(function(v){return v.toFixed(2)}).join("  "));
            // What the split would save: the static part stops running at 8 fps and runs at 0.5 fps.
            console.log("PERF  -> at frameMs=125 the live pass runs 8/s and bg 0.5/s, so every ms moved");
            console.log("PERF     out of drawVolcano is ~16x less work on each of three screens.");
            Qt.callLater(Qt.quit);
        }
    }
    Component.onCompleted: cv.requestPaint()
}
