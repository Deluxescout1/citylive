import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// ⏱️🚨🚨 EVERY PERF NUMBER THIS SESSION WAS TAKEN ON A CANVAS TEN TIMES TOO SMALL.
// Nick, three times: it feels slow. My harnesses said ~30ms/frame and healthy ratios, so I kept
// looking at the wall. `plasmashell` was sitting at 268% CPU and 5.1 GB RSS the whole time.
// The harness default is 1552x874 = 1.4M pixels. His actual outputs are 1920x1080 + 2560x1440 +
// 3840x2160 = 14.1M. 🔑 THE TRAP IS ALREADY WRITTEN DOWN IN MY OWN NOTES — "canvas must be the
// PHYSICAL screen" — and the default is comfortable enough that it never announces itself.
// 🔑🔑 A HARNESS THAT IS CHEAP TO RUN IS NOT A HARNESS THAT IS CHEAP TO TRUST. Fill rate is the
// dominant cost in a canvas renderer, so a 10x pixel error is a ~10x cost error, and NOTHING about
// the ratios I was reporting would have looked wrong.
//
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-perf-realsize.qml
Item {
    width: 640; height: 480
    Canvas {
        id: cv; width: 3840; height: 2160
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        property bool done: false
        onPaint: {
            if (done) return; done = true;
            var g = getContext("2d");
            var CYC = 604800000, EPOCH = 1783972450746;
            City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null; City.FORCEDIS = null;
            // his three, in world-x order, plus the harness default for comparison
            // his REAL canvases, before and after the texelBuf fix — derived from
            // kscreen (1920@1, 2560@1, 2327@1.65→dpr2) through main.qml's own arithmetic
            var screens = [
                { n:"HDMI-A-3  (coarse, unchanged)", w:640,  h:360,  woff:1629 },
                { n:"DP-4  NOW  full-res",           w:2562, h:1440, woff:776  },
                { n:"DP-4  FIXED coarse",            w:854,  h:480,  woff:776  },
                { n:"DP-3  NOW  full-res",           w:4656, h:2622, woff:0    },
                { n:"DP-3  FIXED coarse",            w:1552, h:874,  woff:0    }
            ];
            function run(s, death, ms) {
                City.FORCEBIOME = "plains"; City.FORCEVARIANT = 0;
                var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
                d.setHours(13, 10, 0, 0);
                City.NOWOVR = City.CLOCK = d.getTime();
                City.setup('city', { cw:s.w, ch:s.h, woff:s.woff, ww:2269, pxk:2, zoom:2,
                                     taskbarWp:28, quality:'balanced', frameMs:125 });
                City.FORCEAGE = 0.80;
                City.FORCEDEATH = death; City.FORCEAPOCMS = (ms >= 0) ? ms : null;
                City.weather.code = 0; City.weather.wind = 10; City.weather.temp = 70; City.weather.cloud = 20;
                City.mtsCache = null;
                City.draw(g, "bg"); City.draw(g, "live");
                var t0 = Date.now();
                for (var k = 0; k < 8; k++) { City.NOWOVR = City.CLOCK = d.getTime() + k*140; City.draw(g, "live"); }
                return (Date.now() - t0) / 8;
            }
            var out = "REAL-SIZE LIVE PASS (ms/frame, budget is 125ms at 'balanced')\n";
            var sumN = 0, sumA = 0;
            for (var i = 0; i < screens.length; i++) {
                var s = screens[i], norm = 0, apoc = 0;
                for (var r = 0; r < 2; r++) {
                    norm += run(s, "nuke", -1);                    // an ordinary living city
                    apoc += run(s, "thetitans", Math.round(0.70*0.02*CYC));
                }
                norm /= 2; apoc /= 2;
                if (s.n.indexOf("NOW") >= 0 || s.n.indexOf("unchanged") >= 0) { sumN += norm; sumA += apoc; }
                out += "  " + s.n + "  " + (s.w*s.h/1e6).toFixed(1) + "MPx"
                     + "   normal=" + norm.toFixed(1) + "ms   titans=" + apoc.toFixed(1) + "ms\n";
            }
            out += "  ---- NOW  (all three): normal=" + sumN.toFixed(0) + "ms  titans=" + sumA.toFixed(0)
                 + "ms  = " + (100*sumN/125).toFixed(0) + "% / " + (100*sumA/125).toFixed(0) + "% of a 125ms budget ----";
            console.warn(out);
            Qt.callLater(Qt.quit);
        }
        Component.onCompleted: requestPaint()
    }
}
