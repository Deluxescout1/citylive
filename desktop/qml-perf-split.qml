import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// SPLIT PROBE. Answers ONE question: how much of the `live` pass is city-scale structure that
// changes over days, and how much is street life that changes every frame?
// Times bg / live / city / fg at 1552x874 — the canvas Nick's 4K@165% screen really uses — across
// several lands, in ONE run (cross-run ratios are meaningless, see qml-perf-coast.qml).
// For TWELVE lands: mesa 1 · heaven 2 · alpine 3 · sprawl 4 · swamp 5 · volcano 6 · plains 7 ·
// beach 8 · hell 21 · cliffs 42 · arctic 55 · forest 76.  The label printed includes the biome
// actually resolved — check it before trusting a number.
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
            var N = 60;
            function timePass(pass) {
                City.draw(g, pass);                                    // warm
                var t0 = Date.now();
                for (var i = 0; i < N; i++) { City.CLOCK = City.NOWOVR + i*40; City.draw(g, pass); }
                return (Date.now() - t0) / N;
            }
            function timeLife(life, label, age) {
                City.NOWOVR = EPOCH + life*CYC + Math.round(0.45*CYC);
                City.CLOCK  = City.NOWOVR;
                City.setup('neon', { cw: 1552, ch: 874, woff: 0, ww: 4656, pxk: 3, zoom: 1, quality: 'spectacle' });
                City.FORCEAGE = age;
                var name = City.curBiome.k + "/" + City.curBiome.name;
                var bg = timePass("bg"), live = timePass("live"), city = timePass("city"), fg = timePass("fg");
                console.log("SPLIT " + label + " " + name
                            + "   bg " + bg.toFixed(1)
                            + " | live " + live.toFixed(1)
                            + " | city " + city.toFixed(1)
                            + " | fg " + fg.toFixed(1)
                            + "   (city+fg " + (city+fg).toFixed(1) + ")");
                return { live: live, city: city, fg: fg };
            }
            City.weather.wind = 14; City.weather.temp = 62;
            var lives = [[3,"alpine "],[8,"beach  "],[76,"forest "],[42,"cliffs "],[4,"sprawl "],[21,"hell   "],[55,"arctic "],[5,"swamp  "]];
            var sumLive = 0, sumFg = 0, sumCity = 0;
            for (var i = 0; i < lives.length; i++) {
                var r = timeLife(lives[i][0], lives[i][1], 0.85);
                sumLive += r.live; sumFg += r.fg; sumCity += r.city;
            }
            console.log("SPLIT MEAN  live " + (sumLive/lives.length).toFixed(1)
                        + "  city " + (sumCity/lives.length).toFixed(1)
                        + "  fg " + (sumFg/lives.length).toFixed(1)
                        + "   -> fg is " + (100*sumFg/sumLive).toFixed(0) + "% of the live pass");
            // A young city too — the wilderness/terrain path is a different shape.
            timeLife(3, "alp@.30", 0.30);
            Qt.quit();
        }
    }
    Timer { interval: 300; running: true; repeat: true; onTriggered: cv.requestPaint() }
}
