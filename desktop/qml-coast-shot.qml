import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// THE SIX COASTAL LANDS, at Nick's REAL primary geometry (2327x1309 dpr2 zoom2 -> 1552x874 canvas,
// world 2269 wp). The whole point of the recomposition is what the BOTTOM of a real frame looks
// like, so a full-world panorama would answer the wrong question — the sea used to sit at the world
// seams and a panorama is the one view where that looked fine.
//
// ⚠ Two stacked canvases: draw(g,"live") opens with clearRect, so bg+live on one context loses the
// backdrop. ⚠ Paint twice before grabbing — the first bg paint builds mtsCache.
Item {
    id: root
    width: 1552; height: 874

    property var shots: [
        { n:"coast-cliffs",  biome:"cliffs",  variant:0, hour:13 },
        { n:"coast-beach",   biome:"beach",   variant:0, hour:13 },
        { n:"coast-coral",   biome:"beach",   variant:1, hour:13 },
        { n:"coast-swamp",   biome:"swamp",   variant:0, hour:13 },
        { n:"coast-volcano", biome:"volcano", variant:0, hour:13 },
        { n:"coast-arctic",  biome:"arctic",  variant:0, hour:13 },
        { n:"coast-cliffs-dusk", biome:"cliffs", variant:0, hour:19 }
    ]
    property int idx: 0
    property int warm: 0
    property string outDir: "/tmp/claude-1000/-home-deluxescout/2db058e7-bff3-40ca-bb41-421151bb5164/scratchpad/coast"
    property double t0: 0

    function armShot() {
        var CYC = 604800000, EPOCH = 1783972450746;
        var S = root.shots[root.idx];
        City.GROW_CYCLE = CYC;
        City.NOFETCH = true;
        City.FORCEEGG = null;
        City.FORCEBIOME = S.biome;
        City.FORCEVARIANT = S.variant;
        var d = new Date(EPOCH + 44 * CYC + Math.round(0.45 * CYC));
        d.setHours(S.hour, 0, 0, 0);
        root.t0 = d.getTime();
        City.NOWOVR = City.CLOCK = root.t0;
        City.setup('neon', { cw:1552, ch:874, woff:0, ww:2269, pxk:3, zoom:2,
                             taskbarWp:0, quality:'balanced', frameMs:125 });
        City.FORCEAGE = 0.85;
        City.weather.code = 0; City.weather.wind = 9; City.weather.temp = 62;
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
