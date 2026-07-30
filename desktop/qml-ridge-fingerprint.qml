import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// DID ANY OTHER LAND'S RIDGE MOVE? The Ashlands' crag term was REPLACED rather than scaled, and the rib
// field gained a branch — both inside `B.molten` gates, both in code every height-field land runs. "It is
// gated" is a claim about the source; this is the measurement.
//
// Dumps a checksum of mtsCache.h[0..2] per land. Run it on the committed engine, then on the edited one:
// every land except `hell` must print the identical number.
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-ridge-fingerprint.qml
Item {
    id: root
    width: 1552; height: 874
    property var lands: ["alpine","mesa","cliffs","plains","beach","arctic","heaven","fjord","salt","karst","dunes","savanna","hell"]
    property int li: 0
    property bool armed: false
    Canvas {
        id: bg; anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        onPaint: { City.draw(getContext("2d"), "bg"); }
    }
    function arm() {
        var CYC = 604800000, EPOCH = 1783972450746;
        City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null; City.FORCEDIS = null;
        City.FORCEBIOME = root.lands[root.li]; City.FORCEVARIANT = 1;
        var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
        d.setHours(13, 10, 0, 0);
        City.NOWOVR = City.CLOCK = d.getTime();
        City.setup('city', { cw:1552, ch:874, woff:0, ww:2269, pxk:2, zoom:2,
                             taskbarWp:28, quality:'balanced', frameMs:125 });
        City.FORCEAGE = 0.80;
        City.weather.code = 0; City.weather.wind = 10; City.weather.temp = 70; City.weather.cloud = 20;
        City.mtsCache = null;
        bg.requestPaint();
    }
    function measure() {
        var C = City.mtsCache;
        if (!C) { console.log("RIDGE " + root.lands[root.li] + " none"); return; }
        var acc = 0, n = 0;
        for (var b = 0; b < 3; b++) {
            var h = C.h[b]; if (!h) continue;
            for (var x = 0; x < h.length; x++) { acc = (acc * 31 + Math.round(h[x] * 8)) % 1000000007; n++; }
        }
        // the rib field too — it gained a molten branch in the same edit
        var racc = 0;
        for (var b2 = 0; b2 < 3; b2++) {
            var r = C.rib[b2]; if (!r) continue;
            for (var x2 = 0; x2 < r.length; x2++) racc = (racc * 31 + Math.round(r[x2] * 4096)) % 1000000007;
        }
        console.log("RIDGE " + root.lands[root.li] + " n=" + n + " h=" + acc + " rib=" + racc);
    }
    Timer {
        interval: 260; running: true; repeat: true
        onTriggered: {
            if (root.li >= root.lands.length) { Qt.quit(); return; }
            if (root.armed) { measure(); root.armed = false; root.li++; }
            else { arm(); root.armed = true; }
        }
    }
}
