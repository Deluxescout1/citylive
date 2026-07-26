import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// HITCH PROBE — "there are some freeze ups". A low frame rate is not a freeze; a freeze is ONE
// frame that takes far longer than the rest. Averages hide those completely, so this reports the
// WORST frame and the distribution, and separately times the two known synchronous cliffs:
//   · buildWorld — a whole new city rolled inside a paint, on the life rollover
//   · setup      — re-run by main.qml's 6s settle timer and on every geometry change
// At 1552x874, the canvas Nick's 4K@165% screen really uses.
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
            City.NOFETCH = true;                       // a probe must not wait on the network

            function stats(a) {
                a = a.slice().sort(function (x, y) { return x - y; });
                var sum = 0; for (var i = 0; i < a.length; i++) sum += a[i];
                return { mean: sum/a.length, p50: a[(a.length*0.5)|0], p95: a[(a.length*0.95)|0], max: a[a.length-1] };
            }

            // ---- 1. frame-time distribution over a long run, per land ----
            var lives = [[76,"forest"],[8,"beach"],[4,"sprawl"],[55,"arctic"],[3,"core  "]];
            for (var li = 0; li < lives.length; li++) {
                City.NOWOVR = EPOCH + lives[li][0]*CYC + Math.round(0.45*CYC);
                City.CLOCK = City.NOWOVR;
                City.setup('neon', { cw:1552, ch:874, woff:0, ww:4656, pxk:3, zoom:1, quality:'balanced', frameMs:200 });
                City.FORCEAGE = 0.85;
                City.draw(g,"bg"); City.draw(g,"live");
                var t = [];
                for (var i = 0; i < 150; i++) {
                    City.NOWOVR = City.CLOCK = City.NOWOVR + 200;
                    var t0 = Date.now(); City.draw(g,"live"); t.push(Date.now()-t0);
                }
                var s = stats(t);
                console.log("HITCH " + lives[li][1] + "  live  mean " + s.mean.toFixed(1)
                            + "  p50 " + s.p50.toFixed(0) + "  p95 " + s.p95.toFixed(0)
                            + "  WORST " + s.max.toFixed(0) + " ms   (worst/mean " + (s.max/s.mean).toFixed(1) + "x)");
            }

            // ---- 2. the life rollover: a whole new world built inside one paint ----
            var roll = [];
            for (var r = 0; r < 8; r++) {
                City.NOWOVR = City.CLOCK = EPOCH + (200+r)*CYC + Math.round(0.45*CYC);
                var r0 = Date.now();
                City.draw(g,"live");                   // draw() sees a new lifeIndex → buildWorld inline
                roll.push(Date.now()-r0);
            }
            var rs = stats(roll);
            console.log("HITCH life rollover (buildWorld inside a paint)  mean " + rs.mean.toFixed(0)
                        + "  WORST " + rs.max.toFixed(0) + " ms");

            // ---- 3. setup(): main.qml re-runs this 6s after login and on every geometry change ----
            var su = [];
            for (var q = 0; q < 8; q++) {
                City.NOWOVR = City.CLOCK = EPOCH + (300+q)*CYC + Math.round(0.45*CYC);
                var s0 = Date.now();
                City.setup('neon', { cw:1552, ch:874, woff:0, ww:4656, pxk:3, zoom:1, quality:'balanced', frameMs:200 });
                su.push(Date.now()-s0);
            }
            var ss = stats(su);
            console.log("HITCH setup()  mean " + ss.mean.toFixed(0) + "  WORST " + ss.max.toFixed(0) + " ms");

            // ---- 4. the first bg paint of a new life: the mountain cache is built here ----
            var bgf = [];
            for (var b = 0; b < 8; b++) {
                City.NOWOVR = City.CLOCK = EPOCH + (400+b)*CYC + Math.round(0.45*CYC);
                City.setup('neon', { cw:1552, ch:874, woff:0, ww:4656, pxk:3, zoom:1, quality:'balanced', frameMs:200 });
                var b0 = Date.now(); City.draw(g,"bg"); bgf.push(Date.now()-b0);
            }
            var bs = stats(bgf);
            console.log("HITCH first bg paint of a life (mtsCache build)  mean " + bs.mean.toFixed(0)
                        + "  WORST " + bs.max.toFixed(0) + " ms");
            Qt.quit();
        }
    }
    Timer { interval: 300; running: true; repeat: true; onTriggered: cv.requestPaint() }
}
