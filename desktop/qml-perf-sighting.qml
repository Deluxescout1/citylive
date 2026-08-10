import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// ⏱️🚨 WHAT DOES THE PRE-APOCALYPSE SIGHTING COST A CITY THAT IS NOT ENDING?
// Every other titan measurement compared one apocalypse against another. This one cannot: the whole
// point of `aa9e0a4` is that the wall now draws during ORDINARY LIFE, in a phase that previously had
// zero titan cost at all. Nick has already said the ending feels heavy, so adding work to the *normal*
// phase is the change most likely to be felt — and the one no existing harness would have caught.
//
// 🔑 THE CONTROL IS THE SAME CITY ON A DIFFERENT FATE. `deathOf(lifeI)` decides which ending a life
// gets, and the sighting only draws when that is `thetitans` — so rendering the identical city, hour
// and age with `FORCEDEATH="nuke"` isolates the sighting exactly, with every other cost held equal.
//
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-perf-sighting.qml
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
            function run(age, death) {
                City.FORCEBIOME = "plains"; City.FORCEVARIANT = 0;
                var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
                d.setHours(13, 10, 0, 0);
                City.NOWOVR = City.CLOCK = d.getTime();
                City.setup('city', { cw:1552, ch:874, woff:1629, ww:2269, pxk:2, zoom:2,
                                     taskbarWp:28, quality:'balanced', frameMs:125 });
                City.FORCEAGE = age; City.FORCEDEATH = death; City.FORCEAPOCMS = null;
                City.weather.code = 0; City.weather.wind = 10; City.weather.temp = 70; City.weather.cloud = 20;
                City.mtsCache = null;
                City.draw(g, "bg"); City.draw(g, "live");
                var t0 = Date.now();
                for (var k = 0; k < 20; k++) { City.NOWOVR = City.CLOCK = d.getTime() + k*140; City.draw(g, "live"); }
                return (Date.now() - t0) / 20;
            }
            // 0.70 is BELOW TITAN_SIGHT_G (0.80) and is the zero-check: the two arms must agree there,
            // and if they do not, the harness is measuring noise rather than the sighting.
            var ages = [0.70, 0.84, 0.92, 0.97];
            var out = "SIGHTING COST — an ordinary living city, no apocalypse anywhere\n";
            for (var i = 0; i < ages.length; i++) {
                var t = 0, n = 0;
                for (var r = 0; r < 3; r++) { t += run(ages[i], "thetitans"); n += run(ages[i], "nuke"); }
                t /= 3; n /= 3;
                out += "  age " + ages[i].toFixed(2)
                     + "   titans-fated = " + t.toFixed(2) + "ms"
                     + "   other-fated = " + n.toFixed(2) + "ms"
                     + "   SIGHTING = " + (t-n).toFixed(2) + "ms  (" + (100*(t-n)/n).toFixed(1) + "%)\n";
            }
            console.warn(out);
            Qt.callLater(Qt.quit);
        }
        Component.onCompleted: requestPaint()
    }
}
