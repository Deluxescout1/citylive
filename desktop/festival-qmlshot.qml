import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// Render a forced FESTIVAL frame on the REAL Qt6 Canvas FBO (the surface the wallpaper actually uses) and
// grab it — so the stroke()/arc()-heavy Great Wheel + monument globe can be eyeballed on the QML path,
// not just Chromium (kde-repro). Stage via env FEST_STAGE (default 4 = THE FAIR). Night clock so the
// wheel cabins glow. Out: fest-qml.png.  Run: FEST_STAGE=4 QT_QPA_PLATFORM=offscreen qml6 festival-qmlshot.qml
Item {
    width: 853; height: 480
    Canvas {
        id: cv; anchors.fill: parent; renderTarget: Canvas.FramebufferObject
        property bool setupDone: false
        property bool grabbed: false
        onPaint: {
            var g = getContext("2d");
            if (!setupDone) {
                City.NOFETCH = true;
                City.setup('neon', { cw: 853, ch: 480, woff: 776, ww: 2269, pxk: 3, zoom: 1, quality: 'spectacle' });
                City.NOWOVR = 1784597400000; City.CLOCK = 1784597400000; City.FORCEAGE = 0.7;   // 9:30PM (night) so lit cabins show
                City.NOLIVESKY = true; City.FLIGHTS_ON = false;
                var st = parseInt(Qt.application.arguments[Qt.application.arguments.length - 1]);
                if (isNaN(st) || st < 1 || st > 5) st = 4;
                City.FORCEFESTIVAL = { active: true, stage: st, sub: 0.6, festivity: 0.7, theme: "WORLD", cyStart: 0.44, cyEnd: 0.83 };
                setupDone = true;
            }
            City.draw(g);
            if (setupDone && !grabbed) {
                grabbed = true;
                cv.grabToImage(function (r) { r.saveToFile("/home/deluxescout/CityLive/desktop/fest-qml.png"); console.log("FESTQMLSHOT_OK"); Qt.quit(); });
            }
        }
    }
    Timer { interval: 200; running: true; repeat: true; onTriggered: cv.requestPaint() }
}
