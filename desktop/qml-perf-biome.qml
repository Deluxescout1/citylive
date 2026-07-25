import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// Per-frame COST of a forest life against an alpine one, on the REAL Qt Canvas — the runtime the
// wallpaper actually runs on. node/Electron did not surface the citizen-sim freeze either; a green
// light there says nothing about frame budget here. Prints ms/frame for each biome.
Item {
    width: 853; height: 480
    Canvas {
        id: cv; anchors.fill: parent; renderTarget: Canvas.FramebufferObject
        property bool done: false
        onPaint: {
            if (done) return; done = true;
            var g = getContext("2d");
            var CYC = 604800000, EPOCH = 1783972450746;
            City.GROW_CYCLE = CYC;
            function timeLife(life, label, N) {
                City.NOWOVR = EPOCH + life*CYC + Math.round(0.45*CYC);
                City.CLOCK  = City.NOWOVR;
                City.setup('neon', { cw: 853, ch: 480, woff: 0, ww: 2269, pxk: 3, zoom: 1, quality: 'spectacle' });
                City.FORCEAGE = 0.30;
                var biome = City.curBiome.k;
                City.draw(g, "bg");                                   // warm the cached backdrop once
                var t0 = Date.now();
                for (var i = 0; i < N; i++) { City.CLOCK = City.NOWOVR + i*40; City.draw(g, "live"); }
                var el = Date.now() - t0;
                console.log("PERF " + label + " biome=" + biome + " " + (el/N).toFixed(2) + " ms/frame  (" + N + " frames, " + el + " ms)");
                return el/N;
            }
            // Wind high enough that the dust devils, sea spray and wind waves are all ACTIVE — they
            // are keyed to the real measurement, so timing them on a calm day measures nothing.
            City.weather.wind = 20; City.weather.temp = 86;
            var N = 120;
            var alpine = timeLife(6, "alpine", N);
            var forest = timeLife(8, "forest", N);
            var mesa   = timeLife(11, "mesa",  N);
            var cliffs = timeLife(1, "cliffs", N);
            var plains = timeLife(3, "plains", N);
            console.log("PERF vs alpine — forest " + (forest/alpine).toFixed(2)
                      + "x  mesa " + (mesa/alpine).toFixed(2)
                      + "x  cliffs " + (cliffs/alpine).toFixed(2)
                      + "x  plains " + (plains/alpine).toFixed(2) + "x");
            Qt.quit();
        }
    }
    Timer { interval: 300; running: true; repeat: true; onTriggered: cv.requestPaint() }
}
