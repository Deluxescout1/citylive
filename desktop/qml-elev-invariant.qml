import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// THE ELEVATED-LINES INVARIANT + A FAILURE PROFILE, read out of the running engine.
//
// 🔑🔑 WHY THIS EXISTS. `apocElevCl(wx)` mirrors `apocHit(x)`'s dispatch and returns the 0..1 each
// branch already computes instead of throwing it away. That is only safe if the two agree about WHO
// IS HIT, for every ending, at every moment — and this engine has been bitten twice by exactly the
// opposite: `apocStruck()` was a hand-written case per death and 14 of 31 endings had none, and
// `apocFull()` had the identical hole one level down. A parallel dispatch that drifts is the same
// bug with a new name, so the agreement is asserted here rather than hoped for.
//
//   INVARIANT:  apocElevCl(x) >= 0   ⟺   apocHit(x)      for every ending except `flood`
//
// ⚠ THE FLOOD IS EXEMPT ON PURPOSE, and it is why apocElevCl takes a height at all. `apocHit` asks
// `floodGroundHit` — "is the GROUND at x under water". A deck 86 world px in the air is not, and not
// for a long time after the street has gone under. It drowns on `floodCl(h)`, the same law the towers
// beside it drown on. The exemption is listed, not silent.
//
//   qml6 qml-elev-invariant.qml                       # the invariant, all 43 endings
//   qml6 qml-elev-invariant.qml -- profile=kaiju apocms=5500
//                                                     # …plus a per-span dump: cl, f, sag, gone
Item {
    id: root
    width: 8; height: 8

    function arg(k, d) {
        var a = Qt.application.arguments;
        for (var i = 0; i < a.length; i++) if (a[i].indexOf(k + "=") === 0) return a[i].substring(k.length + 1);
        return d;
    }
    property string profile: arg("profile", "")
    property double profMs: parseFloat(arg("apocms", "5500"))

    Component.onCompleted: {
        var CYC = 604800000, EPOCH = 1783972450746;
        City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null; City.FORCEBIOME = "plains";
        var d = new Date(EPOCH + 44 * CYC + Math.round(0.45 * CYC));
        d.setHours(13, 0, 0, 0);
        var base = d.getTime(); var t0 = base - (base % 900000) + 450000;
        City.NOWOVR = City.CLOCK = t0;
        City.applyConfig({ lat: 41.5243, lon: -72.0759 });
        City.setup('neon', { cw: 776, ch: 437, woff: 0, ww: 2269, pxk: 3, zoom: 1,
                             taskbarWp: 17, quality: 'balanced', frameMs: 125 });

        // 🔑 THE STATE IS SET DIRECTLY, NOT BY PAINTING 645 FRAMES. `draw()` resolves cityPhase,
        // curDeath, apocMs and cityApoc deep inside itself and there is no separable step to call, so
        // the first version ran a full frame per (ending × moment) and took minutes. These four globals
        // ARE the apocalypse's whole state as far as every predicate under test is concerned — each
        // reads them and nothing else — and setting them is exactly what FORCEAPOCMS does one line
        // later in draw(). ⚠ If a predicate ever starts reading a fifth, this harness must set it too.
        function setApoc(dk, ms) {
            City.cityPhase = "apoc"; City.cityG = 1; City.curDeath = dk;
            City.apocMs = ms; City.cityApoc = Math.min(1, ms / (City.APOC_BAND * CYC));
        }

        // Every ending the engine can reach, from its own tables — NOT a list retyped here, which is
        // how a harness comes to certify a set that no longer matches the engine's.
        var deaths = [];
        var seen = {};
        function add(a){ if(!a) return; for(var i=0;i<a.length;i++){ var k=(typeof a[i]==="string")?a[i]:a[i].k; if(k&&!seen[k]){seen[k]=1; deaths.push(k);} } }
        // ⚠ DEATHS_ALL IS NOT ALL OF THEM. It is DEATHS + DEATHS_NEW; the six that never reach the
        // ordinary lottery — the five OSRS homages and the nine-tailed fox — live in DEATHS_SPECIAL,
        // and they are precisely the ones this change treats differently (they demolish nothing on
        // purpose). A sweep that quietly skipped them would have certified the feature without ever
        // testing the interesting half of it. 37 became 43.
        add(City.DEATHS); add(City.DEATHS_V3); add(City.DEATHS_ALL);
        add(City.DEATHS_SPECIAL); add(City.RS_DEATHS); add(City.DEATHS_ALL3);
        for (var k in City.APOC_X) if(!seen[k]){ seen[k]=1; deaths.push(k); }

        console.warn("ELEV-INVARIANT over " + deaths.length + " endings: " + deaths.join(","));

        // sweep the whole world, and sweep TIME — a front that has not started and one that has swept
        // everything both agree trivially; the disagreement, if there is one, lives in between.
        var msSweep = [200, 1200, 2600, 4000, 5500, 7500, 10000, 14000, 20000, 60000,
                       0.10*0.02*CYC, 0.26*0.02*CYC, 0.40*0.02*CYC, 0.65*0.02*CYC, 0.93*0.02*CYC];
        // 🚨 A POSITIVE CONTROL, because the dangerous failure of this harness is that it PASSES.
        // If writing City.cityPhase from QML did not reach the module's own reads, every predicate
        // would answer "not in the apocalypse", both sides would be false everywhere, and the
        // invariant would report a perfect score having tested nothing at all. So count the checks
        // where something WAS hit, and fail loudly if that count is zero.
        var hits = 0, modeSeen = {};
        var fails = 0, checks = 0, failEx = [];
        for (var di = 0; di < deaths.length; di++) {
            var dk = deaths[di];
            City.FORCEDEATH = dk;
            for (var mi = 0; mi < msSweep.length; mi++) {
                setApoc(dk, msSweep[mi]);
                for (var xi = 0; xi < 2269; xi += 37) {
                    var hit = City.apocHit(xi), cl = City.apocElevCl(xi);
                    checks++; if (hit) hits++;
                    modeSeen[City.apocElevMode()] = 1;
                    // ⚠ THE GROUND-LEVEL PATH IS SWEPT TOO, AND IT IS NOT EXEMPT. `floodCl(0)` reduces
                    // to `w >= 0` — true from the first frame — so anything standing ON the ground
                    // (drawTramwayIce) would be told it was drowning before the waters came. At
                    // hAbove<=2 apocElevCl asks the GROUND's question, which is apocHit's own, so here
                    // the flood must agree EXACTLY and gets no exemption.
                    var cl0 = City.apocElevCl(xi, 0);
                    checks++;
                    if ((cl0 >= 0) !== hit) {
                        fails++;
                        if (failEx.length < 12) failEx.push("GROUND " + dk + " ms=" + Math.round(msSweep[mi]) + " x=" + xi + " hit=" + hit + " cl0=" + cl0.toFixed(3));
                    }
                    if (dk === "flood") continue;                 // documented exemption — DECK height only
                    if ((cl >= 0) !== hit) {
                        fails++;
                        if (failEx.length < 12) failEx.push(dk + " ms=" + Math.round(msSweep[mi]) + " x=" + xi + " hit=" + hit + " cl=" + cl.toFixed(3));
                    }
                }
            }
        }
        var modes = []; for (var mk in modeSeen) modes.push(mk);
        console.warn("ELEV-INVARIANT checks=" + checks + " mismatches=" + fails
                     + " positive-control(hits)=" + hits + " modes=" + modes.join("/"));
        if (hits === 0) console.warn("  🚨 POSITIVE CONTROL FAILED — nothing was ever hit, so this run tested NOTHING.");
        for (var fi = 0; fi < failEx.length; fi++) console.warn("  MISMATCH " + failEx[fi]);

        // THE PROFILE — what the viaduct actually looks like, span by span, at one moment. Reading
        // this beats reading a render for "why is the fold band that wide": the render cannot tell
        // you whether a span is at f=0.3 or f=0.9, and the width of that band is the whole feature.
        if (root.profile !== "") {
            setApoc(root.profile, root.profMs);
            console.warn("PROFILE " + root.profile + " apocms=" + root.profMs
                         + " epi=" + City.apocEpiX(City.NOWOVR) + " mode=" + City.apocElevMode()
                         + " struck=" + City.apocStruck() + " deckH=" + City.elevDeckH()
                         + " wreckX=" + City.elevWreckX(City.NOWOVR));
            var line = "";
            for (var px = 0; px < 776; px += 40) {
                var st = City.elevState(px, City.elevDeckH(), Math.round(City.elevDeckH() * 0.62));
                line += px + ":" + (st.gone ? "GONE" : ("f" + st.f.toFixed(2) + "/s" + st.sag)) + "  ";
            }
            console.warn("  " + line);
        }
        Qt.quit();
    }
}
