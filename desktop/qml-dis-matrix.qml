import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// THE CAPABILITY MATRIX, READ OUT OF THE RUNNING ENGINE — 15 disasters x 28 lands.
// 🔒 His verification answer was BOTH: an automated pass so nothing is silently missing, AND
// signature-shot contact sheets for judgement. This is the first half.
//
// ⚠⚠ NOT HAND-AUTHORED, AND THAT IS THE ENTIRE POINT. 420 cells typed by hand are correct on the day
// they are typed and wrong the first time somebody adds a land — which is precisely how the disaster
// set came to predate maps 12-20 with nobody noticing. Every column below is a QUESTION PUT TO THE
// ENGINE: it sets each biome up for real, then asks `disExemption`, `DIS_SIG`, `disDestroys` and
// `disMinorEvent` what they actually say.
//
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-dis-matrix.qml
Item {
    width: 64; height: 64
    Component.onCompleted: {
        City.NOFETCH = true;
        var CYC = 604800000, EPOCH = 1783972450746;
        City.GROW_CYCLE = CYC;

        // every land the engine can be in: the 20 in BIOMES plus the 8 egg lands
        var lands = [];
        for (var i = 0; i < City.BIOMES.length; i++) lands.push({ k: City.BIOMES[i].k, egg: false });
        for (var e = 0; e < City.EGG_BIOMES.length; e++) lands.push({ k: City.EGG_BIOMES[e].k, egg: true });

        // ⚠ DIS_TYPES_ALL, not DIS_TYPES. The frozen 15 is what slots BEFORE the cutover roll; the
        // matrix has to describe what the engine does now, and reading the wrong array is how a
        // generated report ends up as confidently wrong as a hand-typed one.
        var types = City.DIS_TYPES_LIVE;
        var rows = [], swapCount = 0, sigCount = 0;

        for (var L = 0; L < lands.length; L++) {
            var ld = lands[L];
            if (ld.egg) { City.FORCEEGG = ld.k; City.FORCEBIOME = null; }
            else        { City.FORCEEGG = null; City.FORCEBIOME = ld.k; }
            City.FORCEVARIANT = 0;
            City.NOWOVR = City.CLOCK = EPOCH + 42 * CYC;
            City.setup('city', { cw:1552, ch:874, woff:0, ww:2269, pxk:2, zoom:2,
                                 taskbarWp:28, quality:'balanced', frameMs:125 });
            var B = City.curBiome;
            var cells = [];
            for (var t = 0; t < types.length; t++) {
                var ty = types[t];
                var ex = City.disExemption(ty, B);
                if (ex) { cells.push(ty + "->" + ex.to); swapCount++; }
                else cells.push(ty);
            }
            rows.push({ k: ld.k, name: B ? B.name : "?", egg: ld.egg,
                        ocean: !!City.hasOcean, exKey: City.disExemptKey(B) || "-",
                        cells: cells });
        }

        // which types have a lifecycle signature, and which half of it
        var sig = [];
        for (var s = 0; s < types.length; s++) {
            var w = !!City.disSig(types[s], "warn"), a = !!City.disSig(types[s], "after");
            if (w || a) sigCount++;
            sig.push(types[s] + ":" + (w ? "W" : "-") + (a ? "A" : "-"));
        }

        var out = "DISMATRIX " + lands.length + " lands x " + types.length + " types\n";
        out += "SIGNATURES (W=warn A=after): " + sig.join(" ") + "\n";
        out += "SIGNED " + sigCount + "/" + types.length + "   SUBSTITUTIONS " + swapCount + "\n";
        for (var r2 = 0; r2 < rows.length; r2++) {
            var R = rows[r2], sw = [];
            for (var c = 0; c < R.cells.length; c++) if (R.cells[c].indexOf("->") >= 0) sw.push(R.cells[c]);
            out += "\n" + (R.egg ? "egg " : "    ") + R.k + " | " + R.name
                 + " | ocean=" + (R.ocean ? "Y" : "N") + " | exempt=" + R.exKey
                 + " | " + (sw.length ? sw.join(", ") : "(all fifteen play here)");
        }
        console.log(out);
        Qt.callLater(Qt.quit);
    }
}
