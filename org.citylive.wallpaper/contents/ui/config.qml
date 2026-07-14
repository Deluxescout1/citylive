import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami

ColumnLayout {
    id: cfgRoot
    property string cfg_scene: "metro"

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
    }
    Item { Layout.fillHeight: true }
}
