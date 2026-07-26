import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// RIDGE-LIGHT STRIPING PROBE + first-backdrop-build cost, at the canvas size Nick's 4K@165%
// screen actually uses (1552x874 — the "CityLive screen located" journal line), NOT the 853px
// perf harness or the 1500px biome probe. Both numbers this answers are ones a smaller canvas
// structurally cannot: the slope light emits alpha-banded vertical runs, which is the artifact
// class that has shipped broken to that monitor twice ([[citylive-mountain-lines]]), and every
// overlay added to drawMountains is O(SW) inside the ONE-OFF mtsCache build.
// Canvas.Image + Canvas.Immediate: an FBO target saves BLANK offscreen. Save from a Timer, not
// from onPaint — the paint is not finished there.
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 qml-ridge-probe.qml
// Then COLUMN-SCAN the saved PNGs: a texel beat shows up as many anomalous columns at ONE
// consistent pitch (49 at ~58px, in the v2.0.2 incident). Flank shading shows up as a handful of
// irregular edges. If the engine render is clean the engine is innocent and the artifact, if any,
// is in the display path — that discriminator is the whole reason this file renders raw.
// To compare against a baseline engine: `git show <ref>:org.citylive.wallpaper/contents/js/city.js
// > desktop/_baseline-city.js`, copy this file with the import repointed, run both, delete both.
Item {
    id: root
    width: 1552; height: 874
    property var lives: [6, 16, 2]                 // alpine · hell · mesa
    property var names: ["alpine", "hell", "mesa"]
    property int idx: 0
    Canvas {
        id: cv
        anchors.fill: parent
        renderTarget: Canvas.Image
        renderStrategy: Canvas.Immediate
        antialiasing: false
        property bool armed: false
        onPaint: {
            if (!armed) return;
            armed = false;
            var g = getContext("2d");
            var CYC = 604800000, EPOCH = 1783972450746, life = root.lives[root.idx];
            City.GROW_CYCLE = CYC;
            City.NOWOVR = EPOCH + life*CYC + Math.round(0.45*CYC);
            City.CLOCK = City.NOWOVR;
            City.setup('neon', { cw: 1552, ch: 874, woff: 0, ww: 4656, pxk: 3, zoom: 1, quality: 'spectacle' });
            City.FORCEAGE = 0.85;
            var t0 = Date.now();
            City.draw(g, "bg");                     // FIRST build: mtsCache + all three ridge bands
            var t1 = Date.now();
            City.draw(g, "bg");                     // and a repaint with the cache already warm
            var t2 = Date.now();
            console.log("PROBE " + root.names[root.idx] + " biome=" + City.curBiome.k
                        + " firstBgBuild=" + (t1-t0) + "ms  warmBg=" + (t2-t1) + "ms  SW=" + width);
        }
    }
    Timer {
        interval: 700; running: true; repeat: true
        property int step: 0
        onTriggered: {
            if (step % 2 === 0) { cv.armed = true; cv.requestPaint(); }
            else {
                cv.grabToImage(function(res){
                    res.saveToFile("/tmp/claude-1000/-home-deluxescout/569b6754-12ff-46bc-b025-ea82a065819d/scratchpad/ridge-" + root.names[root.idx] + ".png");
                    root.idx++;
                    if (root.idx >= root.lives.length) Qt.quit();
                });
            }
            step++;
        }
    }
}
