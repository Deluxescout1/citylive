import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as New
import "_ctl_city.js" as Ctl

// WHAT DID THE END-TIMES BLOOD LAYER COST? Same shape as qml-perf-damage.qml and for the same reason:
// TWO ENGINES IN ONE PROCESS, alternating, so thermal drift and scheduler noise land on both. A
// standalone before/after on this box has been wrong five times.
//
// What is being measured: apocVictims() builds ~230 victims (cached per life), and drawApocBloodField,
// drawApocFallenGround, drawApocFallen and drawApocMourners each walk that list EVERY FRAME with a
// screen cull. bloodMark loops rows per pool. All of it draws in the LIVE pass.
// 🔑 THE LIVE LINE IS THE RESULT — `bg` repaints at ~0.5fps, `live` repaints every frame, so a
// regression that shows up in live is the one that would actually be felt. The laptop sits at ~6.3%
// of total CPU against a 5% bar, so this is not a free budget.
//
// 🚨🔑 THREE ROUNDS x 16 FRAMES IS BELOW THIS BENCH'S OWN NOISE FLOOR. Two back-to-back runs of the
// identical pair reported kaiju at -0.89 ms and then +0.54 ms — a sign flip on code that had not
// changed between them. At 8 x 24 the endings that genuinely did not change (nuke, massacre) settle
// to within +/-0.3 ms, and that is the floor: a delta under ~0.3 ms here is NOT a result. This is the
// same lesson as the plasmashell reading that came back 0.67% / 19.3% / 88.9% for one config —
// interleaving controls for DRIFT, it does not control for SAMPLE SIZE, and only the second one was
// ever fixed here. Do not lower these two numbers to make the harness quicker.
//
// ⚠ `_ctl_city.js` IS NOT COMMITTED (gitignored) — regenerate before running. For "what did the whole
// blood layer cost", that is e208963; for "what did THIS change cost", it is the commit you started
// from — and only a control that HAS the ending can time it:
//   git show e208963:org.citylive.wallpaper/contents/js/city.js > desktop/_ctl_city.js
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-perf-apoc.qml
//
// ⚠ WHICH DEATHS TO LIST DEPENDS ON THE QUESTION, and the list gets edited per run — do not read it as
// fixed. Against the e208963 control it must be endings BOTH engines have (kaiju, frost, nuke, flood,
// massacre), because that control predates the twelve and isolates the blood layer every ending pays.
// Against a recent control it should be the ending you just changed PLUS one or two you did NOT touch —
// those are the reading of the noise floor for that run, and without them a delta means nothing.
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
            // the ending under review first, then UNCHANGED ones as the noise reading for this run.
            // ⚠⚠ SET THE FIRST ENTRY TO WHATEVER YOU ARE ACTUALLY REVIEWING. It is left pointing at
            // the last one benched (thehollow, 2026-08-08), and a stale name here does not fail — it
            // quietly benches a finished ending against itself and reports a convincing ~0.0 delta.
            // 🔑 `logout` is the only TRUE control: it is not an APOC_SWEEP ending, so it shares none
            // of the collapse/dust-wall machinery. Keep a sweep ending (thepit) as the second reading
            // when the change touches anything shared.
            var deaths = ["thehollow","logout","thepit"];   // the one under review FIRST, then UNCHANGED ones as this run's noise reading
            var acc = {};
            function key(e,d){ return e+"|"+d; }

            function one(C, eng, death, hour) {
                C.GROW_CYCLE = CYC; C.NOFETCH = true; C.FORCEEGG = null;
                C.FORCEBIOME = "plains"; C.FORCEVARIANT = 0;
                C.FORCEDIS = null;
                C.FORCEDEATH = death;
                C.FORCEAPOCMS = 5000000;          // mid-arc: the dead are down and the layer is at full load
                var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
                d.setHours(hour, 10, 0, 0);
                C.NOWOVR = C.CLOCK = d.getTime();
                C.setup('city', { cw:1552, ch:874, woff:0, ww:2269, pxk:2, zoom:2,
                                  taskbarWp:28, quality:'balanced', frameMs:125 });
                C.FORCEAGE = 0.80;
                C.weather.code = 0; C.weather.wind = 10; C.weather.temp = 70; C.weather.cloud = 20;
                C.draw(g, "bg"); C.draw(g, "live");        // build caches — not what we are timing
                // ⚠ TIME THE LIVE PASS ON ITS OWN CLOCK. A timer that spans two things measures
                // neither — that mistake invented a +2..+4ms regression here once already.
                var tl = Date.now(), NL = 24;
                for (var kl = 0; kl < NL; kl++) {
                    C.NOWOVR = C.CLOCK = d.getTime() + kl*140;
                    C.draw(g, "live");
                }
                var lk = key(eng, death);
                if (!acc[lk]) acc[lk] = { ms:0, n:0 };
                acc[lk].ms += Date.now() - tl; acc[lk].n += NL;
            }

            // ⚠ 8 ROUNDS IS THE FLOOR ONLY ON AN IDLE BOX. Measured 2026-08-07 on a machine that had
            // been rendering all session: at 8 the endings that had NOT changed read -0.61 and +0.42,
            // a 1.03 ms spread, so a real +0.5 was unreadable. At 18 they settled and the change under
            // test came back +0.10. 🔑 Interleaving controls for DRIFT, not for SAMPLE SIZE — when the
            // unchanged endings disagree by more than ~0.3, raise this rather than believing the delta.
            for (var r = 0; r < 18; r++)
                for (var j = 0; j < deaths.length; j++)
                    for (var h = 0; h < 2; h++) {
                        var hour = h ? 23 : 13;
                        one(New, "new", deaths[j], hour);   // interleaved, back to back
                        one(Ctl, "ctl", deaths[j], hour);
                    }

            var out = "APOCPERF  ms per LIVE frame during the apocalypse   (ctl = the commit this branch started this run from)";
            for (var m = 0; m < deaths.length; m++) {
                var D = deaths[m];
                var a = acc[key("new", D)], b = acc[key("ctl", D)];
                var va = a.ms / a.n, vb = b.ms / b.n;
                out += "\n  " + D + "   live " + va.toFixed(2) + " vs " + vb.toFixed(2)
                     + "   delta " + (va - vb >= 0 ? "+" : "") + (va - vb).toFixed(2) + " ms";
            }
            console.log(out);
            Qt.callLater(Qt.quit);
        }
        Component.onCompleted: requestPaint()
    }
}
