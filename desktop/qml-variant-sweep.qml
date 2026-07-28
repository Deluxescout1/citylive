import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// THE 36 NAMED LOOKS, LOOKED AT.
//
// Phase 4's detail contract was judged on VARIANT 0 of every land. Each land also carries two named
// variants (THE DOLOMITES, THE BLACK PINES, THE WHITE BADLANDS, THE CHALK COAST, THE MANGROVE, THE
// GLACIER, THE OBSIDIAN, …) with their own palette, fauna, flora and sky — 24 looks that have data
// somebody wrote and that nobody has ever rendered. That is exactly the condition that hid the
// original thin-band diagnosis: it was invisible until all 17 lands were put side by side.
//
// ⚠ VERIFIED BEFORE BUILDING THIS: `FORCEBIOME`+`FORCEVARIANT` (city.js ~3338) hand-merges the
// variant, which is a DIFFERENT code path from the organic `variantOf(li, biomeOf(li))` at 3234. If
// they diverged, every frame here would show a land Nick will never see. All 36 forced biome objects
// are byte-identical to the organically-rolled ones, so this harness is judging the real thing.
//
// Real PRIMARY geometry (1552x874 canvas, zoom 2, 17wp panel, full 2269wp world), 1PM, one frame per
// look. Deliberately no night pass: variants differ by palette/flora/fauna, not by lighting, and 72
// frames is a contact sheet nobody reads.
Item {
    id: root
    width: 1552; height: 874

    property var lands: ["alpine","forest","mesa","cliffs","plains","beach","swamp","volcano","arctic","sprawl","hell","heaven"]
    property var shots: []
    property int idx: 0
    property int warm: 0
    property string outDir: "/tmp/claude-1000/-home-deluxescout/2db058e7-bff3-40ca-bb41-421151bb5164/scratchpad/variants"
    property double t0: 0

    Component.onCompleted: {
        var out = [];
        for (var i = 0; i < root.lands.length; i++)
            for (var v = 0; v < 3; v++)
                out.push({ land: root.lands[i], v: v });
        root.shots = out;
    }

    function armShot() {
        var CYC = 604800000, EPOCH = 1783972450746;
        var S = root.shots[root.idx];
        City.GROW_CYCLE = CYC;
        City.NOFETCH = true;
        City.FORCEEGG = null; City.FORCEBIOME = S.land; City.FORCEVARIANT = S.v;
        var d = new Date(EPOCH + 44 * CYC + Math.round(0.45 * CYC));
        d.setHours(13, 0, 0, 0);
        root.t0 = d.getTime();
        City.NOWOVR = City.CLOCK = root.t0;
        City.applyConfig({ lat: 41.5243, lon: -72.0759 });
        City.setup('neon', { cw:1552, ch:874, woff:0, ww:2269, pxk:3, zoom:2,
                             taskbarWp:17, quality:'balanced', frameMs:125 });
        City.FORCEAGE = 0.72;
        City.weather.code = 0; City.weather.wind = 8; City.weather.temp = 64;
    }

    Canvas {
        id: bg; anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        onPaint: { City.NOWOVR = City.CLOCK = root.t0; City.draw(getContext("2d"), "bg"); }
    }
    Canvas {
        id: live; anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        onPaint: { City.NOWOVR = City.CLOCK = root.t0; City.draw(getContext("2d"), "live"); }
    }

    Timer {
        interval: 320; running: true; repeat: true
        onTriggered: {
            if (root.shots.length === 0) return;
            if (root.idx >= root.shots.length) { Qt.quit(); return; }
            if (root.warm === 0) root.armShot();
            bg.requestPaint(); live.requestPaint();
            if (root.warm < 1) { root.warm++; return; }
            var S = root.shots[root.idx];
            // name carries the LAND NAME AS RENDERED, so a mislabeled sheet is impossible
            var nm = S.land + "-" + S.v + "-" + String(City.curBiome && City.curBiome.name || "?").replace(/[^A-Za-z0-9]+/g, "_");
            root.grabToImage(function(res){
                res.saveToFile(root.outDir + "/" + nm + ".png");
                root.idx++; root.warm = 0;
            });
        }
    }
}
