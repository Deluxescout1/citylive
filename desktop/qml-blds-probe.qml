import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// DID A BUILDING MOVE? Dumps the generated skyline geometry (x / w / h per building, per depth layer) for a
// named land, as text.
//
// ⚠⚠ THIS EXISTS BECAUSE PNG COMPARISON DOES NOT WORK HERE. Two renders of the same land with the same
// engine produce different bytes — something in the animated layers reads the wall clock — so "the hashes
// differ" proves nothing about whether a change leaked. Verified by running the control: same engine, two
// renders, two different md5s. The building geometry, by contrast, is a pure function of the world seed and
// is exactly what a change to the generator would move.
//
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-blds-probe.qml
Item {
    id: root
    width: 1552; height: 874
    property string land: "sprawl"
    property int variant: 2
    Canvas {
        anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        property bool done: false
        onPaint: {
            if (done) return; done = true;
            var CYC = 604800000, EPOCH = 1783972450746;
            City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null; City.FORCEDIS = null;
            City.FORCEBIOME = root.land; City.FORCEVARIANT = root.variant;
            var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
            d.setHours(13, 10, 0, 0);
            City.NOWOVR = City.CLOCK = d.getTime();
            City.setup('city', { cw:1552, ch:874, woff:0, ww:2269, pxk:2, zoom:2,
                                 taskbarWp:28, quality:'balanced', frameMs:125 });
            City.FORCEAGE = 0.80;
            City.weather.code = 0; City.weather.wind = 10; City.weather.temp = 70; City.weather.cloud = 20;
            City.draw(getContext("2d"), "bg");
            var layers = [City.far, City.mid, City.near];
            var names = ["far", "mid", "near"];
            for (var li = 0; li < layers.length; li++) {
                var Ly = layers[li];
                if (!Ly || !Ly.blds) { console.log("BLDS " + names[li] + " none"); continue; }
                var out = [];
                for (var i = 0; i < Ly.blds.length; i++) {
                    var b = Ly.blds[i];
                    out.push(Math.round(b.x) + ":" + Math.round(b.w) + ":" + Math.round(b.h));
                }
                console.log("BLDS " + root.land + " v" + root.variant + " " + names[li]
                            + " n=" + Ly.blds.length + " " + out.join(" "));
            }
            Qt.callLater(Qt.quit);
        }
        Component.onCompleted: requestPaint()
    }
}
