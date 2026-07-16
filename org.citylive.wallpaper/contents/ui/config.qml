import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

ColumnLayout {
    id: cfgRoot
    property string cfg_scene: "metro"
    property real cfg_latitude: 999
    property real cfg_longitude: 999
    property string cfg_locationName: ""
    property string cfg_finale: "auto"
    property real cfg_worldRestartAt: 0
    property string cfg_worldRestartMode: "apoc"

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
        { text: i18n("Pollution"), value: "pollution" }
    ]

    // Reflects the current cfg_locationName / lookup state into locStatus.text.
    // Managed entirely imperatively (not a declarative binding) so both user edits
    // and lookup results can update it without fighting each other.
    function setStatus(text, isError) {
        locStatus.text = text || "";
        locStatus.isError = !!isError;
    }

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
    }

    Item { Layout.fillHeight: true }
}
