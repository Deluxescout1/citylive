import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// WATCH THE ERUPTION — step a volcano disaster through its arc on the volcano land itself.
//
// ⚠⚠ TWO STACKED CANVASES, NOT ONE. `draw(g,"live")` opens with a clearRect, so bg-then-live on the
// SAME context throws the backdrop away and leaves the city floating on white. Grab the ROOT Item.
// ⚠ Paint twice before grabbing: the first bg paint is the one that BUILDS mtsCache.
// ⚠ mtsCache is keyed on the ERUPTION state, so it rebuilds mid-arc by design — that is the feature
//   under test (the summit tearing away while you watch), not a leak.
Item {
    id: root
    width: 1552; height: 874                  // 2327x1309 dpr=2 zoom=2 -> this canvas, woff 0, world 2269 wp
    property string land: "sprawl"
    property int variant: 0                   // 1 = THE GREEN ISLAND (the one Nick screenshotted)
    property int hour: 23
    property var woffList: [0]
    property int woi: 0
    property var fs: [0.05, 0.16, 0.30, 0.50, 0.58]
    property int fi: 0
    property int warm: 0
    property double t0: 0
    property string outDir: "/tmp/claude-1000/-home-deluxescout/4918a477-0edb-4bc7-806e-a62894ab0912/scratchpad"

    function arm() {
        var CYC = 604800000, EPOCH = 1783972450746;
        City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null;
        City.FORCEBIOME = root.land; City.FORCEVARIANT = root.variant;
        var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
        d.setHours(root.hour, 10, 0, 0);
        root.t0 = d.getTime();
        City.NOWOVR = City.CLOCK = root.t0;
        City.setup('city', { cw:1552, ch:874, woff:root.woffList[root.woi], ww:2269, pxk:2, zoom:2,
                             taskbarWp:28, quality:'balanced', frameMs:125 });
        City.FORCEAGE = 0.80;
        City.weather.code = 0; City.weather.wind = 12; City.weather.temp = 70; City.weather.cloud = 20;
        City.FORCEDIS = { type:"blackout", intensity:4, xf:0.16, w:58, seed:451, f:root.fs[root.fi] };
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
            if (root.fi >= root.fs.length) { Qt.quit(); return; }
            if (root.warm === 0) root.arm();
            bg.requestPaint(); live.requestPaint();
            if (root.warm < 1) { root.warm++; return; }
            root.grabToImage(function(res){
                var tag = "blk-v" + root.variant + "-h" + root.hour + "-w" + root.woffList[root.woi]
                          + "-f" + Math.round(root.fs[root.fi]*100);
                res.saveToFile(root.outDir + "/" + tag + ".png");
                root.warm = 0; root.woi++;
                if (root.woi >= root.woffList.length) { root.woi = 0; root.fi++; }
            });
        }
    }
}
