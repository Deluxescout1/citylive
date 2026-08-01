import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// HOW MUCH OF EACH LAND'S OWN DETAIL SURVIVES THE CITY BEING BUILT ON TOP OF IT.
// ------------------------------------------------------------------------------------------------
// ⚠⚠ THE QUESTION THIS ANSWERS. `drawBiomeDetail` and `drawBiomeLandmark` are called ~212 lines BEFORE
// the three building layers, so everything they paint at ground level ends up behind the whole city.
// That has produced a distinct "built, then invisible" bug on six lands — the Ashlands' spires and
// pouring foundry, the Empyrean, the dunes, the karst, the undercity, and the savanna's foreground
// herd — and every single time it was found by eye, one land at a time, after the feature was written.
//
// 🔑 ONE RENDER, THREE SNAPSHOTS. The obvious probe is to render each land twice, once with those two
// calls skipped, and diff. That is CONTAMINATED and I built it that way first: skipping the calls
// changes what the shared seeded stream does afterwards, so the diff counts unrelated pixels. It
// reported the same ~1,500 px on eight unrelated lands, which is what gave it away. Instead:
//   PRE   — the frame immediately before the two writers run
//   POST  — the frame immediately after them: (POST != PRE) is exactly what this land's detail PAINTED
//   FINAL — the finished picture: of those pixels, (FINAL == POST) is what SURVIVED the city
// No second render, no divergent stream, and the arithmetic is exact rather than indicative.
//
// ⚠ AND IT IS MEASURED AT A YOUNG CITY AND AGAIN AT A GROWN ONE, because "painted 40,000 px, kept 3%"
// and "painted 400 px" are completely different bugs that look identical in a single frame. That is
// the distinction the savanna herd cost three renders to establish.
//
// Run: QT_QPA_PLATFORM=offscreen qml6 desktop/qml-detail-occlusion.qml
Item {
    id: root
    // ⚠ SW = cw/zoom = 776, the world width one of Nick's screens actually sees. Magnification does not
    // affect a pixel RATIO, but the share of the world the skyline covers very much does.
    width: 1552; height: 874
    Canvas {
        id: cv; anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        property bool done: false
        onPaint: {
            if (done) return; done = true;
            var g = getContext("2d");
            var CYC = 604800000, EPOCH = 1783972450746;
            City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null; City.FORCEDIS = null;
            var lands = ["alpine","forest","mesa","cliffs","plains","beach","swamp","volcano",
                         "arctic","sprawl","hell","heaven","dunes","karst","fjord","salt",
                         "dam","under","savanna","canyon"];
            var AGES = [0.20, 0.85];
            var pre = null, post = null, cty = null;

            function snap() { return g.getImageData(0,0,root.width,root.height).data; }

            function measure(land, age) {
                City.FORCEBIOME = land; City.FORCEVARIANT = 0;
                var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
                d.setHours(13, 10, 0, 0);
                City.NOWOVR = City.CLOCK = d.getTime();
                City.setup('city', { cw:1552, ch:874, woff:0, ww:2269, pxk:2, zoom:2,
                                     taskbarWp:28, quality:'balanced', frameMs:125 });
                City.FORCEAGE = age;
                City.FORCEWX = { code:0, cloud:0, wind:6, temp:62, feels:62, precip:0, gust:6 };
                // every cached landform must be dropped or land N renders land N-1's silhouette
                City.mtsCache = null; City.duneCache = null; City.karstCache = null;
                City.gorgeCache = null; City.damCache = null; City.caveCache = null;
                City.savCache = null; City.plateauCache = null;
                pre = null; post = null; cty = null;
                City.DETAILPROBE = function(stage) {
                    // ⚠ the transform is still the draw's own; reset it or getImageData reads the
                    // wrong rectangle. Restored immediately, because draw() is mid-flight.
                    var t = g.getTransform ? null : null;
                    if (stage === "pre") pre = snap();
                    else if (stage === "post") post = snap();
                    else cty = snap();
                };
                g.setTransform(1,0,0,1,0,0);
                g.clearRect(0,0,root.width,root.height);
                City.draw(g);                            // classic single-canvas path: the whole picture
                City.DETAILPROBE = null;
                if (!pre || !post || !cty) return { painted: -1, kept: -1 };
                var painted = 0, kept = 0;
                for (var i = 0; i < pre.length; i += 4) {
                    var drew = (Math.abs(post[i]-pre[i]) > 6 || Math.abs(post[i+1]-pre[i+1]) > 6
                                || Math.abs(post[i+2]-pre[i+2]) > 6);
                    if (!drew) continue;
                    painted++;
                    // survived the BUILDINGS specifically — later veils and tints are not this question
                    if (Math.abs(cty[i]-post[i]) <= 6 && Math.abs(cty[i+1]-post[i+1]) <= 6
                        && Math.abs(cty[i+2]-post[i+2]) <= 6) kept++;
                }
                return { painted: painted, kept: kept };
            }

            var out = "DETAIL PAINT-ORDER — px this land's detail painted, and how many survive the city";
            out += "\n  land          young painted/kept        grown painted/kept";
            for (var i = 0; i < lands.length; i++) {
                var row = lands[i]; while (row.length < 12) row += " ";
                var line = "\n  " + row;
                for (var a = 0; a < AGES.length; a++) {
                    var m = measure(lands[i], AGES[a]);
                    line += "   " + m.painted + "/" + m.kept
                          + " (" + (m.painted > 0 ? Math.round(100*m.kept/m.painted) : 0) + "%)";
                }
                out += line;
            }
            console.log(out);
            Qt.callLater(Qt.quit);
        }
        Component.onCompleted: requestPaint()
    }
}
