import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// THE REAL DESKTOP, not an idealised one.
//
// ⚠ Every earlier harness here has timed a screen that does not exist. They use
// cw=1552 ch=874 zoom=1 ww=4656 — but plasmashell's own boot log for Nick's three monitors says:
//     virtualX=0    2327x1309 dpr=2 zoom=3 -> woff=0wp    2328x1311  panelBottom=50px (17wp)
//     virtualX=2328 2560x1440 dpr=1 zoom=1 -> woff=776wp   854x480   panelBottom=82px (28wp)
//     virtualX=4888 1920x1080 dpr=1 zoom=1 -> woff=1629wp  640x360   panelBottom=50px (17wp)
// So the whole world is 2269 world px wide, not 4656, and the 4K screen draws only 776 world px of
// it — into a 2328x1311 canvas at ZOOM 3. The old harness therefore rendered TWICE the world into
// HALF the pixels: too many features, too little fill. That is the third time this harness family
// has been wrong about its own parameters (see citylive-biome-looks). Numbers from it are not
// comparable to anything measured before; they are comparable to Nick's desktop, which is the point.
//
// Reports per screen and, crucially, the DESKTOP TOTAL per frame interval — the number that decides
// whether the frame rate can go up.
Item {
    width: 800; height: 400
    Canvas {
        id: cv; anchors.fill: parent; renderTarget: Canvas.FramebufferObject
        property bool done: false
        onPaint: {
            if (done) return; done = true;
            var CYC = 604800000, EPOCH = 1783972450746;
            City.GROW_CYCLE = CYC;
            City.NOFETCH = true;
            var WWP = 2269;                                   // (2327+2560+1920)/pxk3
            var SCREENS = [
                { n:"4K@165%", cw:2328, ch:1311, zoom:3, woff:0,    tb:17 },
                { n:"2560   ", cw:854,  ch:480,  zoom:1, woff:776,  tb:28 },
                { n:"1920   ", cw:640,  ch:360,  zoom:1, woff:1629, tb:17 }
            ];
            var LIVES = [[76,"forest"],[8,"beach"],[4,"sprawl"],[55,"arctic"],[3,"core"],[21,"hell"]];
            var N = 60;

            // one offscreen canvas per screen size, so each is timed into a buffer of its real size
            function ctxFor(s) { return cvs[s.n].getContext("2d"); }

            var grand = { bg:0, live:0 };
            for (var li = 0; li < LIVES.length; li++) {
                var tot = { bg:0, live:0 }, line = "";
                for (var si = 0; si < SCREENS.length; si++) {
                    var S = SCREENS[si], g = ctxFor(S);
                    City.NOWOVR = City.CLOCK = EPOCH + LIVES[li][0]*CYC + Math.round(0.45*CYC);
                    City.setup('neon', { cw:S.cw, ch:S.ch, woff:S.woff, ww:WWP, pxk:3, zoom:S.zoom,
                                         taskbarWp:S.tb, quality:'balanced', frameMs:200 });
                    City.FORCEAGE = 0.85;
                    City.weather.wind = 14; City.weather.temp = 62;
                    City.draw(g,"bg"); City.draw(g,"live");            // warm
                    var t0 = Date.now();
                    for (var i = 0; i < N; i++) { City.CLOCK = City.NOWOVR + i*200; City.draw(g,"live"); }
                    var live = (Date.now()-t0)/N;
                    var b0 = Date.now();
                    for (var j = 0; j < 10; j++) { City.CLOCK = City.NOWOVR + j*2000; City.draw(g,"bg"); }
                    var bg = (Date.now()-b0)/10;
                    tot.bg += bg; tot.live += live;
                    line += "  " + S.n + " live " + live.toFixed(1) + " bg " + bg.toFixed(1) + " |";
                }
                grand.bg += tot.bg; grand.live += tot.live;
                console.log("REAL " + LIVES[li][1] + " " + City.curBiome.k + line
                            + "   DESKTOP live " + tot.live.toFixed(1) + " ms  bg " + tot.bg.toFixed(1) + " ms");
            }
            var mLive = grand.live/LIVES.length, mBg = grand.bg/LIVES.length;
            console.log("\nREAL MEAN DESKTOP: live " + mLive.toFixed(1) + " ms/frame across 3 screens, bg " + mBg.toFixed(1) + " ms");
            // What one core's worth of CPU that is, at a few candidate live frame rates.
            // (bg is fixed at one repaint per 2 s per screen.)
            var rates = [5, 8, 10, 12, 15, 20, 24, 30];
            var out = "REAL cost of the LIVE layer at each frame rate (% of one core, all 3 screens):";
            for (var r = 0; r < rates.length; r++)
                out += "\n   " + String(rates[r]).padStart(2) + " fps -> " + (mLive*rates[r]/10).toFixed(0) + "%"
                     + "  (frame budget " + (1000/rates[r]).toFixed(0) + " ms, worst screen must fit)";
            console.log(out + "\n   plus bg " + (mBg/2/10).toFixed(1) + "% at one repaint per 2 s");
            Qt.quit();
        }
    }
    property var cvs: ({})
    Canvas { id: c0; visible:false; width:2328; height:1311; renderTarget: Canvas.FramebufferObject }
    Canvas { id: c1; visible:false; width:854;  height:480;  renderTarget: Canvas.FramebufferObject }
    Canvas { id: c2; visible:false; width:640;  height:360;  renderTarget: Canvas.FramebufferObject }
    Component.onCompleted: { cvs = { "4K@165%": c0, "2560   ": c1, "1920   ": c2 }; }
    Timer { interval: 400; running: true; repeat: true; onTriggered: cv.requestPaint() }
}
