import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// THE OLD KINGDOM, BOTH PASSES, against a matched control — INTERLEAVED.
// Nick: "the background is jittery again". Per citylive-smoothness, "jittery" is the FRAME RATE, not
// the look — so this times what a frame costs, and it times the BG pass as well as the live one
// because everything added to this land recently (the field, the road, the ranch, the hill, the
// mountain) is backdrop work, and the backdrop is the pass he named.
// ⚠ Matched control: same hour, same sky, same age — only the land differs. Comparing a land against
// a different land's weather measures the weather (that mistake cost a false +4.25ms on the village).
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-perf-hyrule.qml
Item {
    width: 1708; height: 960
    Canvas {
        id: cv; anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        property bool done: false
        onPaint: {
            if (done) return; done = true;
            var g = getContext("2d");
            var CYC = 604800000, EPOCH = 1783972450746;
            City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEDIS = null;
            var cases = ["alpine-bg", "alpine-live", "plateau-bg", "plateau-live"];
            var tot = {}, cnt = {};
            for (var i = 0; i < cases.length; i++) { tot[cases[i]] = 0; cnt[cases[i]] = 0; }
            function one(key) {
                var land = key.split("-")[0], pass = key.split("-")[1];
                if (land === "plateau") { City.FORCEEGG = "plateau"; City.FORCEBIOME = null; }
                else { City.FORCEEGG = null; City.FORCEBIOME = land; }
                City.FORCEVARIANT = 0;
                var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
                d.setHours(13, 10, 0, 0);
                City.NOWOVR = City.CLOCK = d.getTime();
                City.setup('city', { cw:1708, ch:960, woff:776, ww:2269, pxk:2, zoom:2,
                                     taskbarWp:28, quality:'balanced', frameMs:125 });
                City.FORCEAGE = 0.85;
                City.FORCEWX = { code:0, cloud:20, wind:10, temp:70, precip:0, feels:70, gust:12 };
                City.mtsCache = null;
                City.draw(g, "bg"); City.draw(g, "live");          // warm, not timed
                var t0 = Date.now();
                for (var k = 0; k < 12; k++) { City.NOWOVR = City.CLOCK = d.getTime() + k*140; City.draw(g, pass); }
                tot[key] += Date.now() - t0; cnt[key] += 12;
            }
            for (var r = 0; r < 3; r++)
                for (var j = 0; j < cases.length; j++) one(cases[j]);
            var out = "HYRULEPERF (ms per pass)";
            for (var m = 0; m < cases.length; m++)
                out += "\n  " + cases[m] + ": " + (tot[cases[m]] / cnt[cases[m]]).toFixed(2) + "ms";
            var bgd = tot["plateau-bg"]/cnt["plateau-bg"] - tot["alpine-bg"]/cnt["alpine-bg"];
            var lvd = tot["plateau-live"]/cnt["plateau-live"] - tot["alpine-live"]/cnt["alpine-live"];
            out += "\n  DELTA bg " + (bgd>=0?"+":"") + bgd.toFixed(2) + "ms   live " + (lvd>=0?"+":"") + lvd.toFixed(2) + "ms";
            console.warn(out);
            Qt.quit();
        }
    }
}
