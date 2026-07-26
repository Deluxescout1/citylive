import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// CONTACT SHEET OF EVERY LAND, at Nick's REAL primary screen. Geometry read out of
// `journalctl --user | grep "CityLive screen located"` — 2327x1309 dpr=2 zoom=2 -> 1552x874 canvas,
// woff=0, world 2269 wp — never assumed; the harness parameters in this repo have been wrong four
// separate times.
//
// ⚠⚠ TWO STACKED CANVASES, NOT ONE. `draw(g,"live")` starts with `clearRect(0,0,SW,SH)` (city.js:20251)
// because every transparent layer must discard its previous frame. So calling draw(g,"bg") and then
// draw(g,"live") on the SAME context throws the entire backdrop away and leaves you looking at a city
// with no sky and no mountains. The shells stack two real canvases; so must any harness that wants a
// composited frame. `grabToImage` on the ROOT Item flattens them the same way the compositor does.
// ⚠⚠ AND THE LIFE INDICES BELOW CAME OUT OF THE ENGINE, NOT OUT OF A REIMPLEMENTED HASH. `mixLi`
// does `(h*2246822519)>>>0` on an h that is already ~2^32, so the product overflows 2^53 and the
// float multiply LOSES PRECISION — a faithful-looking `Math.imul` rewrite gives different answers.
// Picking indices that way silently handed three lands the wrong biome (li 12 is not the sprawl, it
// is an EGG life that rolls the air temples). Load renderer/city.js in node and ask `biomeOf`,
// `variantOf` and `eggOf` directly.
Item {
    id: root
    width: 2269; height: 437               // THE WHOLE WORLD, so no landmark can hide off-frame

    // variant 0 of each ordinary land — i.e. the look that shipped in v2.2.0 — then the five hidden
    // worlds at the life index where each one NATURALLY rolls (no FORCEEGG: this also proves the roll).
    property var lands: [
        { n:"alpine-0",  li:19  }, { n:"forest-0",  li:92  }, { n:"mesa-0",    li:25  },
        { n:"cliffs-0",  li:58  }, { n:"plains-0",  li:7   }, { n:"beach-0",   li:32  },
        { n:"swamp-0",   li:5   }, { n:"volcano-0", li:30  }, { n:"arctic-0",  li:95  },
        { n:"sprawl-0",  li:36  }, { n:"hell-0",    li:21  }, { n:"heaven-0",  li:110 },
        { n:"egg-leaf",  li:22  }, { n:"egg-core",  li:3   }, { n:"egg-fire",  li:23  },
        { n:"egg-air",   li:12  }, { n:"egg-falls", li:38  }
    ]
    property int idx: 0
    property int warm: 0            // paints of the current land so far (the first builds mtsCache)
    property string outDir: "/tmp/claude-1000/-home-deluxescout/48f22420-cb8d-47ef-8c39-d5207bc423d6/scratchpad/lands"
    property int hour: 13
    property double t0: 0

    function armLand() {
        var CYC = 604800000, EPOCH = 1783972450746;
        var L = root.lands[root.idx];
        City.GROW_CYCLE = CYC;
        City.NOFETCH = true;
        City.FORCEEGG = (L.egg !== undefined) ? L.egg : null;
        var d = new Date(EPOCH + L.li * CYC + Math.round(0.45 * CYC));
        d.setHours(root.hour, 0, 0, 0);
        root.t0 = d.getTime();
        City.NOWOVR = City.CLOCK = root.t0;
        // full world at 1 canvas px per world px. 437 wp of height is exactly what the real primary
        // shows (874 canvas px at zoom 2), so the horizon and every layer sit where Nick sees them.
        City.setup('neon', { cw:2269, ch:437, woff:0, ww:2269, pxk:3, zoom:1,
                             taskbarWp:0, quality:'balanced', frameMs:125 });
        City.FORCEAGE = 0.85;
        City.weather.code = 0; City.weather.wind = 6; City.weather.temp = 62;
    }

    Canvas {                                   // the slow backdrop: sky, stars, mountains, still terrain
        id: bg
        anchors.fill: parent
        renderTarget: Canvas.Image             // an FBO target saves BLANK offscreen
        renderStrategy: Canvas.Immediate
        antialiasing: false
        onPaint: { City.NOWOVR = City.CLOCK = root.t0; City.draw(getContext("2d"), "bg"); }
    }
    Canvas {                                   // everything that moves, buildings included
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
            if (root.idx >= root.lands.length) { Qt.quit(); return; }
            if (root.warm === 0) root.armLand();
            bg.requestPaint(); live.requestPaint();
            // paint twice before grabbing: the first bg paint is the one that BUILDS mtsCache
            if (root.warm < 1) { root.warm++; return; }
            root.grabToImage(function(res){
                res.saveToFile(root.outDir + "/" + root.lands[root.idx].n + ".png");
                root.idx++; root.warm = 0;
            });
        }
    }
}
