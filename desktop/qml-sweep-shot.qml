import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// THE MIDDLE MONITOR, which is where Nick sees the blue boxes and the stray lines.
//
// ⚠ Every render harness in this repo so far has drawn the PRIMARY screen. The middle monitor is a
// different slice of the world with different numbers, straight out of plasmashell's own log:
//     virtualX=2328  2560x1440  dpr=1 zoom=1 -> woff=776wp  854x480  panelBottom=82px (28wp)
// So: canvas 854x480, ZOOM 1 (not 2), world offset 776, and a TALLER panel (28 wp vs 17). SH is
// 480 world px here against 437 on the primary, so HORIZON and GROUND both land somewhere the
// primary never exercises. A defect that only shows on this screen would have been invisible to
// every shot taken this session.
Item {
    id: root
    width: 1552; height: 874

    property var shots: [
        { n:"sweep-alpine", land:"alpine", egg:null },
        { n:"sweep-forest", land:"forest", egg:null },
        { n:"sweep-mesa", land:"mesa", egg:null },
        { n:"sweep-cliffs", land:"cliffs", egg:null },
        { n:"sweep-plains", land:"plains", egg:null },
        { n:"sweep-beach", land:"beach", egg:null },
        { n:"sweep-swamp", land:"swamp", egg:null },
        { n:"sweep-volcano", land:"volcano", egg:null },
        { n:"sweep-arctic", land:"arctic", egg:null },
        { n:"sweep-sprawl", land:"sprawl", egg:null },
        { n:"sweep-hell", land:"hell", egg:null },
        { n:"sweep-heaven", land:"heaven", egg:null },
        { n:"sweep-egg-leaf", land:null, egg:"leaf" },
        { n:"sweep-egg-core", land:null, egg:"core" },
        { n:"sweep-egg-fire", land:null, egg:"fire" },
        { n:"sweep-egg-air", land:null, egg:"air" },
        { n:"sweep-egg-falls", land:null, egg:"falls" }
    ]
    property int idx: 0
    property int warm: 0
    property string outDir: "/tmp/claude-1000/-home-deluxescout/2db058e7-bff3-40ca-bb41-421151bb5164/scratchpad/sweep"
    property double t0: 0

    function armShot() {
        var CYC = 604800000, EPOCH = 1783972450746;
        var S = root.shots[root.idx];
        City.GROW_CYCLE = CYC;
        City.NOFETCH = true;
        City.FORCEEGG = S.egg; City.FORCEBIOME = S.land; City.FORCEVARIANT = S.land ? 0 : null;
        var d = new Date(EPOCH + 44 * CYC + Math.round(0.45 * CYC));
        d.setHours(13, 0, 0, 0);
        root.t0 = d.getTime();
        City.NOWOVR = City.CLOCK = root.t0;
        City.setup('neon', { cw:1552, ch:874, woff:0, ww:2269, pxk:3, zoom:2,
                             taskbarWp:17, quality:'balanced', frameMs:125 });
        City.FORCEAGE = 0.72;
        City.weather.code = 0; City.weather.wind = 8; City.weather.temp = 64;
    }

    Canvas {
        id: bg
        anchors.fill: parent
        renderTarget: Canvas.Image
        renderStrategy: Canvas.Immediate
        antialiasing: false
        onPaint: { City.NOWOVR = City.CLOCK = root.t0; City.draw(getContext("2d"), "bg"); }
    }
    Canvas {
        id: live
        anchors.fill: parent
        renderTarget: Canvas.Image
        renderStrategy: Canvas.Immediate
        antialiasing: false
        onPaint: { City.NOWOVR = City.CLOCK = root.t0; City.draw(getContext("2d"), "live"); }
    }

    Timer {
        interval: 350; running: true; repeat: true
        onTriggered: {
            if (root.idx >= root.shots.length) { Qt.quit(); return; }
            if (root.warm === 0) root.armShot();
            bg.requestPaint(); live.requestPaint();
            if (root.warm < 1) { root.warm++; return; }
            root.grabToImage(function(res){
                res.saveToFile(root.outDir + "/" + root.shots[root.idx].n + ".png");
                root.idx++; root.warm = 0;
            });
        }
    }
}
