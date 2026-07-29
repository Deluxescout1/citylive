import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// THE STREET at Nick's three REAL monitor geometries, at 13:00 and 23:00.
// Both hours because a crossing or a gait keyed to daylight reverts silently at night — which is
// exactly how the alpine face shipped broken. All three offsets because anything world-anchored
// (and a crossing is) lands differently on the middle and right screens.
Item {
    id: root
    width: 1552; height: 874
    property var geo: [ {w:1552,h:874,woff:0,   z:2, k:2},      // primary
                        {w:854, h:480,woff:776, z:1, k:3},      // middle
                        {w:854, h:480,woff:1629,z:1, k:3} ]     // right
    property var hours: [13, 23]
    property int gi: 0
    property int hi: 0
    Canvas {
        id: cv
        // guarded: the index runs one past the end after the final grab, and an unguarded
        // binding here evaluates geo[N].w on the way out
        width: root.gi < root.geo.length ? root.geo[root.gi].w : 16
        height: root.gi < root.geo.length ? root.geo[root.gi].h : 16
        renderTarget: Canvas.Image
        renderStrategy: Canvas.Immediate
        antialiasing: false
        onPaint: {
            if (root.gi >= root.geo.length) return;   // the timer fires once more after the last grab
            var g = getContext("2d");
            var CYC = 604800000, EPOCH = 1783972450746, G = root.geo[root.gi];
            City.GROW_CYCLE = CYC; City.NOFETCH = true;
            City.FORCEBIOME = "sprawl"; City.FORCEVARIANT = 0;
            var d = new Date(EPOCH + 76*CYC + Math.round(0.45*CYC));
            d.setHours(root.hours[root.hi], 10, 0, 0);
            City.NOWOVR = City.CLOCK = d.getTime();
            City.setup('city', { cw:G.w, ch:G.h, woff:G.woff, ww:2269, pxk:G.k, zoom:G.z,
                                 taskbarWp:28, quality:'balanced', frameMs:125 });
            City.FORCEAGE = 0.85;
            City.weather.code = 0; City.weather.wind = 6; City.weather.temp = 62; City.weather.cloud = 20;
            City.NOWOVR = City.CLOCK = d.getTime();
            City.draw(g, "bg");
            City.draw(g, "live");
        }
    }
    Timer {
        interval: 300; running: true; repeat: true
        onTriggered: {
            if (root.gi >= root.geo.length) { Qt.quit(); return; }
            cv.requestPaint();
            cv.grabToImage(function(res){
                res.saveToFile(root.outDir + "/st3-woff" + root.geo[root.gi].woff
                               + "-h" + root.hours[root.hi] + ".png");
                root.hi++;
                if (root.hi >= root.hours.length) { root.hi = 0; root.gi++; }
            });
        }
    }
    property string outDir: "/tmp/claude-1000/-home-deluxescout/dcbadfcb-7fc7-43ae-866e-fdd216f8e15d/scratchpad"
}
