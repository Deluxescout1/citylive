import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import QtQuick.LocalStorage
import org.kde.kirigami as Kirigami
import "../js/city.js" as City   // the real engine (its own instance here; no .pragma library) — for the read-only Almanac

ColumnLayout {
    id: cfgRoot
    property bool almReady: false
    property string cfg_scene: "metro"
    property real cfg_latitude: 999
    property real cfg_longitude: 999
    property string cfg_locationName: ""
    property string cfg_finale: "auto"
    property real cfg_worldRestartAt: 0
    property string cfg_worldRestartMode: "apoc"
    property bool cfg_flights: true
    property bool cfg_bills: false
    property string cfg_quality: ""
    property bool cfg_showStatus: true
    property bool cfg_notifyEvents: true
    property bool cfg_chronicleEnabled: true
    property string chronicleText: i18n("No witnessed events yet. Leave CityLive running and its story will appear here.")
    property bool chronicleClearArmed: false

    function refreshChronicle() {
        try {
            var db = LocalStorage.openDatabaseSync("CityLiveChronicle", "1.0", "Witnessed CityLive history", 1048576), lines=[];
            db.transaction(function(tx) {
                tx.executeSql("CREATE TABLE IF NOT EXISTS events (life INTEGER, city TEXT, era TEXT, at INTEGER, event_key TEXT, kind TEXT, title TEXT, detail TEXT, stage TEXT, people TEXT, UNIQUE(life,event_key))");
                var rs=tx.executeSql("SELECT * FROM events ORDER BY at DESC LIMIT 100");
                for(var i=0;i<rs.rows.length;i++){ var e=rs.rows.item(i), d=new Date(e.at);
                    lines.push("<b>"+e.city+" · "+e.title+"</b><br><font color='#93a2c0'>"+d.toLocaleString()+" · "+e.stage+"<br>"+e.detail+"</font>"); }
            });
            chronicleText=lines.length?lines.join("<br><br>"):i18n("No witnessed events yet. Leave CityLive running and its story will appear here.");
        } catch(e) { chronicleText=i18n("Chronicle unavailable: %1",e); }
    }
    function clearChronicle() { try { var db=LocalStorage.openDatabaseSync("CityLiveChronicle","1.0","Witnessed CityLive history",1048576);db.transaction(function(tx){tx.executeSql("DELETE FROM events");});refreshChronicle(); } catch(e){} }

    // Friendly name -> engine name for the finale picker (first 9 in the order DEATHS
    // cycles them in city.js; kaijuwar/pollution are picker-only fates appended after).
    readonly property var finaleChoices: [
        { text: i18n("Auto (a different fate each life)"), value: "auto" },
        { text: i18n("Meteor Storm"), value: "meteors" },
        { text: i18n("Nuclear Strike"), value: "nuke" },
        { text: i18n("Solar Flare"), value: "sunburst" },
        { text: i18n("AI Uprising"), value: "ai" },
        { text: i18n("Black Hole"), value: "bh" },
        { text: i18n("Alien War"), value: "alienwar" },
        { text: i18n("Deep Freeze"), value: "frost" },
        { text: i18n("Kaiju Attack"), value: "kaiju" },
        { text: i18n("Great Flood"), value: "flood" },
        { text: i18n("Godzilla vs Kong"), value: "kaijuwar" },
        { text: i18n("Pollution"), value: "pollution" },
        { text: i18n("Moonfall"), value: "moonfall" }
    ]

    // Reflects the current cfg_locationName / lookup state into locStatus.text.
    // Managed entirely imperatively (not a declarative binding) so both user edits
    // and lookup results can update it without fighting each other.
    function setStatus(text, isError) {
        locStatus.text = text || "";
        locStatus.isError = !!isError;
    }

    // City Almanac — a read-only snapshot from the real engine. NOFETCH makes setup() do NO network
    // calls, and we never call draw(), so this is pure clock-state (no canvas, no timers). This config
    // file gets its own City instance (JS imports aren't shared without .pragma library), so bringing
    // the engine up here never disturbs the running wallpaper.
    function refreshAlmanac() {
        try {
            City.NOFETCH = true;
            if (!cfgRoot.almReady) {
                City.setup("neon", { cw: 853, ch: 480, woff: 0, ww: 2269, pxk: 3, zoom: 1, quality: "spectacle" });
                cfgRoot.almReady = true;
            }
            var A = City.almanacData(Date.now());
            // Keep dynamic numbers/percent OUT of i18n placeholders (a bare '%' after a placeholder can
            // trip ki18n's escaping) — translate the static labels, concatenate the data plainly.
            var econ = A.economy >= 60 ? i18n("Boom") : (A.economy <= 40 ? i18n("Bust") : i18n("Steady"));
            var lead = A.regime ? (A.regime.leader + " — " + A.regime.label)
                     : (A.mayor ? (A.mayor.name + " (" + A.mayor.party + ")") : i18n("No government"));
            var s = "<b>" + A.cityName + "</b> &mdash; " + i18n("home of the %1", A.teamName) + "<br>"
                  + i18n("Incarnation") + " No. " + A.life + " · " + A.era + " · " + A.phase + " (" + A.growthPct + "%)<br>"
                  + i18n("Population") + ": <b>" + City.popFmt(A.population) + "</b> &nbsp; "
                  + i18n("Economy") + ": " + econ + "<br>"
                  + i18n("Leadership") + ": " + (A.regime ? "<font color='#e0555f'>" + lead + "</font>" : lead) + "<br>"
                  + i18n("Fated end") + ": " + A.fate;
            if (A.fateAt) {
                var fd = new Date(A.fateAt), fh = fd.getHours(), fh12 = (fh % 12) || 12, fap = fh < 12 ? "AM" : "PM", fmm = fd.getMinutes();
                var DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                var when = DOW[fd.getDay()] + " " + MON[fd.getMonth()] + " " + fd.getDate() + ", " + fh12 + ":" + (fmm < 10 ? "0" : "") + fmm + " " + fap;
                var dt = A.fateInMs, mins = Math.floor(dt / 60000), cd = mins >= 1440 ? ("in " + Math.floor(mins / 1440) + "d " + Math.floor((mins % 1440) / 60) + "h")
                        : mins >= 60 ? ("in " + Math.floor(mins / 60) + "h " + (mins % 60) + "m") : mins >= 1 ? ("in " + mins + " min") : i18n("any moment");
                s += "<br>" + i18n("Cataclysm strikes") + ": <font color='#e0a24a'>" + when + " · " + cd + "</font>";
            }
            if (A.landmarks && A.landmarks.length) s += "<br>" + i18n("Landmarks") + ": " + A.landmarks.join(" · ");
            if (A.space && (A.space.agePct > 0 || (A.space.colonies && A.space.colonies.length))) {
                s += "<br><font color='#7ad0ff'>" + i18n("Space age") + ": " + A.space.agePct + "%";
                if (A.space.colonies && A.space.colonies.length) {
                    var cc = [];
                    for (var si = 0; si < A.space.colonies.length; si++) cc.push(A.space.colonies[si].body + " " + A.space.colonies[si].pct + "%");
                    s += " &nbsp; " + i18n("Off-world") + ": " + cc.join(" · ");
                }
                s += "</font>";
            }
            if (A.history && A.history.length) {
                s += "<br><br><b>" + i18n("Past civilizations") + "</b>";
                for (var i = 0; i < A.history.length; i++) {
                    var e = A.history[i];
                    s += "<br>" + i18n("Life") + " " + e.life + " · " + e.era + " — " + i18n("fell to %1", e.fate);
                }
            }
            almanacLabel.text = s;
        } catch (err) {
            almanacLabel.text = i18n("Almanac unavailable: %1", err);
        }
    }
    Component.onCompleted: { refreshAlmanac(); refreshChronicle(); }

    Kirigami.FormLayout {
        Layout.fillWidth: true

        QQC2.ComboBox {
            Kirigami.FormData.label: i18n("City scene:")
            model: [
                { text: "Metropolis (classic skyline)", value: "metro" },
                { text: "Neon City (cyberpunk)", value: "neon" },
                { text: "Harbor Town (waterfront)", value: "harbor" }
            ]
            textRole: "text"
            valueRole: "value"
            currentIndex: Math.max(0, indexOfValue(cfgRoot.cfg_scene))
            onActivated: cfgRoot.cfg_scene = currentValue
            Component.onCompleted: currentIndex = Math.max(0, indexOfValue(cfgRoot.cfg_scene))
        }

        QQC2.ComboBox {
            Kirigami.FormData.label: i18n("Render quality:")
            model: [
                { text: i18n("Automatic (recommended)"), value: "" },
                { text: i18n("Spectacle — maximum detail"), value: "spectacle" },
                { text: i18n("Balanced — detail and efficiency"), value: "balanced" },
                { text: i18n("Performance — battery friendly"), value: "performance" }
            ]
            textRole: "text"
            valueRole: "value"
            currentIndex: Math.max(0, indexOfValue(cfgRoot.cfg_quality))
            onActivated: cfgRoot.cfg_quality = currentValue
            Component.onCompleted: currentIndex = Math.max(0, indexOfValue(cfgRoot.cfg_quality))
        }

        QQC2.CheckBox {
            Kirigami.FormData.label: i18n("City status:")
            text: i18n("Show the compact “What’s happening?” panel")
            checked: cfgRoot.cfg_showStatus
            onToggled: cfgRoot.cfg_showStatus = checked
        }

        QQC2.CheckBox {
            Kirigami.FormData.label: i18n("Notifications:")
            text: i18n("Notify me of major city events (elections, big disasters, takeovers, eclipses)")
            checked: cfgRoot.cfg_notifyEvents
            onToggled: cfgRoot.cfg_notifyEvents = checked
        }

        Kirigami.Separator {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: i18n("City Chronicle")
        }
        QQC2.CheckBox {
            Kirigami.FormData.label: i18n("History recording:")
            text: i18n("Record only events witnessed while CityLive is running")
            checked: cfgRoot.cfg_chronicleEnabled
            onToggled: cfgRoot.cfg_chronicleEnabled = checked
        }
        QQC2.Label {
            Kirigami.FormData.label: i18n("Witnessed history:")
            Layout.fillWidth: true
            wrapMode: Text.WordWrap
            textFormat: Text.RichText
            text: cfgRoot.chronicleText
        }
        RowLayout {
            Kirigami.FormData.label: " "
            QQC2.Button { text: i18n("Refresh"); onClicked: cfgRoot.refreshChronicle() }
            QQC2.Button { text: cfgRoot.chronicleClearArmed ? i18n("Click again to confirm") : i18n("Clear history"); onClicked: { if(cfgRoot.chronicleClearArmed){cfgRoot.clearChronicle();cfgRoot.chronicleClearArmed=false;}else{cfgRoot.chronicleClearArmed=true;clearArmTimer.restart();} } }
        }
        Timer { id: clearArmTimer; interval: 5000; onTriggered: cfgRoot.chronicleClearArmed=false }

        Kirigami.Separator {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: i18n("Location")
        }

        QQC2.Label {
            Kirigami.FormData.label: " "
            Layout.fillWidth: true
            wrapMode: Text.WordWrap
            opacity: 0.7
            font.pointSize: Kirigami.Theme.smallFont.pointSize
            text: i18n("Drives the sun, moon, sunrise/sunset, daylight and weather. 999 = unset — falls back to config.local.json, or the built-in default (Norwich, CT).")
        }

        RowLayout {
            Kirigami.FormData.label: i18n("Find a place:")
            QQC2.TextField {
                id: locQuery
                Layout.preferredWidth: Kirigami.Units.gridUnit * 14
                placeholderText: i18n("City, ZIP code, or address")
                onAccepted: locLookupBtn.clicked()
            }
            QQC2.Button {
                id: locLookupBtn
                text: i18n("Look up")
                enabled: locQuery.text.trim().length > 0 && !locBusy.running
                onClicked: {
                    cfgRoot.setStatus(i18n("Looking up…"), false);
                    locResults.clear();
                    locBusy.running = true;

                    var xhr = new XMLHttpRequest();
                    var url = "https://geocoding-api.open-meteo.com/v1/search?name="
                        + encodeURIComponent(locQuery.text.trim()) + "&count=5&language=en&format=json";
                    xhr.onreadystatechange = function() {
                        if (xhr.readyState !== XMLHttpRequest.DONE) return;
                        locBusy.running = false;
                        try {
                            if (xhr.status !== 200) {
                                cfgRoot.setStatus(i18n("Lookup failed — check your internet connection and try again"), true);
                                return;
                            }
                            var data = JSON.parse(xhr.responseText);
                            var list = (data && data.results) ? data.results : [];
                            if (list.length === 0) {
                                cfgRoot.setStatus(i18n("No matches — try a nearby city name"), true);
                                return;
                            }
                            for (var i = 0; i < list.length && i < 5; i++) {
                                var r = list[i];
                                var label = [r.name, r.admin1, r.country].filter(function(s){ return !!s; }).join(", ");
                                var shortName = r.admin1 ? (r.name + ", " + r.admin1) : r.name;
                                locResults.append({ label: label, shortName: shortName, lat: r.latitude, lon: r.longitude });
                            }
                            cfgRoot.setStatus("", false);
                        } catch (e) {
                            cfgRoot.setStatus(i18n("Lookup failed — check your internet connection and try again"), true);
                        }
                    };
                    xhr.onerror = function() {
                        locBusy.running = false;
                        cfgRoot.setStatus(i18n("Lookup failed — check your internet connection and try again"), true);
                    };
                    xhr.open("GET", url);
                    xhr.send();
                }
            }
            QQC2.BusyIndicator {
                id: locBusy
                running: false
                visible: running
                implicitWidth: Kirigami.Units.iconSizes.small
                implicitHeight: Kirigami.Units.iconSizes.small
            }
        }

        ListModel { id: locResults }

        ColumnLayout {
            Kirigami.FormData.label: " "
            visible: locResults.count > 0
            Repeater {
                model: locResults
                delegate: QQC2.Button {
                    Layout.fillWidth: true
                    text: model.label
                    onClicked: {
                        cfgRoot.cfg_latitude = model.lat;
                        cfgRoot.cfg_longitude = model.lon;
                        cfgRoot.cfg_locationName = model.shortName;
                        latField.text = model.lat.toString();
                        lonField.text = model.lon.toString();
                        cfgRoot.setStatus(i18n("Using: %1", model.shortName), false);
                        locResults.clear();
                        locQuery.text = "";
                    }
                }
            }
        }

        QQC2.Label {
            id: locStatus
            Kirigami.FormData.label: " "
            property bool isError: false
            Layout.fillWidth: true
            wrapMode: Text.WordWrap
            color: isError ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.disabledTextColor
            Component.onCompleted: {
                if (cfgRoot.cfg_locationName.length > 0)
                    cfgRoot.setStatus(i18n("Using: %1", cfgRoot.cfg_locationName), false);
            }
        }

        QQC2.TextField {
            id: latField
            Kirigami.FormData.label: i18n("Latitude (advanced):")
            Layout.preferredWidth: Kirigami.Units.gridUnit * 8
            text: cfgRoot.cfg_latitude.toString()
            validator: DoubleValidator { bottom: -90; top: 90; decimals: 6 }
            onEditingFinished: {
                var v = parseFloat(text);
                if (!isNaN(v) && v >= -90 && v <= 90) {
                    cfgRoot.cfg_latitude = v;
                    cfgRoot.cfg_locationName = "";   // manual entry no longer matches any picked place
                    cfgRoot.setStatus("", false);
                }
            }
        }
        QQC2.TextField {
            id: lonField
            Kirigami.FormData.label: i18n("Longitude (advanced):")
            Layout.preferredWidth: Kirigami.Units.gridUnit * 8
            text: cfgRoot.cfg_longitude.toString()
            validator: DoubleValidator { bottom: -180; top: 180; decimals: 6 }
            onEditingFinished: {
                var v = parseFloat(text);
                if (!isNaN(v) && v >= -180 && v <= 180) {
                    cfgRoot.cfg_longitude = v;
                    cfgRoot.cfg_locationName = "";
                    cfgRoot.setStatus("", false);
                }
            }
        }

        QQC2.Button {
            Kirigami.FormData.label: " "
            text: i18n("Use default")
            onClicked: {
                cfgRoot.cfg_latitude = 999;
                cfgRoot.cfg_longitude = 999;
                cfgRoot.cfg_locationName = "";
                latField.text = "999";
                lonField.text = "999";
                locQuery.text = "";
                locResults.clear();
                cfgRoot.setStatus("", false);
            }
        }

        Kirigami.Separator {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: i18n("World")
        }

        QQC2.ComboBox {
            id: finaleCombo
            Kirigami.FormData.label: i18n("World ends by:")
            model: cfgRoot.finaleChoices
            textRole: "text"
            valueRole: "value"
            currentIndex: Math.max(0, indexOfValue(cfgRoot.cfg_finale))
            onActivated: cfgRoot.cfg_finale = currentValue
            Component.onCompleted: currentIndex = Math.max(0, indexOfValue(cfgRoot.cfg_finale))
        }

        RowLayout {
            Kirigami.FormData.label: i18n("Right now:")
            QQC2.Button {
                text: i18n("☄ End the world now")
                onClicked: {
                    cfgRoot.cfg_worldRestartAt = Date.now();
                    cfgRoot.cfg_worldRestartMode = "apoc";
                    worldNote.text = i18n("The end is nigh… takes effect when you click Apply");
                }
            }
            QQC2.Button {
                text: i18n("🌱 Start a fresh world")
                onClicked: {
                    cfgRoot.cfg_worldRestartAt = Date.now();
                    cfgRoot.cfg_worldRestartMode = "fresh";
                    worldNote.text = i18n("A new world begins… takes effect when you click Apply");
                }
            }
        }

        QQC2.Label {
            id: worldNote
            Kirigami.FormData.label: " "
            Layout.fillWidth: true
            wrapMode: Text.WordWrap
            opacity: 0.7
            font.pointSize: Kirigami.Theme.smallFont.pointSize
            text: ""
        }

        Kirigami.Separator {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: i18n("Sky")
        }

        QQC2.CheckBox {
            Kirigami.FormData.label: i18n("Live flights:")
            text: i18n("Show real aircraft near your location")
            checked: cfgRoot.cfg_flights
            onToggled: cfgRoot.cfg_flights = checked
        }

        QQC2.CheckBox {
            Kirigami.FormData.label: i18n("Buffalo Bills:")
            text: i18n("Gameday takeover when the Bills are really playing")
            checked: cfgRoot.cfg_bills
            onToggled: cfgRoot.cfg_bills = checked
        }

        QQC2.Label {
            Kirigami.FormData.label: " "
            Layout.fillWidth: true
            Layout.preferredWidth: Kirigami.Units.gridUnit * 22
            wrapMode: Text.WordWrap
            opacity: 0.7
            font.pointSize: Kirigami.Theme.smallFont.pointSize
            text: i18n("When the real Buffalo Bills are playing a live game, the whole city turns into Bills Mafia — the citizens don team colours and every sign, billboard and jumbotron rallies the Bills. Off outside of live games. Uses the same free ESPN scoreboard feed as the stadium scoreboards.")
        }

        QQC2.Label {
            Kirigami.FormData.label: " "
            Layout.fillWidth: true
            Layout.preferredWidth: Kirigami.Units.gridUnit * 22
            wrapMode: Text.WordWrap
            opacity: 0.7
            font.pointSize: Kirigami.Theme.smallFont.pointSize
            text: i18n("Real planes overhead, from a free flight-tracking feed (refreshed about every 90 seconds), drawn at their true bearing with a callsign tag on the closest pass. Turn off to keep only the decorative jets — it calls a public API with your area's coordinates.")
        }

        Kirigami.Separator {
            Kirigami.FormData.isSection: true
            Kirigami.FormData.label: i18n("City Almanac")
        }

        QQC2.Label {
            Kirigami.FormData.label: i18n("Version:")
            text: "CityLive v" + (typeof City !== "undefined" && City.VERSION ? City.VERSION : "?")
            font.bold: true
        }

        QQC2.Label {
            id: almanacLabel
            Kirigami.FormData.label: " "
            Layout.fillWidth: true
            Layout.preferredWidth: Kirigami.Units.gridUnit * 22
            wrapMode: Text.WordWrap
            textFormat: Text.RichText
            lineHeight: 1.2
            font.pointSize: Kirigami.Theme.smallFont.pointSize
            text: i18n("Loading…")
        }

        QQC2.Button {
            Kirigami.FormData.label: " "
            text: i18n("↻ Refresh almanac")
            onClicked: cfgRoot.refreshAlmanac()
        }
    }

    Item { Layout.fillHeight: true }
}
