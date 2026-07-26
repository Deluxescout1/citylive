import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// ABLATION PROBE — the only honest way to find what the live pass actually spends.
//
// Canvas op COUNTS do not predict time here: the `city` pass issues 32.6k ops in 4.8 ms while `fg`
// issues 19.1k in 15.9 ms. Five times the cost per op means the cost is NOT the canvas command
// stream — it is JavaScript, and counting cannot see that. So: stub one function at a time on the
// real V4 runtime and measure what the frame loses. Whatever a stub gives back IS that function's
// true cost, engine JS and canvas work together.
//
// Assigning over City.<fn> works because a QML .js import shares one scope object, and the engine's
// internal calls resolve through it (the same reason City.NOWOVR / City.GROW_CYCLE work).
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
            var N = 40, PASS = Qt.application.arguments.indexOf("--live") >= 0 ? "live" : "fg";

            function bench(pass) {
                City.draw(g, pass);
                var t0 = Date.now();
                for (var i = 0; i < N; i++) { City.CLOCK = City.NOWOVR + i*40; City.draw(g, pass); }
                return (Date.now() - t0) / N;
            }
            function noop() {}

            // Auto-discover every top-level draw/step function rather than guessing a list —
            // the point of an ablation sweep is to find the hot spot nobody suspected.
            var ALL = [];
            for (var k in City) {
                if (k === "draw" || k === "setup") continue;
                if (typeof City[k] === "function" && /^(draw|step|fill|paint|render|people|P_)/.test(k)) ALL.push(k);
            }

            function runLand(life, label) {
                City.NOWOVR = EPOCH + life*CYC + Math.round(0.45*CYC);
                City.CLOCK  = City.NOWOVR;
                City.setup('neon', { cw: 1552, ch: 874, woff: 0, ww: 4656, pxk: 3, zoom: 1, quality: 'balanced', frameMs: 200 });
                City.FORCEAGE = 0.85;
                City.weather.wind = 14; City.weather.temp = 62;
                var base = bench(PASS);
                console.log("\nABLATE " + label + " " + City.curBiome.k + "/" + City.curBiome.name
                            + "   baseline " + PASS + " = " + base.toFixed(2) + " ms");
                for (var i = 0; i < ALL.length; i++) {
                    var name = ALL[i];
                    if (typeof City[name] !== "function") continue;
                    var orig = City[name];
                    City[name] = noop;
                    var t = bench(PASS);
                    City[name] = orig;
                    var saved = base - t;
                    if (saved > 0.15)
                        console.log("   -" + saved.toFixed(2).padStart(6) + " ms  ("
                                    + (100*saved/base).toFixed(0).padStart(2) + "%)  " + name);
                }
            }
            console.log("ABLATE sweeping " + ALL.length + " functions on pass " + PASS);
            runLand(76, "forest");
            runLand(8,  "beach");
            runLand(4,  "sprawl");
            Qt.quit();
        }
    }
    Timer { interval: 300; running: true; repeat: true; onTriggered: cv.requestPaint() }
}
