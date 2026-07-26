import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// ECLIPSE ON THE REAL RUNTIME. node is not the runtime — the QML V4 engine has caught things the
// node tests could not, three times now. This renders the sky through a real eclipse at Nick's
// screen geometry, from several DIFFERENT LOCATIONS, and times the frame while it does it.
//
// The point of the location list is to see with your eyes what the tests assert: on 2024-04-08
// Buffalo goes dark and Norwich only goes dusky, at different times, from one clock.
Item {
    id: root
    width: 2269; height: 437          // THE WHOLE WORLD: at 3pm the Sun sits ~1360 world px along,
                                      // which is off the right of any single screen's slice.

    property var shots: [
        { n:"norwich-1500", lat:41.5243, lon:-72.0759, utc:"2024-04-08T19:00:00Z" },
        { n:"norwich-1530", lat:41.5243, lon:-72.0759, utc:"2024-04-08T19:30:00Z" },
        { n:"buffalo-1521", lat:42.8864, lon:-78.8784, utc:"2024-04-08T19:21:00Z" },
        { n:"houston-1442", lat:29.7604, lon:-95.3698, utc:"2024-04-08T18:42:00Z" },
        { n:"seattle-1431", lat:47.6062, lon:-122.3321, utc:"2024-04-08T18:31:00Z" },
        { n:"norwich-none", lat:41.5243, lon:-72.0759, utc:"2027-08-02T13:00:00Z" }
    ]
    property int idx: 0
    property int warm: 0
    property double t0: 0
    property string outDir: "/tmp/claude-1000/-home-deluxescout/48f22420-cb8d-47ef-8c39-d5207bc423d6/scratchpad/eclipse"

    function arm() {
        var S = root.shots[root.idx];
        City.GROW_CYCLE = 604800000;
        City.NOFETCH = true;
        City.FORCEEGG = null;
        root.t0 = new Date(S.utc).getTime();
        City.NOWOVR = City.CLOCK = root.t0;
        // ⚠ PIN THE LAND *BEFORE* setup(). The life index comes from the clock, so an eclipse date
        // lands on whatever biome that date rolls — the first run of this harness drew the ASHLANDS,
        // whose sky is dark red on purpose, and the eclipse was unreadable against it. And setting the
        // pin AFTER setup() is worse than useless: setup() has already built the world, `buildWorld`
        // only re-runs when the life index CHANGES, so the first shot silently kept the old land while
        // every later shot got the new one. That is exactly what the first run of this file produced.
        City.FORCEBIOME = 'alpine'; City.FORCEVARIANT = 0;
        // ⚠⚠ MOVE THE OBSERVER THROUGH applyConfig, NOT BY ASSIGNING City.LAT. Writing a top-level
        // engine `var` from QML across a JS module import does NOT take — every shot in the first
        // three runs of this harness silently rendered at Norwich, which made Seattle's sun appear
        // exactly where Norwich's belonged and sent me hunting a rendering bug that did not exist.
        // applyConfig is the supported path and also re-derives REGION for the new place.
        City.applyConfig({ lat: S.lat, lon: S.lon });
        City.setup('neon', { cw:2269, ch:437, woff:0, ww:2269, pxk:3, zoom:1,
                             taskbarWp:0, quality:'balanced', frameMs:125 });
        City.applyConfig({ lat: S.lat, lon: S.lon });   // again: setup() re-reads the config
        City.FORCEAGE = 0.85;
        City.weather.code = 0; City.weather.wind = 4; City.weather.temp = 58; City.weather.cloud = 5;
        var e = City.eclipseNow(new Date(root.t0));
        console.log("ECL " + S.n + "  obsc=" + (e.sol.obsc * 100).toFixed(1) + "%  mag=" + e.sol.mag.toFixed(3)
                    + "  alt=" + e.sol.sunAlt.toFixed(1) + "  total=" + e.sol.total + "  visible=" + e.sol.visible
                    + "  dx=" + e.sol.dx.toFixed(2) + " dy=" + e.sol.dy.toFixed(2));
    }

    Canvas { id: bg; anchors.fill: parent; renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate
        antialiasing: false
        onPaint: { City.NOWOVR = City.CLOCK = root.t0; City.draw(getContext("2d"), "bg"); } }
    Canvas { id: live; anchors.fill: parent; renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate
        antialiasing: false
        onPaint: { City.NOWOVR = City.CLOCK = root.t0; City.draw(getContext("2d"), "live"); } }

    Timer {
        interval: 350; running: true; repeat: true
        onTriggered: {
            if (root.idx >= root.shots.length) { Qt.quit(); return; }
            if (root.warm === 0) root.arm();
            var t = Date.now();
            bg.requestPaint(); live.requestPaint();
            if (root.warm < 1) { root.warm++; return; }
            console.log("  frame " + root.shots[root.idx].n + " = " + (Date.now() - t) + " ms (both passes)");
            root.grabToImage(function(res){
                res.saveToFile(root.outDir + "/" + root.shots[root.idx].n + ".png");
                root.idx++; root.warm = 0;
            });
        }
    }
}
