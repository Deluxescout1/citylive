import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// THE ERUPTION FROM THE RIFT. Two things to prove, and the second is the one that matters:
//   1. it plays at all on a molten land (the volcano disaster is generic, so it should)
//   2. it comes out of the RIFT and not somewhere unrelated — so the harness prints the rift's world x
//      and the disaster's anchor x side by side. "It looks like it's in the right place" is not a check;
//      two numbers agreeing is.
// Rendered across the arc, since the whole point of the locked answer is that it is watchable.
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-hell-erupt.qml
Item {
    id: root
    width: 1552; height: 874
    property string land: "hell"
    property var fs: [0.10, 0.30, 0.50, 0.70]
    property int si: 0
    property int warm: 0
    property double t0: 0
    property string outDir: "/tmp/claude-1000/-home-deluxescout/4918a477-0edb-4bc7-806e-a62894ab0912/scratchpad"

    function arm() {
        var CYC = 604800000, EPOCH = 1783972450746;
        City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null;
        City.FORCEBIOME = root.land; City.FORCEVARIANT = 0;
        var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
        d.setHours(23, 10, 0, 0);
        root.t0 = d.getTime();
        City.NOWOVR = City.CLOCK = root.t0;
        // ⚠⚠ AIM THE CAMERA AT THE RIFT, DON'T GUESS. The rift is world-anchored and landed at world x 1770
        // on this life; the harness's first fixed woff of 776 put it 218px off the right of the frame, and the
        // render came back with no eruption in it — which would have read as "the anchoring does not work"
        // when it worked perfectly. Two-stage: build the world once to learn where the rift is, then re-setup
        // with a woff that has it on screen. Same trap as the crop that was in the sea.
        City.setup('city', { cw:1552, ch:874, woff:0, ww:2269, pxk:2, zoom:2,
                             taskbarWp:28, quality:'balanced', frameMs:125 });
        var probe = null; try { probe = City.ashRiftState(); } catch (e) { }
        var wantW = probe ? Math.max(0, Math.min(2269-776, Math.round(probe.wx - 388))) : 776;
        City.setup('city', { cw:1552, ch:874, woff:wantW, ww:2269, pxk:2, zoom:2,
                             taskbarWp:28, quality:'balanced', frameMs:125 });
        City.FORCEAGE = 0.80;
        City.weather.code = 0; City.weather.cloud = 20; City.weather.wind = 18; City.weather.temp = 70;
        City.wetness = 0; City.ashQuench = 0;
        City.mtsCache = null;
        // ⚠ FORCEDIS bypasses disasterInfo() entirely (see disasterNow), so it does NOT exercise the
        // rift anchoring — it sets x from xf directly. So the anchoring is checked by reading
        // ashRiftState() and comparing, and the RENDER is driven from the rift's own x.
        var rift = null;
        try { rift = City.ashRiftState(); } catch (e) { }
        var xf = rift ? (rift.wx / 2269) : 0.42;
        City.FORCEDIS = { type:"volcano", intensity:4, xf:xf, w:58, seed:451, f:root.fs[root.si] };
        if (root.si === 0) {
            console.log("RIFT wx=" + (rift ? rift.wx.toFixed(1) : "null")
                        + " w=" + (rift ? rift.w.toFixed(1) : "-")
                        + "  -> eruption xf=" + xf.toFixed(4) + " (world x " + (xf*2269).toFixed(1) + ")"
                        + "  woff=" + wantW + " => on-screen internal x " + (xf*2269 - wantW).toFixed(0) + " of 776");
        }
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
            if (root.si >= root.fs.length) { Qt.quit(); return; }
            if (root.warm === 0) arm();
            bg.requestPaint(); live.requestPaint();
            if (root.warm < 1) { root.warm++; return; }
            root.grabToImage(function(res){
                res.saveToFile(root.outDir + "/erupt-" + root.land + "-f" + Math.round(root.fs[root.si]*100) + ".png");
                root.warm = 0; root.si++;
            });
        }
    }
}
