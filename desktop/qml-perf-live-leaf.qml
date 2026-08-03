import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// THE HIDDEN VILLAGE'S LIVE PASS, against alpine as a control, INTERLEAVED.
// `drawVillageCliffLive` is new per-frame work on the biggest object on the map — water off the rim,
// mist, climbers, hawks, the roost, lit chambers — so it has to be timed at the LIVE rate, not the
// backdrop's ~0.5 fps. Cloned from qml-perf-live-now.qml, which cannot reach an egg land: those live
// in EGG_BIOMES and need FORCEEGG, not FORCEBIOME.
// ⚠⚠ EVERY CASE HAS ITS OWN MATCHED CONTROL. The first run timed leaf-in-rain against
// alpine-in-CLEAR and read +4.25ms, which says nothing at all: rain is expensive on EVERY land
// (curtains, splashes, puddles, reflections) and none of that cost is this renderer's. Comparing a
// wet frame with a dry one measures the weather, not the change. Same land, same hour, same sky —
// only the land differs.
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-perf-live-leaf.qml
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
            City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEDIS = null;
            var cases = ["alpine-13", "alpine-rain-13", "alpine-6", "alpine-21", "leaf-13", "leaf-rain-13", "leaf-6", "leaf-21"];
            var tot = {}, cnt = {};
            for (var i = 0; i < cases.length; i++) { tot[cases[i]] = 0; cnt[cases[i]] = 0; }
            function one(key) {
                var parts = key.split("-");
                var land = parts[0], rain = (key.indexOf("rain") >= 0);
                var hour = parseInt(parts[parts.length - 1], 10);
                if (land === "leaf") { City.FORCEEGG = "leaf"; City.FORCEBIOME = null; }
                else { City.FORCEEGG = null; City.FORCEBIOME = land; }
                City.FORCEVARIANT = 0;
                var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
                d.setHours(hour, 10, 0, 0);
                City.NOWOVR = City.CLOCK = d.getTime();
                City.setup('city', { cw:1552, ch:874, woff:0, ww:2269, pxk:2, zoom:2,
                                     taskbarWp:28, quality:'balanced', frameMs:125 });
                City.FORCEAGE = 0.80;
                // ⚠ FORCEWX, not weather.x = y — the latter is clobbered by the live fetch.
                City.FORCEWX = rain ? { code:63, cloud:100, wind:14, temp:58, precip:6, feels:56, gust:20 }
                                    : { code:0, cloud:20, wind:10, temp:70, precip:0, feels:70, gust:12 };
                City.wetness = rain ? 0.8 : 0;
                City.mtsCache = null;
                City.draw(g, "bg");                       // build caches — not what we are timing
                City.draw(g, "live");
                var t0 = Date.now();
                for (var k = 0; k < 20; k++) { City.NOWOVR = City.CLOCK = d.getTime() + k*140; City.draw(g, "live"); }
                tot[key] += Date.now() - t0; cnt[key] += 20;
            }
            for (var r = 0; r < 3; r++)
                for (var j = 0; j < cases.length; j++) one(cases[j]);
            var base = tot["alpine-13"] / cnt["alpine-13"];
            var out = "LEAFPERF (ms per live frame, alpine control = " + base.toFixed(2) + "ms)";
            for (var m = 0; m < cases.length; m++) {
                var a = tot[cases[m]] / cnt[cases[m]];
                out += "\n  " + cases[m] + ": " + a.toFixed(2) + "ms  (" + (a - base >= 0 ? "+" : "") + (a - base).toFixed(2) + ")";
            }
            console.warn(out);
            Qt.quit();
        }
    }
}
