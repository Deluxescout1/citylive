import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// THE GREAT DAM — the lake, the far shore and the river crossing at street level.
// Renders the full composited frame at Nick's REAL 4K primary geometry as plasmashell logged it
// (cw:4656 ch:2622 woff:0 ww:2269 pxk:3 zoom:6 taskbarWp:17 -> SW=776 SH=437 K=2), because a harness
// at an idealised size has been wrong four times on this project.
//
// ⚠ TWO STACKED CANVASES, GRABBED FROM THE ROOT. draw(g,"live") begins with a clearRect, so drawing
// both passes into ONE canvas erases the backdrop and leaves a white frame with a few sprites on it.
// That is exactly what the first run of this harness produced.
//
// `qml6 qml-dam-lake.qml -- woff=776 age=0.4 hour=1 tag=night out=/some/dir`
// ⚠⚠ THE CANVAS IS THE PHYSICAL SCREEN (cw x ch), NOT THE WORLD (SW x SH). draw() opens with
// `g.setTransform(ZOOM,0,0,ZOOM,0,0)` — world px are scaled onto canvas px by ZOOM. At zoom:6 a
// 776x437 window therefore shows the top-left 129x73 world px blown up six times: a frame of bare
// sky with a bird in it, and NO error, because nothing is wrong. Sized wrong, this harness silently
// answers a different question — the fifth time a harness parameter has been wrong on this project.
// (A node/vm probe cannot catch this: its stubbed setTransform is a no-op, so node renders "fine".)
Item {
    id: root
    // ⚠⚠ THE GRAB IS CLIPPED AT 2560 PX. grabToImage on this box returns at most 2560x1346, so a
    // 4656x2622 root is CROPPED, not scaled — the first run of this harness returned the top-left 55%
    // of the frame (bare sky, a corner of one kopje) and nothing errored. Halving the canvas AND the
    // zoom together keeps SW/SH/KSP identical to Nick's real 4656x2622 primary — the world geometry is
    // cw/zoom, so only the magnification changes. Verify with diag=1: SW=776 SH=437 K=2.
    width: parseInt(arg("cw","2328"),10); height: parseInt(arg("ch","1311"),10)

    function arg(k, dflt) {
        var a = Qt.application.arguments;
        for (var i = 0; i < a.length; i++) if (a[i].indexOf(k + "=") === 0) return a[i].substring(k.length + 1);
        return dflt;
    }
    property int idx: 0
    // ⚠⚠ THE DEFAULT STAMPS OF THE HARNESS THIS WAS COPIED FROM SPAN 2.7 SECONDS, AND wildAt CUTS TIME
    // INTO 26-SECOND BLOCKS. Four frames inside one block show one activity and prove nothing about
    // behaviour: a conveyor and a script are indistinguishable over 2.7s. These step ACROSS block
    // boundaries by default, which is the undercity's lesson (a feature whose point is that it CHANGES
    // has to be rendered at two times before it is believed — one frozen bracket made 8am and 4pm
    // identical and nothing errored). Override with `stamps=0,13000,26000,52000`.
    property var stamps: arg("stamps","0,9000,18000,30000,44000,60000").split(",").map(function(v){ return parseInt(v,10); })
    property double t0: 0
    property int woff: parseInt(arg("woff", "0"), 10)
    property double age: parseFloat(arg("age", "0.85"))
    property int hour: parseInt(arg("hour", "13"), 10)
    property string tag: arg("tag", "sav")
    property string outDir: arg("out", "/tmp/claude-1000/-home-deluxescout/772a4e8c-f5b9-4ce3-a33a-965b2e253b08/scratchpad")
    property bool ready: false
    // ⚠ Qt swallows console.log/warn entirely in this environment (verified with a two-line qml file),
    // so an exception inside a draw pass is INVISIBLE — the symptom is a frame of bare sky and no
    // explanation. Errors are painted into the picture instead, because the picture is the one
    // channel that definitely works.
    property string err: ""

    function prime() {
        var CYC = 604800000, EPOCH = 1783972450746;
        City.GROW_CYCLE = CYC;
        City.NOFETCH = true;
        var vArg = arg("variant", ""), lArg = arg("land", "savanna");     // `land=hell` etc: the river deck lands on ALL 11 river lands
        if (vArg === "") City.applyConfig({ land: lArg });
        else City.applyConfig({ land: lArg, landVariant: parseInt(vArg, 10) });
        // ⚠ `egg=orbit` — the EGG lands (SPACE CITY, THE CORE, LEAF) are NOT reachable through `land`,
        // because eggOf() picks them on its own roll and `land` only pins the ordinary twenty. Asking for
        // land=orbit silently renders whatever the ordinary roll gave you (it gave me THE CINDER WASTE
        // and I nearly read that frame as evidence about orbit).
        // ⚠ the egg has to CLEAR `land` as well: a pinned land wins, so `egg=orbit` on top of the
        // default `land=dam` renders the dam and looks like a working answer about orbit.
        if (arg("egg", "") !== "") City.applyConfig({ land: "", egg: arg("egg", "") });
        // ⚠ `airshow=fly|disp` — a display is a rare scheduled event, so waiting for one to occur
        // naturally is not a test. This pins it, which is the only way to see the roofed land's drones.
        if (arg("airshow", "") !== "")
            City.FORCEAIRSHOW = { p: parseFloat(arg("airshowp", "0.45")),
                                  disp: arg("airshow", "") === "disp", seed: 12345 };
        var d = new Date(EPOCH + 76*CYC + Math.round(0.45*CYC));
        d.setHours(root.hour, 0, 0, 0);
        root.t0 = d.getTime();
        City.NOWOVR = City.CLOCK = root.t0;
        City.setup('neon', { cw:root.width, ch:root.height, woff:root.woff, ww:2269, pxk:3,
                             zoom:parseInt(arg("zoom","3"),10),
                             taskbarWp:17, quality:'balanced', frameMs:125 });
        // the FINALE path: `death=flood apoc=0.55` pins curDeath and drives cityApoc, which is the
        // other half of locked answer 1 and shares every stage with the disaster.
        if (arg("apoc", "") !== "") {
            City.FORCEAGE = { g:1, phase:"apoc", apoc: parseFloat(arg("apoc","0.5")), cy: 0.995 };
            City.FORCEDEATH = arg("death", "flood");
        } else City.FORCEAGE = root.age;
        // ⚠⚠ FORCEWX, NOT `City.weather.x = y`. draw() calls maybeFetchWeather() every frame, and in
        // QML that really fetches — so hand-set weather is overwritten by the live Norwich reading
        // within one frame and every render comes back showing whatever it is doing outside. A node
        // probe CANNOT see this: node has no XMLHttpRequest, fetchWeather() returns immediately, and
        // the hand-set values survive. That is exactly how this harness reported three identical
        // lakes for clear, rain and thunder while the node probe reported three different ones.
        City.FORCEWX = root.wx();
        City.FORCEDIS = root.dis();
        root.ready = true;
        if (arg("diag", "0") === "1")
            root.err = "SW=" + City.SW + " SH=" + City.SH + " K=" + City.KSP
                     + " HORIZON=" + City.HORIZON + " GROUND=" + City.GROUND
                     + " biome=" + (City.curBiome && City.curBiome.k)
                     + " cityG=" + City.cityG + " phase=" + City.cityPhase
                     + " FORCEAGE=" + City.FORCEAGE + " riverX=" + City.riverX;
    }
    // FORCEDIS drives the dam break: `dis=flood cat=5 disf=0.52`. xf is pinned to the real river so
    // the forced breach lands where the anchored one would — a harness that puts the event somewhere
    // the real code never would is a harness that tests a picture nobody will see.
    function dis() {
        if (arg("dis", "") === "") return null;
        return { type: arg("dis", "flood"), intensity: parseInt(arg("cat", "5"), 10),
                 xf: City.riverX, w: 34, seed: 123, f: parseFloat(arg("disf", "0.5")) };
    }
    function wx() {
        var t = parseInt(arg("temp", "62"), 10), w = parseInt(arg("wind", "6"), 10);
        return { code: parseInt(arg("code", "0"), 10), cloud: parseInt(arg("cloud", "0"), 10),
                 wind: w, temp: t, feels: t, precip: 0, gust: w };
    }
    function paintAt(ms) {
        City.NOWOVR = City.CLOCK = root.t0 + ms;
        bgcv.requestPaint();
        cv.requestPaint();
    }

    Canvas {
        id: bgcv
        anchors.fill: parent
        renderTarget: Canvas.Image
        renderStrategy: Canvas.Immediate
        antialiasing: false
        onPaint: {
            if (!root.ready) return;
            try {
                City.FORCEWX = root.wx(); City.FORCEDIS = root.dis();   // re-asserted every paint
                if (root.arg("onepass", "0") === "1") City.draw(getContext("2d"));
                else City.draw(getContext("2d"), "bg");
                if (root.arg("diag", "0") === "1")
                    root.err = "post-bg: cityG=" + City.cityG
                             + " FORCEWX=" + (City.FORCEWX ? JSON.stringify(City.FORCEWX) : "null")
                             + " weather=" + JSON.stringify(City.weather)
                             + " HORIZON=" + City.HORIZON + " GROUND=" + City.GROUND
                             + " TASKBAR_WP=" + City.TASKBAR_WP + " WW=" + City.WW
                             + " variant=" + (City.curBiome && City.curBiome.name)
                             + " holeX=" + City.waterHoleX() + " WOFF=" + City.WOFF
                             + " || onscreen herd=" + City.SAVL_N + " acts=" + JSON.stringify(City.SAVL_ACT);
            }
            catch (e) { root.err = "BG THREW: " + e + " | " + (e.stack || "").split("\n").slice(0,4).join(" << "); }
        }
    }
    property bool liveOn: arg("live", "1") === "1"
    Canvas {
        id: cv
        anchors.fill: parent
        visible: root.liveOn
        renderTarget: Canvas.Image
        renderStrategy: Canvas.Immediate
        antialiasing: false
        onPaint: {
            if (!root.ready || !root.liveOn) return;
            try { City.FORCEWX = root.wx(); City.FORCEDIS = root.dis(); City.draw(getContext("2d"), "live"); }
            catch (e) { root.err = "LIVE THREW: " + e + " | " + (e.stack || "").split("\n").slice(0,4).join(" << "); }
        }
    }
    Text {
        anchors.left: parent.left; anchors.top: parent.top
        width: parent.width; wrapMode: Text.Wrap
        visible: root.err !== ""
        color: "#ff2020"; font.pixelSize: 11; font.family: "monospace"
        text: root.err
    }

    Component.onCompleted: prime()
    Timer {
        interval: 300; running: true; repeat: true
        onTriggered: {
            if (root.idx >= root.stamps.length) { Qt.quit(); return; }
            root.paintAt(root.stamps[root.idx]);
            root.grabToImage(function(res){
                res.saveToFile(root.outDir + "/" + root.tag + "-" + root.stamps[root.idx] + "ms.png");
                root.idx++;
            });
        }
    }
}
