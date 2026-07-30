import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// RAIN ON HOT ROCK — the three states that matter, all at the SAME hour so the daylight cycle cannot be
// mistaken for the effect (the mistake that made the flow-cycle measurement wrong the first time, and the
// sprawl flood wrong four times):
//
//   dry    — clear sky, quench 0            : the land at full temperature
//   storm  — thunder, wetness 1, quench 0.6 : steam up, flows chilling, rain lost in the veil
//   after  — clear sky, quench 1.0          : the storm is OVER and the rock is still cold and steaming.
//            This is the state that proves Nick's chosen answer ("it lasts") rather than the one he
//            rejected ("only while it's raining") — under the rejected model this frame is identical to dry.
//
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-hell-rain.qml
Item {
    id: root
    width: 1552; height: 874
    property var states: ["dry", "storm", "after"]
    property int si: 0
    property int warm: 0
    property double t0: 0
    property string outDir: "/tmp/claude-1000/-home-deluxescout/4918a477-0edb-4bc7-806e-a62894ab0912/scratchpad"

    function arm() {
        var CYC = 604800000, EPOCH = 1783972450746;
        City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null; City.FORCEDIS = null;
        City.FORCEBIOME = "hell"; City.FORCEVARIANT = 0;
        var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
        d.setHours(23, 10, 0, 0);                       // one fixed hour for all three
        root.t0 = d.getTime();
        City.NOWOVR = City.CLOCK = root.t0;
        City.setup('city', { cw:1552, ch:874, woff:776, ww:2269, pxk:2, zoom:2,
                             taskbarWp:28, quality:'balanced', frameMs:125 });
        City.FORCEAGE = 0.80;
        var s = root.states[root.si];
        if (s === "dry")   { City.weather.code = 0;  City.weather.cloud = 15; City.wetness = 0.0; City.ashQuench = 0.0; }
        if (s === "storm") { City.weather.code = 95; City.weather.cloud = 100; City.wetness = 1.0; City.ashQuench = 0.6; }
        if (s === "after") { City.weather.code = 0;  City.weather.cloud = 30; City.wetness = 0.05; City.ashQuench = 1.0; }
        City.weather.wind = 16; City.weather.temp = 66;
        City.mtsCache = null;
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
            if (root.si >= root.states.length) { Qt.quit(); return; }
            if (root.warm === 0) arm();
            bg.requestPaint(); live.requestPaint();
            if (root.warm < 1) { root.warm++; return; }
            // ⚠ READ IT BACK. A harness that sets `City.ashQuench` and then measures the render is
            // asserting two things at once — that the value arrived, and that it had an effect. Print it
            // after the paint so a null result can be attributed to the right one.
            console.log("STATE " + root.states[root.si] + " ashQuench=" + City.ashQuench
                        + " wetness=" + City.wetness.toFixed(3) + " code=" + City.weather.code);
            root.grabToImage(function(res){
                res.saveToFile(root.outDir + "/rain-hell-" + root.states[root.si] + ".png");
                root.warm = 0; root.si++;
            });
        }
    }
}
