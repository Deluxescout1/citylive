import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// ANY LAND, one composited frame at Nick's REAL primary geometry.
// Generalised out of the savanna harness so the canyon review does not start by rebuilding one.
// `land=` takes any biome key; `variant=` its landVariant. Age matters: render BOTH a young and a
// grown city, because occlusion by the skyline is invisible at one age and total at the other.
//
// ⚠ HALVED GEOMETRY ON PURPOSE. His real primary logs cw:4656 ch:2622 zoom:6, but grabToImage clips at
// 2560 px on this box and returns the top-left CROPPED, not scaled — bare sky and no error. Halving the
// canvas AND the zoom together keeps world geometry identical (it is cw/zoom), so SW/SH/K are unchanged
// and this is his real frame, just captured at half size.
//
// `qml6 qml-land-frame.qml -- land=canyon woff=0 age=0.85 hour=13 variant=0 zoom=2 out=/some/dir`
// ⚠⚠ AND THE WINDOW IS CLAMPED TO THE SCREEN IT OPENS ON. A 2328x1311 root came back as 1920x1002 —
// CLIPPED, not scaled, because qml6 put the window on the 1080p monitor. That is the grabToImage trap
// wearing a different hat: the frame looks fine and is silently a different frame. Keep cw at or below
// 1900 and derive zoom from it, so world geometry (cw/zoom) stays exactly his.
Item {
    id: root
    width: cw; height: ch

    function arg(k, d) {
        var a = Qt.application.arguments;
        for (var i = 0; i < a.length; i++) if (a[i].indexOf(k + "=") === 0) return a[i].substring(k.length + 1);
        return d;
    }
    property int zoom: parseInt(arg("zoom", "2"), 10)
    property int cw: 776 * zoom
    property int ch: 437 * zoom
    property int woff: parseInt(arg("woff", "0"), 10)
    property double age: parseFloat(arg("age", "0.85"))
    property int hour: parseInt(arg("hour", "13"), 10)
    property int variant: parseInt(arg("variant", "0"), 10)
    property string land: arg("land", "canyon")
    property string tag: arg("tag", "frame")
    property string wx: arg("wx", "clear")
    property string egg: arg("egg", "")
    property string dis: arg("dis", "")          // e.g. dis=kaiju
    property double disF: parseFloat(arg("disf", "0.55"))
    property int disI: parseInt(arg("disi", "5"), 10)
    property int disSeed: parseInt(arg("disseed", "4242"), 10)
    property string clockAt: arg("clock", "")   // absolute ms — renders a specific moment in history
    property string disWin: arg("diswin", "")    // "0" forces the city to LOSE
    property string outDir: arg("out", "/tmp/claude-1000/-home-deluxescout/bb7d3665-023a-4a7c-beb2-9139002a7460/scratchpad/land")
    property double t0: 0
    property int warm: 0

    function arm() {
        var CYC = 604800000, EPOCH = 1783972450746;
        City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null;
        // egg lands are not reachable via FORCEBIOME — they live in EGG_BIOMES and need FORCEEGG
        if (root.egg !== "") { City.FORCEEGG = root.egg; City.FORCEBIOME = null; }
        else { City.FORCEBIOME = root.land; }
        City.FORCEVARIANT = root.variant;
        var d = new Date(EPOCH + 44 * CYC + Math.round(0.45 * CYC));
        d.setHours(root.hour, 0, 0, 0);
        var base = d.getTime();
        root.t0 = base - (base % 900000) + 450000;
        // an absolute clock overrides the derived one: some states (the emergency succession) exist
        // only at a particular moment in the real timeline and cannot be forced into being.
        if (root.clockAt !== "") root.t0 = parseFloat(root.clockAt);
        City.NOWOVR = City.CLOCK = root.t0;
        City.applyConfig({ lat: 41.5243, lon: -72.0759 });
        City.setup('neon', { cw: root.cw, ch: root.ch, woff: root.woff, ww: 2269, pxk: 3, zoom: root.zoom,
                             taskbarWp: 17, quality: 'balanced', frameMs: 125 });
        City.CFG_GORE = arg("gore","full");
        City.FORCEAGE = root.age;
        // ⚠ xf is a fraction of WW (2269), NOT of the screen — 0.42 lands off the right edge of a
        // 776 wp primary and renders nothing, which reads exactly like a broken feature.
        if (root.dis !== "")
            City.FORCEDIS = { type:root.dis, intensity:root.disI, xf:(root.woff + 380) / 2269,
                              w:40, seed:root.disSeed, f:root.disF,
                              win:(root.disWin === "0" ? false : null) };
        else City.FORCEDIS = null;
        // ⚠ FORCEWX, not City.weather.x = y — the latter is clobbered by the live fetch.
        if (root.wx === "overcast")
            City.FORCEWX = { code:3, cloud:100, wind:10, temp:73, precip:0, feels:73, gust:14 };
        else
            City.FORCEWX = { code:0, cloud:5, wind:8, temp:76, precip:0, feels:76, gust:10 };
    }

    Canvas { id: bg; anchors.fill: parent; renderTarget: Canvas.Image
        renderStrategy: Canvas.Immediate; antialiasing: false
        onPaint: { City.NOWOVR = City.CLOCK = root.t0; City.draw(getContext("2d"), "bg"); } }
    Canvas { id: live; anchors.fill: parent; renderTarget: Canvas.Image
        renderStrategy: Canvas.Immediate; antialiasing: false
        onPaint: { City.NOWOVR = City.CLOCK = root.t0; City.draw(getContext("2d"), "live"); } }

    Timer {
        interval: 360; running: true; repeat: true
        onTriggered: {
            if (root.warm === 0) root.arm();
            bg.requestPaint(); live.requestPaint();
            if (root.warm < 1) { root.warm++; return; }
            console.warn("GEOM land=" + root.land + " SW=" + City.SW + " SH=" + City.SH +
                         " HORIZON=" + City.HORIZON + " GROUND=" + City.GROUND +
                         " SEA_FRONT=" + City.SEA_FRONT + " KSP=" + City.KSP);
            console.warn("SAVL v" + root.variant + " w" + root.woff +
                         " onscreen=" + City.SAVL_N +
                         " species=" + JSON.stringify(City.SAVL_SP) +
                         " acts=" + JSON.stringify(City.SAVL_ACT));
            root.grabToImage(function (r) {
                r.saveToFile(root.outDir + "/" + (root.egg !== "" ? root.egg : root.land) + "-" + root.tag + "-w" + root.woff +
                             "-v" + root.variant + "-a" + root.age + "-h" + root.hour + ".png");
                Qt.quit();
            });
        }
    }
}
