import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// WHAT IS THE EMPYREAN ACTUALLY MADE OF? Before recommending anything, measure the things the rendered
// frames only suggest: how much of the frame the landform eats, whether the bedding-plane path (gated on
// B.flat>0.25, and heaven carries flat:0.62) is really being entered on this land, how tall the Great
// Gate is against the 7px person, and whether the floating islands' "fall of light" clears the alpha
// floor it breaks out on.
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-heaven-probe.qml
Item {
    id: root
    width: 1552; height: 874
    property var woffs: [0, 776, 1629]
    property int wi: 0
    property bool armed: false
    Canvas {
        id: bg; anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        onPaint: { City.draw(getContext("2d"), "bg"); }
    }
    function pct(a, p) { if (!a.length) return -1; var s = a.slice().sort(function(x,y){return x-y;}); return s[Math.min(s.length-1, Math.max(0,Math.round((s.length-1)*p)))]; }
    function arm() {
        var CYC = 604800000, EPOCH = 1783972450746;
        City.GROW_CYCLE = CYC; City.NOFETCH = true; City.FORCEEGG = null; City.FORCEDIS = null;
        City.FORCEBIOME = "heaven"; City.FORCEVARIANT = 0;
        var d = new Date(EPOCH + 62*CYC + Math.round(0.38*CYC));
        d.setHours(13, 10, 0, 0);
        City.NOWOVR = City.CLOCK = d.getTime();
        City.setup('city', { cw:1552, ch:874, woff:root.woffs[root.wi], ww:2269, pxk:2, zoom:2,
                             taskbarWp:28, quality:'balanced', frameMs:125 });
        City.FORCEAGE = 0.80;
        City.weather.code = 0; City.weather.wind = 10; City.weather.temp = 70; City.weather.cloud = 20;
        City.mtsCache = null;
        bg.requestPaint();
    }
    function measure() {
        var C = City.mtsCache;
        if (!C) { console.log("no mtsCache"); return; }
        var SW = C.h[1].length, gy = City.HORIZON, KSP = City.KSP, B = City.curBiome;
        var sky = gy;                                    // pixels of frame above HORIZON

        // --- how much of the SKY does each band's rock eat, and where is the crest? ---
        var out = "WOFF " + root.woffs[root.wi] + "  SW=" + SW + " HORIZON=" + gy + " KSP=" + KSP.toFixed(3)
                + " skyPx=" + sky + " flat=" + B.flat + " amp=" + B.amp + " base=" + B.base;
        for (var pi = 0; pi < 3; pi++) {
            var hs = C.h[pi]; if (!hs || !hs.length) { out += "\n  band" + pi + ": empty"; continue; }
            var mx = 0, sum = 0, nz = 0;
            for (var x = 0; x < hs.length; x++) { if (hs[x] > mx) mx = hs[x]; if (hs[x] > 0) { sum += hs[x]; nz++; } }
            var mean = nz ? sum / nz : 0;
            out += "\n  band" + pi + ": peak=" + mx + "px (" + (100*mx/sky).toFixed(1) + "% of sky)"
                 + "  mean=" + mean.toFixed(0) + "px (" + (100*mean/sky).toFixed(1) + "%)"
                 + "  cache.mx=" + C.mx[pi];
        }
        // --- is the SEDIMENTARY path actually entered here, and at what spacing? ---
        var stt = Math.max(2, Math.round(5*KSP*(0.5 + B.flat)));
        var strata = (B.flat>=0.8) ? Math.max(2,Math.round(5*KSP*(0.5+B.flat))) : Math.max(2,Math.round(3.2*KSP*(0.35+B.flat)));
        out += "\n  BEDDING PLANES: gate B.flat>0.25 -> " + (B.flat > 0.25) + "   spacing=" + stt + "px"
             + "  => ~" + Math.round(C.mx[1]/Math.max(1,stt)) + " level lines up the near band"
             + "   ridge-height QUANTISER strata=" + strata + "px";

        // --- the Great Gate, against the 7px person ---
        // ⚠ NOT KSP. drawBiomeLandmark builds its own K: max(KSP*1.7, gy/80), deliberately keyed to the
        // frame so a landmark is the same fraction of the picture on any monitor. Measuring it at KSP
        // undercounts the gate by ~70% and would have hidden the fact that it is the dominant object.
        var K = Math.max(Math.max(1,KSP)*1.7, gy/80);
        out += "\n  GREAT GATE (K=" + K.toFixed(2) + "): w=" + Math.round(22*K) + "px h=" + Math.round(26*K)
             + "px pier=" + Math.round(4.5*K) + "px  lintel top at gy-" + Math.round(26*K + 7*K)
             + " => " + (100*(26*K+7*K)/sky).toFixed(0) + "% of the sky, "
             + (100*22*K/SW).toFixed(0) + "% of screen width, " + ((26*K+7*K)/7).toFixed(0) + "x a person"
             + "\n    stage gate: cityG<0.24 returns => ABSENT on a young city, despite its comment"
             + " calling it 'free-standing… and predates everything'";

        // --- the floating islands: where do they hang, how big, and does the fall of light survive? ---
        var fallTopA_day = 0.085, fallTopA_night = 0.05;
        var Kd = Math.max(1, KSP);          // drawBiomeDetail's own K — plain KSP, unlike the landmark's
        out += "\n  ISLANDS (K=" + Kd.toFixed(2) + "): fiy range = gy*" + (0.20).toFixed(2) + ".." + (0.62).toFixed(2)
             + " => y " + Math.round(gy*0.20) + ".." + Math.round(gy*0.62)
             + "   halfwidth " + Math.round(14*Kd) + ".." + Math.round(34*Kd) + "px (full " + Math.round(28*Kd) + ".." + Math.round(68*Kd)
             + ", i.e. up to " + (100*68*Kd/SW).toFixed(0) + "% of screen width)"
             + "\n           FALL OF LIGHT: fallH=" + Math.round(gy*0.34) + "px in 12 slices of " + Math.round(gy*0.34/12) + "px;"
             + " alpha starts " + fallTopA_day + " (day) / " + fallTopA_night + " (night), breaks at <=0.006"
             + " => day slices drawn=" + (function(){var n=0;for(var q=0;q<12;q++){var f=q/12,a=0.085*(1-f)*(1-f); if(a<=0.006) break; n++;} return n;})()
             + ", night slices drawn=" + (function(){var n=0;for(var q=0;q<12;q++){var f=q/12,a=0.05*(1-f)*(1-f); if(a<=0.006) break; n++;} return n;})();

        // --- the ground band: is there any room for the gold veins? ---
        out += "\n  GROUND BAND: HORIZON=" + gy + " frame=" + root.height + " taskbar-adjusted gh=" + (root.height - gy)
             + "px  (gold veins draw from gy+5 downward)";

        // --- the motes ---
        out += "\n  MOTES: 34 of them, " + Math.max(1,Math.round(KSP*0.9)) + "px square, alpha 0.55 dry / 0.22 wet,"
             + " colour 255,244,196 source-over";
        console.log(out);
    }
    Timer {
        interval: 300; running: true; repeat: true
        onTriggered: {
            if (root.wi >= root.woffs.length) { Qt.quit(); return; }
            if (root.armed) { measure(); root.armed = false; root.wi++; }
            else { arm(); root.armed = true; }
        }
    }
}
