import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// DID THE DISASTER STREAM MOVE? `disasterInfo` draws every field — type, intensity, width, seed, win, ruin —
// off ONE seeded rng in order, and the function's own comment warns in caps that consuming a single extra
// roll would silently re-roll twenty maps' disaster history. Anchoring the Ashlands' eruption to the rift
// added a branch inside that function.
//
// ⚠ REASONING IS NOT A GATE. `ashRiftState()` demonstrably calls no `r()`, and I shipped on that argument
// while every other risky edit in this pass got a before/after fingerprint. This is that fingerprint: run it
// with the change stashed and unstashed and diff. `grep -c disaster` in the test output is not coverage of a
// seed stream.
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-dis-fingerprint.qml
Item {
    id: root
    width: 1552; height: 874
    property var lands: ["alpine", "volcano", "hell", "sprawl", "arctic"]
    property int li: 0
    Canvas {
        anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        property bool done: false
        onPaint: {
            if (done) return; done = true;
            var CYC = 604800000, EPOCH = 1783972450746;
            City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null; City.FORCEDIS = null;
            for (var li = 0; li < root.lands.length; li++) {
                City.FORCEBIOME = root.lands[li]; City.FORCEVARIANT = 0;
                var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
                d.setHours(13, 10, 0, 0);
                City.NOWOVR = City.CLOCK = d.getTime();
                City.setup('city', { cw:1552, ch:874, woff:0, ww:2269, pxk:2, zoom:2,
                                     taskbarWp:28, quality:'balanced', frameMs:125 });
                City.FORCEAGE = 0.80;
                City.draw(getContext("2d"), "bg");     // build the world so curBiome/mts exist
                // ⚠⚠ 24 SLOTS WAS A VACUOUS GATE. The first run of this harness sampled 24 consecutive slots
                // and reported the streams byte-identical — which was true and proved nothing, because NOT ONE
                // of those slots rolled a `volcano` on any land, so the branch under test was never entered.
                // "The fingerprint matched" is only evidence if the fingerprint covers the thing you changed.
                // 400 slots, and the volcano rolls are reported separately so their x can be checked.
                var out = [], volc = [];
                var base = Math.floor(City.NOWOVR / City.DIS_SLOT) - 10;
                for (var k = 0; k < 400; k++) {
                    var di = City.disasterInfo(base + k);
                    var enc = di ? (di.type + ":" + di.intensity + ":" + Math.round(di.x) + ":"
                                   + Math.round(di.w) + ":" + di.seed + ":" + (di.win ? 1 : 0)
                                   + ":" + (di.ruin ? 1 : 0)) : "-";
                    out.push(enc);
                    if (di && di.type === "volcano") volc.push("slot" + (base+k) + "=" + enc);
                }
                console.log("DIS " + root.lands[li] + " " + out.join(" "));
                console.log("DISVOLC " + root.lands[li] + " n=" + volc.length + " " + volc.slice(0,6).join(" "));
            }
            Qt.callLater(Qt.quit);
        }
        Component.onCompleted: requestPaint()
    }
}
