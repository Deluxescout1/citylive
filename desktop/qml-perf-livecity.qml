import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as New
import "_ctl_city.js" as Ctl

// WHAT DOES A CHANGE COST IN A CITY THAT IS NOT ENDING? Same two-engines-in-one-process shape as
// qml-perf-apoc.qml, with the finale switched OFF.
//
// 🚨🔑 WHY THIS EXISTS. `railSpans()` was added to guard the tramway against the apocalypse, and it
// was timed ONLY during the apocalypse — but it runs on the live frame of EVERY land, every frame, for
// the whole of a normal life. `qml-perf-apoc.qml` forces FORCEAPOCMS and so can never see that: it
// measures the 0.01% of the time the world is ending. An unmeasured change to the frame that actually
// runs is the exact shape of the laptop bug ("it ate a sixth of the whole CPU"), and the rule there was
// BUY THE FRAMES BACK WITH PIXELS, NEVER WITH FRAMES.
//
// ⚠ Same sample-size floor as the apoc bench: 3x16 sits UNDER this harness's own noise. 8 rounds of 24
// frames puts unchanged code inside +/-0.3 ms; treat anything smaller than that as no result.
//
// ⚠ `_ctl_city.js` is gitignored — regenerate from the commit you started from:
//   git show <base>:org.citylive.wallpaper/contents/js/city.js > desktop/_ctl_city.js
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-perf-livecity.qml
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
            // 🔑 AGE MATTERS FOR THIS QUESTION: railFrac() is 0 before the track gang starts, so a young
            // city would exercise none of the new code and report a clean bill. 0.80 has full permanent way.
            var lands = ["plains", "street", "sprawl"];
            var acc = {};
            function key(e, l) { return e + "|" + l; }

            function one(C, eng, land, hour) {
                C.GROW_CYCLE = CYC; C.NOFETCH = true; C.FORCEEGG = null;
                C.FORCEBIOME = land; C.FORCEVARIANT = 0;
                C.FORCEDIS = null; C.FORCEDEATH = null; C.FORCEAPOCMS = null;   // a LIVING city
                var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
                d.setHours(hour, 10, 0, 0);
                C.NOWOVR = C.CLOCK = d.getTime();
                C.setup('city', { cw:1552, ch:874, woff:0, ww:2269, pxk:2, zoom:2,
                                  taskbarWp:28, quality:'balanced', frameMs:125 });
                C.FORCEAGE = 0.80;
                C.weather.code = 0; C.weather.wind = 10; C.weather.temp = 70; C.weather.cloud = 20;
                C.draw(g, "bg"); C.draw(g, "live");        // build caches — not what we are timing
                var tl = Date.now(), NL = 24;
                for (var kl = 0; kl < NL; kl++) {
                    C.NOWOVR = C.CLOCK = d.getTime() + kl*140;
                    C.draw(g, "live");
                }
                var lk = key(eng, land);
                if (!acc[lk]) acc[lk] = { ms:0, n:0 };
                acc[lk].ms += Date.now() - tl; acc[lk].n += NL;
            }

            for (var r = 0; r < 8; r++)
                for (var j = 0; j < lands.length; j++)
                    for (var h = 0; h < 2; h++) {
                        var hour = h ? 23 : 13;
                        one(New, "new", lands[j], hour);   // interleaved, back to back
                        one(Ctl, "ctl", lands[j], hour);
                    }

            var out = "LIVEPERF  ms per LIVE frame in a NORMAL life (no finale, age 0.80, full tramway)";
            for (var m = 0; m < lands.length; m++) {
                var L = lands[m];
                var a = acc[key("new", L)], b = acc[key("ctl", L)];
                var va = a.ms / a.n, vb = b.ms / b.n;
                out += "\n  " + L + "   live " + va.toFixed(2) + " vs " + vb.toFixed(2)
                     + "   delta " + (va - vb >= 0 ? "+" : "") + (va - vb).toFixed(2) + " ms";
            }
            console.log(out);
            Qt.callLater(Qt.quit);
        }
        Component.onCompleted: requestPaint()
    }
}
