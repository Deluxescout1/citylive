import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// Exercise the EXACT engine calls the KDE config page (config.qml) makes, on the REAL Qt6 QML JS engine
// (V4) — no Canvas, no Kirigami. Catches QML-JS quirks the node/kde-repro harnesses can't: NOFETCH
// namespace-writability, City.setup() with no canvas, almanacData()/popFmt() under V4, object-literal args.
// Run: QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 almanac-qml.qml
Item {
    Component.onCompleted: {
        var ok = true, why = "";
        try {
            City.NOFETCH = true;                                  // must be writable via the import namespace
            if (City.NOFETCH !== true) { ok = false; why = "NOFETCH not writable"; }
            City.setup("neon", { cw: 853, ch: 480, woff: 0, ww: 2269, pxk: 3, zoom: 1, quality: "spectacle" });
            var A = City.almanacData(Date.now());
            var need = ["cityName","teamName","life","era","phase","growthPct","population","economy","fate","history"];
            for (var i = 0; i < need.length; i++) {
                var v = A[need[i]];
                if (v === undefined || v === null || (typeof v === "number" && isNaN(v)) || v === "") { ok = false; why = "bad field " + need[i] + "=" + v; }
            }
            if (ok && !(A.population >= 0)) { ok = false; why = "population " + A.population; }
            if (ok && typeof City.popFmt(A.population) !== "string") { ok = false; why = "popFmt not string"; }
            if (ok && A.history.length) { var h = A.history[0]; if (!(h.life >= 1) || !h.era || !h.fate) { ok = false; why = "bad history " + JSON.stringify(h); } }
            if (ok && (typeof City.VERSION !== "string" || !City.VERSION)) { ok = false; why = "VERSION not readable: " + City.VERSION; }   // the config page's version Label reads City.VERSION
            console.log("ALMANAC_QML " + (ok ? "OK" : "FAIL " + why));
            console.log("  " + A.cityName + " | Life " + A.life + " | " + A.era + " | " + A.phase
                + " | pop " + City.popFmt(A.population) + " | econ " + A.economy + " | fate " + A.fate
                + " | regime=" + (A.regime ? A.regime.label : "none") + " | history=" + A.history.length);
        } catch (e) {
            console.log("ALMANAC_QML FAIL threw: " + e);
        }
        Qt.quit();
    }
}
