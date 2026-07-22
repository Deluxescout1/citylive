import QtQuick
import org.kde.notification

// Desktop notifications for major city events. Lives behind a Loader in main.qml so a system
// without org.kde.notification just fails THIS loader and the wallpaper carries on unharmed.
Item {
    Notification {
        id: n
        componentName: "plasma_workspace"
        eventId: "notification"
        autoDelete: true
        flags: Notification.CloseOnTimeout
    }
    function fire(title, body) {
        n.title = title;
        n.text = body || "";
        n.sendEvent();
    }
}
