import QtQuick
import QtQuick.LocalStorage

Item {
    Component.onCompleted: {
        try {
            var db=LocalStorage.openDatabaseSync("CityLiveChronicleSmoke","1.0","Chronicle smoke",65536), count=0;
            db.transaction(function(tx){
                tx.executeSql("CREATE TABLE IF NOT EXISTS events (life INTEGER, event_key TEXT, UNIQUE(life,event_key))");
                tx.executeSql("DELETE FROM events");
                tx.executeSql("INSERT OR IGNORE INTO events VALUES (?,?)",[1,"election:campaign"]);
                tx.executeSql("INSERT OR IGNORE INTO events VALUES (?,?)",[1,"election:campaign"]);
                count=tx.executeSql("SELECT COUNT(*) AS n FROM events").rows.item(0).n;
            });
            console.log(count===1?"CHRONICLE_QML_OK":"CHRONICLE_QML_FAIL count="+count);
        } catch(e) { console.log("CHRONICLE_QML_FAIL "+e); }
        Qt.quit();
    }
}
