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
            // THE ORDER — regime HUD/banner/ticker across all 6 stages (day+night)
            for (var rg = 1; rg <= 6; rg++) jobs.push({ age: 0.66, clock: [clk, night][rg % 2],
                regime: { active: true, stage: rg, sub: 0.5, party: { k: "THE ORDER", c: "#c0182a" }, leaderName: "CHANCELLOR VOSS", path: "revolution", cyStart: 0.42, cyEnd: 0.80 } });
            // THE FESTIVAL — World's Fair wheel/bunting/monorail/monument/HUD across all 5 stages (day+night),
            // so the stroke/arc-heavy Ferris wheel + globe draw bodies actually EXECUTE on the QML Canvas
            for (var ft = 1; ft <= 5; ft++) jobs.push({ age: 0.66, clock: [clk, night][ft % 2],
                festival: { active: true, stage: ft, sub: 0.5, festivity: 0.7, theme: "WORLD", cyStart: 0.44, cyEnd: 0.83 } });
            // weather spectacle — thunderstorm+lightning strike & god-rays (broken cloud) draw paths
            jobs.push({ age: 0.7, clock: night, weather: { code: 95, cloud: 92, wind: 26, temp: 60, precip: 8 }, lightning: 0.85 });
            jobs.push({ age: 0.7, clock: clk, weather: { code: 3, cloud: 50, wind: 8, temp: 68, precip: 0 } });

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
                City.FORCEREGIME = (jobs[j].regime !== undefined ? jobs[j].regime : null);
                City.FORCEFESTIVAL = (jobs[j].festival !== undefined ? jobs[j].festival : null);
                if (jobs[j].weather !== undefined) { for (var wk in jobs[j].weather) City.weather[wk] = jobs[j].weather[wk]; }
                if (jobs[j].lightning !== undefined) City.lightning = jobs[j].lightning;
                try { City.draw(g); }
                catch (e) { console.log("SWEEP_FAIL job " + j + " " + JSON.stringify(jobs[j]).slice(0,70) + ": " + e); ok = false; }
            }
            console.log(ok ? ("SWEEP_OK " + jobs.length + " conditions clean") : "SWEEP_HAD_ERRORS");
            Qt.quit();
        }
    }
    Timer { interval: 300; running: true; repeat: true; onTriggered: cv.requestPaint() }
}
