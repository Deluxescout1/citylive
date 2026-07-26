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
            // AGE MATTERS. Timing only a young city misses everything that exists because the city
            // grew — the plateau settlements, their people and traffic, the landmarks. A mesa timed at
            // 0.30 has one shack on one table and reads CHEAPER than alpine, which is meaningless.
            function timeLife(life, label, N, age) {
                City.NOWOVR = EPOCH + life*CYC + Math.round(0.45*CYC);
                City.CLOCK  = City.NOWOVR;
                City.setup('neon', { cw: 853, ch: 480, woff: 0, ww: 2269, pxk: 3, zoom: 1, quality: 'spectacle' });
                City.FORCEAGE = (age === undefined ? 0.30 : age);
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
            // ⚠⚠ LIVES REMAP EVERY TIME A BIOME IS ADDED — `biomeOf` is a hash modulo BIOMES.length,
            // so every life re-rolls and every number in this file goes stale. This has now happened
            // twice: 5→7 (hell+heaven) and 7→8 (the coral coast). Re-derived for EIGHT:
            // hell 1 · heaven 2 · alpine 3 · forest 4 · mesa 5 · cliffs 6 · plains 7 · beach 8.
            // Distribution over 4000 lives is 12.5% each. If you add a ninth, re-derive again or this
            // harness silently times the wrong lands and labels them confidently.
            var alpine = timeLife(3,  "alpine", N);
            var forest = timeLife(4,  "forest", N);
            var mesa   = timeLife(5,  "mesa",   N);
            var cliffs = timeLife(6,  "cliffs", N);
            var plains = timeLife(7,  "plains", N);
            var hell   = timeLife(1,  "hell",   N);
            var heaven = timeLife(2,  "heaven", N);
            var beach  = timeLife(8,  "beach",  N);
            // ⚠ THE MATURE BLOCK USED TO SKIP FOREST AND PLAINS — the two biomes whose accents draw
            // in the LIVE pass every frame, i.e. exactly the two whose cost the mature case was most
            // likely to expose. All seven are timed at 0.85 now.
            var alpineM = timeLife(3,  "alpine@0.85", N, 0.85);
            var forestM = timeLife(4,  "forest@0.85", N, 0.85);
            var mesaM   = timeLife(5,  "mesa@0.85",   N, 0.85);
            var cliffsM = timeLife(6,  "cliffs@0.85", N, 0.85);
            var plainsM = timeLife(7,  "plains@0.85", N, 0.85);
            var hellM   = timeLife(1,  "hell@0.85",   N, 0.85);
            var heavenM = timeLife(2,  "heaven@0.85", N, 0.85);
            var beachM  = timeLife(8,  "beach@0.85",  N, 0.85);
            console.log("PERF MATURE vs alpine — forest " + (forestM/alpineM).toFixed(2)
                      + "x  mesa " + (mesaM/alpineM).toFixed(2)
                      + "x  cliffs " + (cliffsM/alpineM).toFixed(2)
                      + "x  plains " + (plainsM/alpineM).toFixed(2)
                      + "x  hell " + (hellM/alpineM).toFixed(2)
                      + "x  heaven " + (heavenM/alpineM).toFixed(2)
                      + "x  beach " + (beachM/alpineM).toFixed(2) + "x");
            console.log("PERF vs alpine — forest " + (forest/alpine).toFixed(2)
                      + "x  mesa " + (mesa/alpine).toFixed(2)
                      + "x  cliffs " + (cliffs/alpine).toFixed(2)
                      + "x  plains " + (plains/alpine).toFixed(2)
                      + "x  hell " + (hell/alpine).toFixed(2)
                      + "x  heaven " + (heaven/alpine).toFixed(2) + "x");
            Qt.quit();
        }
    }
    Timer { interval: 300; running: true; repeat: true; onTriggered: cv.requestPaint() }
}
