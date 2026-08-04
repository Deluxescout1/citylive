import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as New
import "_ctl_city.js" as Ctl

// DID THE TWO CUTOVERS DO WHAT THEY CLAIM, AND DID THEY REWRITE THE PAST?
// 🔑 Three assertions in one run, and none of them can be made by reading the code:
//   1. slots BEFORE the cutover are bit-for-bit what the old engine produced (type, intensity, win,
//      ruin, x, w) — this is the 40,000-slot diff standard the cadence change was held to;
//   2. the rate after the cutover actually halved (the whole point of the "rarer" answer, which had
//      silently never been in force because the constant resolved to 2027-01-02);
//   3. the eight new types actually APPEAR in the post-cutover stream, in a sane proportion.
//
// ⚠ `_ctl_city.js` is gitignored. Regenerate before running:
//   git show d297571:org.citylive.wallpaper/contents/js/city.js > desktop/_ctl_city.js
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-dis-cutover.qml
Item {
    width: 64; height: 64
    Component.onCompleted: {
        var CYC = 604800000, EPOCH = 1783972450746;
        function arm(C) {
            C.NOFETCH = true; C.GROW_CYCLE = CYC; C.FORCEEGG = null; C.FORCEBIOME = "plains";
            C.FORCEVARIANT = 0; C.FORCEDIS = null; C.FORCERUIN = null;
            C.NOWOVR = C.CLOCK = EPOCH + 42 * CYC;
            C.setup('city', { cw:1552, ch:874, woff:0, ww:2269, pxk:2, zoom:2,
                              taskbarWp:28, quality:'balanced', frameMs:125 });
        }
        arm(New); arm(Ctl);
        var CUT = New.DIS_TYPE_CUTOVER;

        // ---- 1. the past must not have moved ----
        var checked = 0, mism = 0, firstMism = "";
        for (var i = CUT - 40000; i < CUT; i++) {
            var a = New.disasterInfo(i), b = Ctl.disasterInfo(i);
            if (!a && !b) continue;
            checked++;
            if (!a || !b) { mism++; if (!firstMism) firstMism = "slot " + i + " presence"; continue; }
            if (a.type !== b.type || a.intensity !== b.intensity || a.win !== b.win
                || a.ruin !== b.ruin || a.x !== b.x || a.w !== b.w) {
                mism++; if (!firstMism) firstMism = "slot " + i + " " + b.type + "->" + a.type;
            }
        }

        // ---- 2. the rate, either side ----
        var preN = 0, postN = 0, N = 40000;
        for (var p = CUT - N; p < CUT; p++) if (New.disasterInfo(p)) preN++;
        for (var q = CUT; q < CUT + N; q++) if (New.disasterInfo(q)) postN++;
        var slotMin = New.DIS_SLOT / 60000;
        var preRate = (N * slotMin) / Math.max(1, preN);
        var postRate = (N * slotMin) / Math.max(1, postN);

        // ---- 3. do the new types actually appear? ----
        var seen = {}, newSeen = 0, newTot = 0;
        for (var r = CUT; r < CUT + N; r++) {
            var d = New.disasterInfo(r); if (!d) continue;
            seen[d.type] = (seen[d.type] || 0) + 1;
        }
        var missing = [];
        for (var t = 0; t < New.DIS_TYPES_NEW.length; t++) {
            var ty = New.DIS_TYPES_NEW[t];
            if (seen[ty]) { newSeen++; newTot += seen[ty]; } else missing.push(ty);
        }
        var counts = [];
        for (var k in seen) counts.push(k + ":" + seen[k]);
        counts.sort();

        console.log("CUTOVER  DIS_TYPE_CUTOVER=" + CUT + "  (" + new Date(CUT * New.DIS_SLOT).toISOString() + ")"
          + "\n  1 HISTORY   " + checked + " pre-cutover disasters diffed vs d297571 -> "
              + mism + " mismatches" + (firstMism ? "  first=" + firstMism : "")
          + "\n  2 CADENCE   before 1 per " + preRate.toFixed(1) + " min (" + preN + "/" + N + " slots)"
              + "   after 1 per " + postRate.toFixed(1) + " min (" + postN + "/" + N + ")"
          + "\n  3 NEW TYPES " + newSeen + "/" + New.DIS_TYPES_NEW.length + " present, "
              + newTot + " events (" + (100 * newTot / Math.max(1, postN)).toFixed(1) + "% of the stream)"
              + (missing.length ? "  MISSING=" + missing.join(",") : "")
          + "\n  mix " + counts.join(" "));
        Qt.callLater(Qt.quit);
    }
}
