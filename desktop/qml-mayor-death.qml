import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// Find a clock at which the mayor ACTUALLY died — organically, from the real disaster stream.
// ⚠ mayorDeathThisTerm() deliberately ignores FORCEDIS, because a forced disaster has no slot in the
// timeline to have happened IN. So the emergency succession cannot be faked; it has to be found. This
// walks real clock time inside the engine (node is not the runtime — a stubbed canvas renders "fine"
// and proves nothing about scope or globals), reports the first hit, and prints enough to render it.
Item {
    id: root
    width: 64; height: 64

    Component.onCompleted: {
        City.NOFETCH = true;
        City.setup('neon', { cw:1552, ch:874, woff:0, ww:2269, pxk:3, zoom:2,
                             taskbarWp:17, quality:'balanced', frameMs:125 });
        var CYC = 604800000, EPOCH = 1783972450746;
        City.GROW_CYCLE = CYC;
        var found = 0, scanned = 0;
        // step by half a disaster slot so no event is stepped over
        var step = 210000;
        for (var li = 40; li < 46 && found < 3; li++) {
            var t0 = EPOCH + li * CYC;
            for (var t = t0; t < t0 + CYC && found < 3; t += step) {
                scanned++;
                City.NOWOVR = City.CLOCK = t;
                var M = null;
                try { M = City.mayorState(t); } catch (e) { console.warn("THREW: " + e); return; }
                if (M && M.emergency) {
                    console.warn("MAYORDEATH life=" + li + " clock=" + t +
                                 " dead=" + M.deadName + " successor=" + M.winName +
                                 " halfMast=" + M.halfMast + " since=" + M.emergencySince);
                    found++;
                    t += CYC * 0.08;   // skip past this term so the next hit is a different one
                }
            }
        }
        console.warn("SCANNED " + scanned + " clocks, found " + found);
        Qt.quit();
    }
}
