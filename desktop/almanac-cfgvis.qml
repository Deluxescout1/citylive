import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// Isolate the ONE genuinely-untested bit of the KDE config Almanac: the exact string refreshAlmanac()
// assembles (popFmt + <b>/<br>/<font>/&mdash; markup) rendered as RichText. i18n() resolving in prod is
// already proven by every other label in config.qml — here we stub it as a passthrough (with %1
// substitution, like ki18n's fallback) so we can SEE the assembled+rendered text. grabToImage → PNG.
// Run: QT_QPA_PLATFORM=offscreen qml6 almanac-cfgvis.qml
Rectangle {
    id: root; width: 460; height: 340; color: "#232629"
    function i18n(s, a, b, c, d) {
        if (a !== undefined) s = s.replace("%1", a);
        if (b !== undefined) s = s.replace("%2", b);
        if (c !== undefined) s = s.replace("%3", c);
        if (d !== undefined) s = s.replace("%4", d);
        return s;
    }
    Text {
        id: lab; anchors { fill: parent; margins: 14 }
        color: "#fcfcfc"; wrapMode: Text.WordWrap; textFormat: Text.RichText
        lineHeight: 1.2; font.pointSize: 10; text: "…"
    }
    Component.onCompleted: {
        City.NOFETCH = true;
        City.setup("neon", { cw: 853, ch: 480, woff: 0, ww: 2269, pxk: 3, zoom: 1, quality: "spectacle" });
        // Force a life we KNOW is a regime + landmark-rich life (matches the almanac.js life-6 sample) so
        // the render exercises the regime <font> branch, landmarks, and the full history block.
        var now = 6 * City.GROW_CYCLE + City.GROW_EPOCH - City.GROW_OFFSET_DAYS * 86400000 + Math.round(0.66 * City.GROW_CYCLE);
        City.NOWOVR = now; City.CLOCK = now;
        var A = City.almanacData(now);   // pure — no draw() needed
        // ---- verbatim copy of config.qml refreshAlmanac() string assembly ----
        var econ = A.economy >= 60 ? i18n("Boom") : (A.economy <= 40 ? i18n("Bust") : i18n("Steady"));
        var lead = A.regime ? (A.regime.leader + " — " + A.regime.label)
                 : (A.mayor ? (A.mayor.name + " (" + A.mayor.party + ")") : i18n("No government"));
        var s = "<b>" + A.cityName + "</b> &mdash; " + i18n("home of the %1", A.teamName) + "<br>"
              + i18n("Incarnation") + " No. " + A.life + " · " + A.era + " · " + A.phase + " (" + A.growthPct + "%)<br>"
              + i18n("Population") + ": <b>" + City.popFmt(A.population) + "</b> &nbsp; "
              + i18n("Economy") + ": " + econ + "<br>"
              + i18n("Leadership") + ": " + (A.regime ? "<font color='#e0555f'>" + lead + "</font>" : lead) + "<br>"
              + i18n("Fated end") + ": " + A.fate;
        if (A.landmarks && A.landmarks.length) s += "<br>" + i18n("Landmarks") + ": " + A.landmarks.join(" · ");
        if (A.history && A.history.length) {
            s += "<br><br><b>" + i18n("Past civilizations") + "</b>";
            for (var i = 0; i < A.history.length; i++) {
                var e = A.history[i];
                s += "<br>" + i18n("Life") + " " + e.life + " · " + e.era + " — " + i18n("fell to %1", e.fate);
            }
        }
        lab.text = s;
        console.log("ASSEMBLED len=" + s.length + " regime=" + (A.regime ? A.regime.label : "none") + " landmarks=" + (A.landmarks ? A.landmarks.length : 0));
        grabTimer.start();
    }
    Timer { id: grabTimer; interval: 250; onTriggered: root.grabToImage(function(r){ r.saveToFile("/home/deluxescout/CityLive/desktop/almanac-kde.png"); console.log("GRABBED_KDE"); Qt.quit(); }); }
}
