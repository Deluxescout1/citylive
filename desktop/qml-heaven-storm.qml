import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// DOES THE STORM EVER ACTUALLY HAPPEN, AND WHEN? Scanning the curve BEFORE rendering anything, because a
// render at an arbitrary moment would "prove" the feature absent — the exact trap `qml-hell-ash` was
// written for after the ashfall pass. Two things to establish:
//   1. the deck's OWN storm cycle (Norwich clear): what share of hours does it exceed 0.3, and is any
//      hour above 0.6? A signature that never fires is not a signature.
//   2. the FLASH slots: with the storm at a given level, how many of ~2.6s slots actually light up, and
//      at what peak alpha? If the answer is "none in a minute", nobody will ever see one.
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-heaven-storm.qml
Item {
    id: root
    width: 1552; height: 874
    Canvas {
        id: bg; anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        property bool done: false
        onPaint: {
            if (done) return; done = true;
            var CYC = 604800000, EPOCH = 1783972450746;
            City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null; City.FORCEDIS = null;
            City.FORCEBIOME = "heaven"; City.FORCEVARIANT = 0;
            var base = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
            base.setHours(13, 10, 0, 0);
            City.NOWOVR = City.CLOCK = base.getTime();
            City.setup('city', { cw:1552, ch:874, woff:0, ww:2269, pxk:2, zoom:2,
                                 taskbarWp:28, quality:'balanced', frameMs:125 });
            City.FORCEAGE = 0.80;
            City.weather.code = 0; City.weather.wind = 10; City.weather.temp = 70; City.weather.cloud = 20;
            City.draw(bg.getContext("2d"), "bg");          // build mtsCache — cloudSeaState needs it

            // ---- 1. the deck's own cycle over a fortnight of real hours, Norwich CLEAR ----
            var H = 3600000, n = 0, over30 = 0, over60 = 0, peak = 0, peakH = -1, best = 0;
            for (var h = 0; h < 24*14; h++) {
                var t = base.getTime() + h*H;
                City.NOWOVR = City.CLOCK = t;
                var st = City.cloudSeaState(t);
                if (!st) continue;
                n++;
                if (st.storm > 0.30) over30++;
                if (st.storm > 0.60) over60++;
                if (st.storm > peak) { peak = st.storm; peakH = h; best = t; }
            }
            console.log("OWN CYCLE (Norwich clear): " + n + " hours sampled"
                        + "  >0.30 " + (100*over30/n).toFixed(1) + "%"
                        + "  >0.60 " + (100*over60/n).toFixed(1) + "%"
                        + "  peak=" + peak.toFixed(3) + " at hour " + peakH);

            // ---- 2. with real rain, what does the storm term read? ----
            City.weather.code = 61;                          // rain
            City.NOWOVR = City.CLOCK = base.getTime();
            var wet = City.cloudSeaState(base.getTime());
            console.log("REAL RAIN: storm=" + (wet ? wet.storm.toFixed(3) : "n/a")
                        + "  churn=" + (wet ? wet.churn.toFixed(3) : "n/a"));
            City.weather.code = 0;

            // ---- 3. flash slots: how often does one actually fire, at the peak own-storm moment? ----
            for (var lvl = 0; lvl < 3; lvl++) {
                var S = [0.30, 0.60, 1.00][lvl];
                var SLOT = 2600, fired = 0, tot = 0, maxA = 0, bestMs = -1, bestA = 0;
                for (var ms = 0; ms < 60000; ms += 40) {     // one minute of world time, 25 fps
                    var t2 = best + ms;
                    tot++;
                    var litN = 0;
                    for (var s = -1; s <= 0; s++) {
                        var slot = Math.floor(t2/SLOT) + s;
                        var hh = City.mixLi(slot >>> 0, 26417) >>> 0;
                        if (((hh>>>3)%1000)/1000 > (0.10 + 0.55*S)) continue;
                        var t0 = slot*SLOT + ((hh>>>13)%1400);
                        var age = t2 - t0; if (age < 0 || age > 460) continue;
                        var a = Math.exp(-age/95);
                        if (age > 90) a = Math.max(a, Math.exp(-(age-90)/70)*0.72);
                        if (age > 230 && ((hh>>>21)&1)) a = Math.max(a, Math.exp(-(age-230)/60)*0.5);
                        if (a > 0.02) { litN++; if (a > maxA) maxA = a; if (a > bestA) { bestA = a; bestMs = ms; } }
                    }
                    if (litN > 0) fired++;
                }
                if (lvl === 2) console.log("BEST FLASH OFFSET ms=" + bestMs + " alpha=" + bestA.toFixed(3));
                console.log("FLASH at storm=" + S.toFixed(2) + ": lit on "
                            + (100*fired/tot).toFixed(1) + "% of frames in a minute, peak alpha "
                            + maxA.toFixed(3));
            }
            Qt.callLater(Qt.quit);
        }
        Component.onCompleted: requestPaint()
    }
}
