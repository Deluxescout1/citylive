import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// Mountain-striping probe. Renders the BACKDROP pass at the exact canvas size the 4K@165%
// screen uses (1552x874 — see the "CityLive screen located" journal line) and saves the RAW
// canvas, unscaled and uncomposited. If the vertical lines are in this file the engine draws
// them; if they only appear on screen they come from the scale/filter path.
// Canvas.Image (software raster) so save() actually captures content offscreen — an FBO target
// saves blank here. Save from a timer, not from onPaint: the paint is not finished yet.
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 mtn-probe.qml
Item {
    id: root
    width: 1552; height: 874
    property string outPath: "/tmp/citylive-mtn-bg.png"
    Canvas {
        id: cv
        anchors.fill: parent
        renderTarget: Canvas.Image
        renderStrategy: Canvas.Immediate
        antialiasing: false
        property bool done: false
        onPaint: {
            if (done) return;
            done = true;
            var g = getContext("2d");
            try {
                City.draw(g, "bg");
                console.log("PROBE drew bg pass at " + width + "x" + height);
            } catch (e) {
                console.log("PROBE_ERR " + e);
            }
        }
    }
    Timer {
        interval: 1500; running: true
        onTriggered: { console.log("PROBE_SAVED " + cv.save(root.outPath) + " -> " + root.outPath); Qt.quit(); }
    }
    Component.onCompleted: cv.requestPaint()
}
