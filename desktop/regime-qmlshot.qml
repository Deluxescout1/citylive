import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// Render a forced regime frame on the REAL Qt6 Canvas FBO (the surface that bit the statue topple) and
// grab it — so full-screen additive/veil effects (crimson wash, curfew darkness) can be eyeballed on the
// QML path, not just Chromium (kde-repro). Stage via env REGIME_STAGE (default 5). Out: tc-qml.png.
// Run: REGIME_STAGE=5 QT_QPA_PLATFORM=offscreen qml6 regime-qmlshot.qml
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
                City.setup('neon', { cw: 853, ch: 480, woff: 0, ww: 2269, pxk: 3, zoom: 1, quality: 'spectacle' });
                City.NOWOVR = 1784255400000; City.CLOCK = 1784255400000; City.FORCEAGE = 0.7;
                var st = parseInt(Qt.application.arguments.length > 0 ? "" : "") || 5;
                City.FORCEREGIME = { active: true, stage: 5, sub: 0.5, party: { k: "THE ORDER", c: "#c0182a" },
                    leaderName: "CHANCELLOR VOSS", path: "revolution", cyStart: 0.42, cyEnd: 0.80 };
                setupDone = true;
            }
            City.draw(g);
            if (setupDone && !grabbed) {
                grabbed = true;
                cv.grabToImage(function (r) { r.saveToFile("/home/deluxescout/CityLive/desktop/tc-qml.png"); console.log("QMLSHOT_OK"); Qt.quit(); });
            }
        }
    }
    Timer { interval: 200; running: true; repeat: true; onTriggered: cv.requestPaint() }
}
