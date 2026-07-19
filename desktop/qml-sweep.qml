import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// No-try/catch-class sweep: run City.draw across many pinned conditions on the REAL Qt Canvas
// (getContext is only valid inside onPaint). Each job is wrapped so a ReferenceError (the wmood
// frame-blank trap) is DETECTED and reported instead of silently blanking. Prints SWEEP_OK/FAIL.
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 qml-sweep.qml
Item {
    width: 853; height: 480
    Canvas {
        id: cv; anchors.fill: parent; renderTarget: Canvas.FramebufferObject
        property bool done: false
        onPaint: {
            if (done) return;
            done = true;
            var g = getContext("2d");
            var clk = 1784219400000, dusk = 1784246700000, night = 1784255400000;
            var jobs = [];
            var ages = [0.05, 0.2, 0.35, 0.5, 0.62, 0.78, 0.9], times = [clk, dusk, night];
            for (var a = 0; a < ages.length; a++) for (var t = 0; t < times.length; t++) jobs.push({ age: ages[a], clock: times[t] });
            var deaths = ["meteors","nuke","kaiju","kaijuwar","moonfall","flood","frost","ai","bh","alienwar","sunburst","pollution"];
            for (var d = 0; d < deaths.length; d++) jobs.push({ age: {g:1,phase:'apoc',apoc:0.5,cy:0.98}, clock: night, death: deaths[d] });
            jobs.push({ age: {g:1,phase:'peak',apoc:0,cy:0.9}, clock: clk });   // space age
            // Weather/attack disasters (drawDisaster paths) on a grown city, at the active-funnel phase
            // (f=0.25) AND the later/rebuild phase (f=0.55) so both draw branches are throw-checked.
            var diss = ["asteroid","volcano","zombie","alien","kaiju","tornado","flood","mech","kraken","sandstorm","iceage","rift","blackout","smog"];
            for (var s = 0; s < diss.length; s++) for (var fp = 0; fp < 2; fp++)
                jobs.push({ age: 0.6, clock: clk, dis: { type: diss[s], intensity: 4, xf: 0.5, w: 60, seed: 77, f: [0.25, 0.55][fp] } });
            // street events (drawConcert/drawFoodFest/drawChampionship/drawIceRink + the older ones) on a grown city, day & night
            var evs = ["concert","foodfest","champ","icerink","market","parade","movie","marathon","protest","film","balloonfest"];
            for (var ev = 0; ev < evs.length; ev++) jobs.push({ age: 0.7, clock: [clk, night][ev % 2], event: evs[ev] });
            // voted civic landmarks (drawUniversity/GrandCentral/Zoo/Observatory/Marina) — done + under-construction, day & night
            var lms = ["university","marina","zoo","observatory","grandcentral"];
            for (var lm = 0; lm < lms.length; lm++) for (var bp = 0; bp < 2; bp++)
                jobs.push({ age: 0.72, clock: [clk, night][lm % 2], civics: [{ t: lms[lm], kind: "build", civic: true, pass: true, bp: ["done","cons"][bp], prog: 0.5, x: 1200, w: 60, seed: 998877 }] });
            // seasons — exercise the ambient leaf/petal drifters + snow/shimmer paths (autumn/spring/summer/winter, grown city)
            var seasonClocks = [1792087200000, 1776276000000, 1784138400000, 1768500000000];
            for (var sc = 0; sc < seasonClocks.length; sc++) jobs.push({ age: 0.7, clock: seasonClocks[sc] });

            var ok = true;
            try { City.setup('neon', { cw: 853, ch: 480, woff: 0, ww: 2269, pxk: 3, zoom: 1, quality: 'spectacle' }); }
            catch (e) { console.log("SWEEP_FAIL setup: " + e); ok = false; }
            if (ok) for (var j = 0; j < jobs.length; j++) {
                City.FORCEAGE = jobs[j].age;
                City.CLOCK = jobs[j].clock;
                City.FORCEDEATH = (jobs[j].death !== undefined ? jobs[j].death : undefined);
                City.FORCEDIS = (jobs[j].dis !== undefined ? jobs[j].dis : null);
                City.FORCEEVENT = (jobs[j].event !== undefined ? jobs[j].event : null);
                City.FORCEELECT = (jobs[j].civics !== undefined ? { civics: jobs[j].civics } : null);
                try { City.draw(g); }
                catch (e) { console.log("SWEEP_FAIL job " + j + " " + JSON.stringify(jobs[j]).slice(0,70) + ": " + e); ok = false; }
            }
            console.log(ok ? ("SWEEP_OK " + jobs.length + " conditions clean") : "SWEEP_HAD_ERRORS");
            Qt.quit();
        }
    }
    Timer { interval: 300; running: true; repeat: true; onTriggered: cv.requestPaint() }
}
