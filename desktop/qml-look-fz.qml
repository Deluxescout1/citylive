import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// JUDGE A MAP — any biome, every variant, day and night, at Nick's REAL primary geometry.
//
// ⚠⚠ TWO STACKED CANVASES, NOT ONE. `draw(g,"live")` opens with a clearRect, because each transparent
// layer has to discard its previous frame. Calling draw(g,"bg") then draw(g,"live") on the SAME
// context therefore throws the whole backdrop away and leaves a city floating on white with no sky
// and no landform — which looks exactly like "this map has no mountains" and is not. The shells stack
// two real canvases; so must any harness that wants a composited frame, and grabToImage on the ROOT
// Item flattens them the way the compositor does.
// ⚠ Also paint twice before grabbing: the first bg paint is the one that BUILDS mtsCache.
Item {
    id: root
    width: 1552; height: 874                  // 2327x1309 dpr=2 zoom=2 -> this canvas, woff 0, world 2269 wp
    property string land: "fjord"
    property var variants: [0,1,2]
    property var hours: [13]
    property var woffList: [0]
    property int woi: 0
    property int vi: 0
    property int hi: 0
    property int warm: 0
    property var ages: [0.30]   // FORCEAGE sweep: does the city GROW into what it becomes?
    property int ai: 0
    property double t0: 0
    property string outDir: "/tmp/claude-1000/-home-deluxescout/e4ac60a1-0028-46d1-a1d4-7efe335d018a/scratchpad"

    function arm() {
        var CYC = 604800000, EPOCH = 1783972450746;
        City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null;
        City.FORCEBIOME = root.land; City.FORCEVARIANT = root.variants[root.vi];
        var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
        d.setHours(root.hours[root.hi], 10, 0, 0);
        root.t0 = d.getTime();
        City.NOWOVR = City.CLOCK = root.t0;
        City.setup('city', { cw:1552, ch:874, woff:root.woffList[root.woi], ww:2269, pxk:2, zoom:2,
                             taskbarWp:28, quality:'balanced', frameMs:125 });
        City.FORCEAGE = root.ages[root.ai]; 
        City.weather.code = 0; City.weather.wind = 10; City.weather.temp = 70; City.weather.cloud = 20;
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
        interval: 350; running: true; repeat: true
        onTriggered: {
            if (root.vi >= root.variants.length) { Qt.quit(); return; }
            if (root.warm === 0) root.arm();
            bg.requestPaint(); live.requestPaint();
            if (root.warm < 1) { root.warm++; return; }
            root.grabToImage(function(res){
                res.saveToFile(root.outDir + "/fz-" + root.land + "-v" + root.variants[root.vi]
                               + "-w" + root.woffList[root.woi] + "-h" + root.hours[root.hi] + "-a" + Math.round(root.ages[root.ai]*100) + ".png");
                root.warm = 0;
                root.ai++; if (root.ai >= root.ages.length) { root.ai = 0; root.hi++; }
                if (root.hi >= root.hours.length) { root.hi = 0; root.woi++;
                    if (root.woi >= root.woffList.length) { root.woi = 0; root.vi++; } }
            });
        }
    }
}
