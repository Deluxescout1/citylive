import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as New
import "_ctl_city.js" as Ctl

// WHAT DID THE DAMAGE SWEEP COST? Two engines in ONE process — the live one and `_ctl_city.js`, which
// is `d297571`, the commit before Phase 9's damage work started — alternating land by land and hour by
// hour so thermal drift and GC land on both alike. A before/after taken as two separate runs measures
// the machine at two moments as much as it measures the code, and this project has been fooled by that.
//
// TWO QUESTIONS, and they are not the same question:
//   CLEAN — no disaster anywhere. This is ~98% of all frames and it must not have moved at all.
//   HIT   — a lost CAT-5 in reach. This is what the sweep actually buys, and it is allowed to cost.
//
// ⚠ `_ctl_city.js` IS NOT COMMITTED — it is a 46,000-line duplicate of the engine and would show up in
// every future diff of it. Regenerate it before running, from whatever commit you want as the control:
//   git show d297571:org.citylive.wallpaper/contents/js/city.js > desktop/_ctl_city.js
//
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-perf-damage.qml
//
// MEASURED 2026-08-04, end of Phase 9 (damage sweep + 23 signatures + 8 new disasters + the gore push),
// three rounds, two hours, six lands, against d297571:
//   BG   clean -0.25..+2.48ms · hit -0.27..+3.27ms
//   LIVE clean -0.45..+0.63ms · hit -0.71..+0.11ms
// 🔑 THE LIVE LINE IS THE RESULT. Every signature and every gore mark added this phase draws in the
// live pass, and it did not move — the whole cost sits in `bg`, which repaints at ~0.5fps, and it is
// only paid while an event is actually in reach.
Item {
    width: 1552; height: 874
    Canvas {
        id: cv; anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        property bool done: false
        onPaint: {
            if (done) return; done = true;
            var g = getContext("2d");
            var CYC = 604800000, EPOCH = 1783972450746;
            var lands = ["alpine","savanna","dunes","cliffs","mesa","karst","forest"];
            var acc = {};   // acc[engine][mode][land] = {ms, n}
            function key(e,m,l){ return e+"|"+m+"|"+l; }

            function one(C, eng, land, mode, hour) {
                C.GROW_CYCLE = CYC; C.NOFETCH = true; C.FORCEEGG = null;
                C.FORCEBIOME = land; C.FORCEVARIANT = 0;
                C.FORCEDIS = (mode === "hit")
                    ? { type:"tornado", intensity:5, xf:0.17, w:40, seed:7, f:0.30, win:false }
                    : null;
                var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
                d.setHours(hour, 10, 0, 0);
                C.NOWOVR = C.CLOCK = d.getTime();
                C.setup('city', { cw:1552, ch:874, woff:0, ww:2269, pxk:2, zoom:2,
                                  taskbarWp:28, quality:'balanced', frameMs:125 });
                C.FORCEAGE = 0.80;
                C.weather.code = 0; C.weather.wind = 10; C.weather.temp = 70; C.weather.cloud = 20;
                C.draw(g, "bg"); C.draw(g, "live");          // build the caches — not what we are timing
                // ⚠ THE CACHES ARE NULLED EACH ITERATION ON PURPOSE. The scorch rides on top of cached
                // geometry, so timing a bg pass that skips the rebuild would time the wrong thing —
                // but so would timing only the rebuild. Both engines get identical treatment, which is
                // what makes the RATIO meaningful even where the absolute number is not.
                var t0 = Date.now(), N = 8;
                for (var k = 0; k < N; k++) {
                    C.mtsCache = null; C.duneCache = null; C.karstCache = null; C.savCache = null;
                    C.NOWOVR = C.CLOCK = d.getTime() + k*140;
                    C.draw(g, "bg");
                }
                // ⚠ STOP THE BG CLOCK HERE. The first version of this edit accumulated `t0` AFTER the
                // live loop below, so every bg figure silently included a live pass and the deltas
                // jumped from +0.02..+0.94 to +2.00..+4.21 — a "regression" that was entirely the
                // instrument. A timer that spans two things measures neither.
                var bgMs = Date.now() - t0;
                // ⚠ AND THE LIVE PASS, which is where every signature and every gore mark actually
                // lives. `bg` repaints at ~0.5fps and `live` repaints every frame, so a regression
                // that only shows here is the one that would be felt. Timed separately, same
                // interleaving, and reported on its own line.
                var tl = Date.now(), NL = 14;
                for (var kl = 0; kl < NL; kl++) {
                    C.NOWOVR = C.CLOCK = d.getTime() + kl*140;
                    C.draw(g, "live");
                }
                var lk = key(eng, mode, land) + "|live";
                if (!acc[lk]) acc[lk] = { ms:0, n:0 };
                acc[lk].ms += Date.now() - tl; acc[lk].n += NL;
                var kk = key(eng, mode, land);
                if (!acc[kk]) acc[kk] = { ms:0, n:0 };
                acc[kk].ms += bgMs; acc[kk].n += N;
            }

            for (var r = 0; r < 3; r++)
                for (var j = 0; j < lands.length; j++)
                    for (var h = 0; h < 2; h++) {
                        var hour = h ? 23 : 13;
                        // interleaved: new/ctl back to back on the same land at the same hour
                        one(New, "new", lands[j], "clean", hour);
                        one(Ctl, "ctl", lands[j], "clean", hour);
                        one(New, "new", lands[j], "hit",   hour);
                        one(Ctl, "ctl", lands[j], "hit",   hour);
                    }

            var out = "BGPERF  ms per bg frame   (ctl = d297571, before the damage sweep)";
            for (var m = 0; m < lands.length; m++) {
                var L = lands[m], line = "\n  " + L;
                for (var mi = 0; mi < 2; mi++) {
                    var mode = mi ? "hit" : "clean";
                    var a = acc[key("new", mode, L)], b = acc[key("ctl", mode, L)];
                    var va = a.ms / a.n, vb = b.ms / b.n;
                    var al = acc[key("new", mode, L) + "|live"], bl = acc[key("ctl", mode, L) + "|live"];
                    var la = al.ms / al.n, lb = bl.ms / bl.n;
                    line += "   " + mode + " bg" + (va - vb >= 0 ? "+" : "") + (va - vb).toFixed(2)
                          + " live" + (la - lb >= 0 ? "+" : "") + (la - lb).toFixed(2)
                          + " (live " + la.toFixed(1) + "/" + lb.toFixed(1) + ")";
                }
                out += line;
            }
            console.log(out);
            Qt.callLater(Qt.quit);
        }
        Component.onCompleted: requestPaint()
    }
}
