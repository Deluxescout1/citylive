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
    width: 854; height: 480

    property var shots: [
        { n:"mid-forest", hour:13, age:0.85, land:"forest" },
        { n:"mid-plains", hour:13, age:0.85, land:"plains" },
        { n:"mid-swamp",  hour:13, age:0.85, land:"swamp" }
    ]
    property int idx: 0
    property int warm: 0
    property string outDir: "/tmp/claude-1000/-home-deluxescout/2db058e7-bff3-40ca-bb41-421151bb5164/scratchpad/mid"
    property double t0: 0

    function armShot() {
        var CYC = 604800000, EPOCH = 1783972450746;
        var S = root.shots[root.idx];
        City.GROW_CYCLE = CYC;
        City.NOFETCH = true;
        City.FORCEEGG = null; City.FORCEBIOME = S.land; City.FORCEVARIANT = 0;
        var d = new Date(EPOCH + 44 * CYC + Math.round(0.45 * CYC));
        d.setHours(S.hour, 0, 0, 0);
        root.t0 = d.getTime();
        City.NOWOVR = City.CLOCK = root.t0;
        City.setup('neon', { cw:854, ch:480, woff:776, ww:2269, pxk:3, zoom:1,
                             taskbarWp:28, quality:'balanced', frameMs:125 });
        City.FORCEAGE = S.age;
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
