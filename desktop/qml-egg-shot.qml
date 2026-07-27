import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// THE HIDDEN VILLAGE, before and during its detail pass.
//
// Renders the leaf egg land at BOTH geometries that matter:
//   · "world" — the whole 2269 wp world at 1 canvas px per wp, so nothing can hide off-frame
//   · "primary" — Nick's REAL primary slice, 1552x874 canvas / zoom 2 / woff 0, which is the
//     composition he actually looks at. A land that reads on a panorama can still be a thin band here.
// Geometry read out of `journalctl --user | grep "CityLive screen located"`, never assumed — the
// harness parameters in this repo have been wrong four separate times.
//
// ⚠⚠ TWO STACKED CANVASES, NOT ONE. `draw(g,"live")` opens with clearRect(0,0,SW,SH), so painting
// "bg" then "live" onto one context throws the whole backdrop away and you get a city with no sky.
// grabToImage on the ROOT Item flattens them the way the compositor does.
// ⚠ The first bg paint is the one that BUILDS mtsCache — paint twice before grabbing or the
// mountains (and anything anchored to the ridge, i.e. the face rock) are simply missing.
//
// FORCEEGG pins the land, so this does not depend on the life-index table — which is stale anyway
// now that aa0ddc1 re-rolled every life's land.
Item {
    id: root
    width: 2269; height: 437

    // age sweep matters here: the village is meant to grow by DENSITY, so early/mid/late must differ.
    property var shots: [
        { n:"egg-air",     egg:"air",   mode:"primary", hour:13, age:0.85 },
        { n:"egg-fire",    egg:"fire",  mode:"primary", hour:13, age:0.85 },
        { n:"egg-core",    egg:"core",  mode:"primary", hour:13, age:0.85 },
        { n:"egg-air-w",   egg:"air",   mode:"world",   hour:13, age:0.85 },
        { n:"egg-fire-w",  egg:"fire",  mode:"world",   hour:13, age:0.85 },
        { n:"egg-core-w",  egg:"core",  mode:"world",   hour:13, age:0.85 }
    ]
    property int idx: 0
    property int warm: 0
    property string outDir: "/tmp/claude-1000/-home-deluxescout/2db058e7-bff3-40ca-bb41-421151bb5164/scratchpad/eggs"
    property double t0: 0

    function armShot() {
        var CYC = 604800000, EPOCH = 1783972450746;
        var S = root.shots[root.idx];
        City.GROW_CYCLE = CYC;
        City.NOFETCH = true;
        City.FORCEEGG = S.egg;
        var d = new Date(EPOCH + 40 * CYC + Math.round(0.45 * CYC));
        d.setHours(S.hour, 0, 0, 0);
        root.t0 = d.getTime();
        City.NOWOVR = City.CLOCK = root.t0;
        if (S.mode === "world") {
            root.width = 2269; root.height = 437;
            City.setup('neon', { cw:2269, ch:437, woff:0, ww:2269, pxk:3, zoom:1,
                                 taskbarWp:0, quality:'balanced', frameMs:125 });
        } else {
            // the real primary: 2327x1309 device px, dpr 2, zoom 2 -> 1552x874 canvas, world 2269 wp
            root.width = 1552; root.height = 874;
            City.setup('neon', { cw:1552, ch:874, woff:0, ww:2269, pxk:3, zoom:2,
                                 taskbarWp:0, quality:'balanced', frameMs:125 });
        }
        City.FORCEAGE = S.age;
        City.weather.code = 0; City.weather.wind = 6; City.weather.temp = 62;
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
