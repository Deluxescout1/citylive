import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// WHY IS IT SLOW? Nick reports the wallpaper is slow again. Every perf harness I have used across this
// map-by-map pass has timed the `bg` pass, because that is where the landform work went — and the
// Ashlands already recorded the exact inverse of this trap: "The LIVE-pass perf harness would have given
// this a clean bill: everything new here is in `bg`." The lands I have just finished put NEW work in the
// LIVE pass instead (the water and its reflections, the boats, the life layers), and `bg` repaints at
// ~0.5fps while `live` repaints every frame. So this times LIVE, interleaved, against alpine.
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-perf-live-now.qml
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
            City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null; City.FORCEDIS = null;
            var lands = ["alpine","fjord","karst","dunes","heaven","hell"];
            var tot = {}, cnt = {};
            for (var i = 0; i < lands.length; i++) { tot[lands[i]] = 0; cnt[lands[i]] = 0; }
            function one(land, hour) {
                City.FORCEBIOME = land; City.FORCEVARIANT = 0;
                var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
                d.setHours(hour, 10, 0, 0);
                City.NOWOVR = City.CLOCK = d.getTime();
                City.setup('city', { cw:1552, ch:874, woff:0, ww:2269, pxk:2, zoom:2,
                                     taskbarWp:28, quality:'balanced', frameMs:125 });
                City.FORCEAGE = 0.80;
                City.weather.code = 0; City.weather.wind = 10; City.weather.temp = 70; City.weather.cloud = 20;
                City.mtsCache = null; City.duneCache = null; City.karstCache = null;
                City.draw(g, "bg");                       // build caches — not what we are timing
                City.draw(g, "live");
                var t0 = Date.now();
                for (var k = 0; k < 20; k++) { City.NOWOVR = City.CLOCK = d.getTime() + k*140; City.draw(g, "live"); }
                tot[land] += Date.now() - t0; cnt[land] += 20;
            }
            for (var r = 0; r < 3; r++)
                for (var j = 0; j < lands.length; j++) { one(lands[j], 13); one(lands[j], 23); }
            var base = tot["alpine"] / cnt["alpine"];
            var out = "LIVEPERF (ms per live frame, alpine = " + base.toFixed(2) + "ms)";
            for (var m = 0; m < lands.length; m++) {
                var v = tot[lands[m]] / cnt[lands[m]];
                out += "\n  " + lands[m] + " = " + v.toFixed(2) + "ms   x" + (v/base).toFixed(2);
            }
            console.log(out);
            Qt.callLater(Qt.quit);
        }
        Component.onCompleted: requestPaint()
    }
}
