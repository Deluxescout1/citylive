import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// LOOK AT IT. Renders the full composited frame (bg then live, exactly as the two canvases stack)
// at one of Nick's real screens, at several instants a second apart, so the street can be eyeballed
// and consecutive frames diffed. Every metric in this session has agreed the crowd was fine while
// Nick said it looked bad; the picture is the arbiter, not the numbers.
Item {
    id: root
    width: 854; height: 480
    property int idx: 0
    property var stamps: [0, 1000, 2000, 3000]
    Canvas {
        id: cv
        anchors.fill: parent
        renderTarget: Canvas.Image          // an FBO target saves BLANK offscreen
        renderStrategy: Canvas.Immediate
        antialiasing: false
        onPaint: {
            var g = getContext("2d");
            var CYC = 604800000, EPOCH = 1783972450746;
            City.GROW_CYCLE = CYC;
            City.NOFETCH = true;
            if (root.idx === 0) {
                var d = new Date(EPOCH + 76*CYC + Math.round(0.45*CYC));
                d.setHours(13, 0, 0, 0);
                root.t0 = d.getTime();
                City.NOWOVR = City.CLOCK = root.t0;
                City.setup('neon', { cw:854, ch:480, woff:776, ww:2269, pxk:3, zoom:1,
                                     taskbarWp:28, quality:'balanced', frameMs:125 });
                City.FORCEAGE = 0.85;
                City.weather.code = 0; City.weather.wind = 6; City.weather.temp = 62;
            }
            City.NOWOVR = City.CLOCK = root.t0 + root.stamps[root.idx];
            City.draw(g, "bg");
            City.draw(g, "live");
        }
    }
    property double t0: 0
    Timer {
        interval: 250; running: true; repeat: true
        onTriggered: {
            if (root.idx >= root.stamps.length) { Qt.quit(); return; }
            cv.requestPaint();
            cv.grabToImage(function(res){
                res.saveToFile(root.outDir + "/street-" + root.stamps[root.idx] + "ms.png");
                root.idx++;
            });
        }
    }
    property string outDir: "/tmp/claude-1000/-home-deluxescout/6a55d31a-26bd-49d4-a173-74bfb6a8e546/scratchpad"
}
