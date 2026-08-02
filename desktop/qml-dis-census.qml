import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// Is a lost CAT-5 rare, or is the mayor-death path simply never reached? Census the REAL disaster
// stream by slot rather than by clock — one row per slot, no double counting — and report the
// intensity/win mix plus how many would name the mayor.
Item {
    width: 64; height: 64
    Component.onCompleted: {
        City.NOFETCH = true;
        City.setup('neon', { cw:1552, ch:874, woff:0, ww:2269, pxk:3, zoom:2,
                             taskbarWp:17, quality:'balanced', frameMs:125 });
        var CYC = 604800000, EPOCH = 1783972450746;
        City.GROW_CYCLE = CYC;
        City.NOWOVR = City.CLOCK = EPOCH + 42 * CYC;
        var byI = {}, lost = 0, tot = 0, destroys = 0, mayor = 0, lostCat5 = 0;
        var base = Math.floor((EPOCH + 40 * CYC) / (7 * 60000));
        for (var k = 0; k < 40000; k++) {
            var di = City.disasterInfo(base + k);
            if (!di) continue;
            tot++;
            byI[di.intensity] = (byI[di.intensity] || 0) + 1;
            if (di.win === false) lost++;
            if (City.disDestroys(di.type)) destroys++;
            if (di.win === false && di.intensity >= 5 && City.disDestroys(di.type)) {
                lostCat5++;
                var probe = { type:di.type, intensity:di.intensity, x:di.x, w:di.w,
                              seed:di.seed, win:di.win, ruin:di.ruin, f:1 };
                if (City.namedDeadIsMayor(probe, 0)) mayor++;
            }
        }
        console.warn("CENSUS slots=40000 disasters=" + tot + " destroys=" + destroys +
                     " lost=" + lost + " lostCAT5=" + lostCat5 + " mayorDeaths=" + mayor);
        console.warn("byIntensity=" + JSON.stringify(byI));
        Qt.quit();
    }
}
