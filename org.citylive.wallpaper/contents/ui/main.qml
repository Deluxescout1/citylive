import QtQuick
import QtQuick.Window
import QtQuick.LocalStorage
import org.kde.plasma.plasmoid
import "../js/city.js" as City
import "../js/localcfg.js" as Local   // per-machine personal settings (birthdays/location/cycle); committed EMPTY, filled by install.sh from config.local.json

WallpaperItem {
    id: root

    readonly property string scene: (configuration && configuration.scene) ? configuration.scene : "neon"
    property bool cfgApplied: false   // local personal config (birthdays/location/cycle) is injected once, at first boot
    property string renderError: ""
    property string lastChronicleKey: ""
    readonly property bool chronicleEnabled: !configuration || configuration.chronicleEnabled === undefined || configuration.chronicleEnabled
    // QUALITY tier: spectacle (full 12fps everything) / balanced / performance (8fps, thinner
    // effects — laptop & battery friendly). Config override, else auto by total canvas load.
    readonly property string quality: {
        if (configuration && configuration.quality) return configuration.quality;
        return (width * height > 2200000) ? "balanced" : "spectacle";
    }
    // DEVICE px per world/canvas pixel. Keep the original wide pxk3 composition in every quality
    // tier; performance comes from retained layers and scheduling, never by zooming the city in.
    readonly property int pxk: 3
    // This screen's device-pixel ratio (fractional display scaling, e.g. 1.1 at 110%). ALL world
    // geometry below is in DEVICE pixels: with fractional scaling Qt rasterizes the scene at device
    // resolution, so only a device-integer canvas scale avoids duplicated-pixel seam lines.
    readonly property real dpr: (Screen.devicePixelRatio > 0) ? Screen.devicePixelRatio : 1
    // Integer HiDPI (notably this desktop's exact 2x center display) can use the normal chunky
    // texels without resampling. Only a genuinely fractional DPR needs the fine-texture defense.
    // Treating every DPR != 1 as fractional made the 2x screen render ~3.05M canvas pixels instead
    // of ~1.36M, then smooth them unnecessarily—enough to pin plasmashell on a three-screen setup.
    readonly property bool fractionalDpr: Math.abs(dpr - Math.round(dpr)) > 0.01
    // buffer px per canvas pixel: pxk logical px worth, rounded to an INTEGER number of buffer
    // px (Qt rasterizes at dpr x logical). Integer -> no duplicated-pixel seams; ~pxk logical
    // -> the city has the SAME apparent size on every screen regardless of display scaling.
    // On fractionally-scaled screens plasmashell renders integer-2x and KWin downsamples to the
    // output (e.g. 1.65x) — that resample drops buffer columns in a periodic cadence, which
    // stripes chunky pixel blocks (verified with a comb test pattern). Defense: render FINE
    // texels there (texelBuf buffer px per canvas px) and draw the world at ZOOM canvas px per
    // world px — a dropped column then costs a sliver of a feature, like any native-res window.
    readonly property real texelBuf: fractionalDpr ? 2 : pxk
    readonly property int zoom: Math.max(1, Math.round(pxk * dpr / texelBuf))
    // total width (logical px) of the whole desktop the city spans. If unset in config,
    // auto-detect by summing every screen's width (works for a single laptop screen or
    // horizontally-arranged monitors) so the plugin is plug-and-play on any machine.
    readonly property real worldWidthPx: {
        if (configuration && configuration.worldW > 0) return configuration.worldW;
        var s = Qt.application.screens, tot = 0;
        if (s) for (var i = 0; i < s.length; i++) tot += s[i].width;
        return tot > 0 ? tot : width;
    }
    readonly property real worldLeftPx: (configuration && configuration.worldX >= 0) ? configuration.worldX : Screen.virtualX

    // height (logical px) of the panel/taskbar reserved at the BOTTOM of this screen, read
    // from Plasma's own available-screen rect (Wayland hides panels from plain Qt clients, but
    // plasmashell knows). Reactive: if the panel is resized/moved, this re-evaluates. 0 if
    // unreachable → the engine falls back to its constant foreground depth.
    readonly property int panelBottomPx: {
        if (configuration && configuration.taskbarPx >= 0) return configuration.taskbarPx;   // manual override
        var r;
        try { r = Plasmoid.availableScreenRect; } catch (e) { return 0; }
        if (r && r.width > 0 && r.height > 0 && root.height > 0)
            return Math.max(0, Math.round(root.height - (r.y + r.height)));
        return 0;
    }

    Rectangle { anchors.fill: parent; color: "black" }

    // TWO CANVASES per screen. Seven (× 3 monitors = 21 full-screen FBOs) measured far worse than
    // one — the compositing overhead swamped the JS it saved. But one canvas repaints the entire
    // scene at the motion frame rate, and the static backdrop (sky, stars, mountains, still
    // terrain) is ~60% of that cost while changing barely at all. So: one slow backdrop canvas
    // plus one live canvas on top. Two FBOs stays comfortably inside the compositing budget while
    // cutting most of the redundant work. "bg" + "live" are exact complements — verified by
    // partitioning every draw function across the two passes.
    Canvas {
        id: bgcv
        z: 0
        width: cv.width; height: cv.height
        smooth: cv.smooth
        antialiasing: false
        renderTarget: Canvas.FramebufferObject
        renderStrategy: Canvas.Threaded
        transformOrigin: Item.TopLeft
        scale: root.texelBuf / root.dpr
        onPaint: {
            try { City.draw(getContext("2d"), "bg"); }
            catch (e) { root.renderError = "Backdrop: " + e; console.error("CityLive backdrop render failure: " + e); }
        }
    }

    Canvas {
        id: cv
        z: 1
        // one canvas per screen, sized to THIS screen's aspect ratio (all fed from one world)
        // ceil + DEVICE-integer scale: the canvas may overshoot the screen by a few px (clipped),
        // but every canvas pixel maps to EXACTLY pxk DEVICE px. Anything fractional (from display
        // scaling, e.g. 110% -> 4.4 device px per canvas px) makes nearest-neighbour upscaling
        // duplicate rows/columns -> seam lines striping the whole screen.
        width: Math.max(8, root.zoom * Math.ceil(root.width * root.dpr / (root.texelBuf * root.zoom)))
        height: Math.max(8, root.zoom * Math.ceil(root.height * root.dpr / (root.texelBuf * root.zoom)))
        // crisp nearest upscale on integer-scale screens; LINEAR on fractionally-scaled ones —
        // KWin downsamples those (Qt renders 2x, output is e.g. 1.65x) with unfiltered sampling,
        // and nearest+nearest makes periodic dropped-column beat lines stripe the whole screen.
        // The linear ramp (~1 physical px) absorbs the dropped columns; verified on the 4K@165%.
        // Crisp NEAREST at dpr 1; LINEAR wherever Qt renders larger than 1:1.
        // `fractionalDpr` alone is NOT enough to catch the striping: on a 4K at 165% Plasma renders
        // at an INTEGER 2x and KWin downsamples 2x -> 1.65x itself, so Qt reports devicePixelRatio
        // exactly 2 and the fractional test is false — precisely on the screen that stripes. Nothing
        // QML exposes reveals that downsample (pixelDensity/logicalPixelDensity ratio reads 1.0036).
        // What it does reveal is dpr > 1, and that is the case that upscales the canvas ~3x into the
        // buffer with hard pixel blocks; KWin's non-integer resample then keeps 5 of every 6 columns
        // and the dropped columns beat into visible vertical lines. A linear ramp over those ~3 buffer
        // px absorbs the resample. Costs nothing (texture filtering only — unlike the fine-texel
        // defense below, which would render 2.2x the canvas pixels).
        smooth: root.fractionalDpr || root.dpr > 1
        antialiasing: false  // crisp pixel edges; the ridge is batched fillRects, not an AA path
        renderTarget: Canvas.FramebufferObject
        // Keep JavaScript painting off Plasma's GUI thread so a slow scenery refresh cannot
        // stall pointer movement, panels, or the foreground animation.
        renderStrategy: Canvas.Threaded
        transformOrigin: Item.TopLeft
        scale: root.texelBuf / root.dpr

        onPaint: {
            var g = getContext("2d");
            try { City.draw(g, "live"); }
            catch (e) { root.renderError = "Render: " + e; console.error("CityLive render failure: " + e); }
        }
    }

    Rectangle {
        visible: root.renderError.length > 0
        anchors.right: parent.right; anchors.top: parent.top; anchors.margins: 12
        width: Math.min(520, errorText.implicitWidth + 20); height: errorText.implicitHeight + 14
        radius: 8; color: "#ed5c0d18"; border.color: "#e65b6d"
        Text { id: errorText; anchors.fill: parent; anchors.margins: 7; color: "#ffe8e8"; font.pixelSize: 11; wrapMode: Text.Wrap; text: "CityLive recovered from a render error: " + root.renderError }
    }

    // SINGLE TIMER — drives the one canvas. Frame rate scales with quality tier.
    // The old multi-canvas version had 6 timers polling at different intervals, causing
    // overlapping paint storms. One timer = one predictable paint cadence.
    // Each screen keeps its OWN free-running timer rather than polling a shared wall-clock slot.
    // A shared slot lines the monitors up on the same world instant (nice for a car crossing a
    // seam) but it also fires all of them on the SAME millisecond, so three full-screen paints
    // land together and the desktop stutters in bursts. Independent timers drift a frame apart —
    // invisible at these speeds — and spread the load across the interval instead.
    readonly property int frameMs: quality === "performance" ? 500 : (quality === "balanced" ? 200 : 83)
    Timer {
        interval: root.frameMs
        running: root.visible
        repeat: true
        onTriggered: cv.requestPaint()
    }

    // The backdrop only has to keep up with the sun, the weather and the seasons, so it repaints
    // about once a second instead of twelve times. This is where the saving actually comes from.
    Timer {
        interval: root.quality === "performance" ? 4000 : (root.quality === "balanced" ? 2000 : 1000)
        running: root.visible
        repeat: true
        onTriggered: bgcv.requestPaint()
    }

    Timer {
        interval: 1000; running: root.visible; repeat: true
        onTriggered: {
            try {
                var w = City.chronicleSnapshot(Date.now());
                if (root.chronicleEnabled && w && w.recordable && w.eventKey !== root.lastChronicleKey) {
                    root.recordChronicle(w); root.lastChronicleKey = w.eventKey;
                }
            } catch (e) { root.renderError = "Status: " + e; console.error("CityLive status failure: " + e); }
        }
    }

    function recordChronicle(w) {
        var db = LocalStorage.openDatabaseSync("CityLiveChronicle", "1.0", "Witnessed CityLive history", 1048576);
        db.transaction(function(tx) {
            tx.executeSql("CREATE TABLE IF NOT EXISTS events (life INTEGER, city TEXT, era TEXT, at INTEGER, event_key TEXT, kind TEXT, title TEXT, detail TEXT, stage TEXT, people TEXT, UNIQUE(life,event_key))");
            tx.executeSql("INSERT OR IGNORE INTO events VALUES (?,?,?,?,?,?,?,?,?,?)", [w.life,w.cityName,w.era,w.at,w.eventKey,w.kind,w.title,w.detail,w.stage,JSON.stringify(w.people||[])]);
            tx.executeSql("DELETE FROM events WHERE life NOT IN (SELECT life FROM events GROUP BY life ORDER BY life DESC LIMIT 25)");
        });
    }

    function boot() {
        // ignore the transient boots during screen bring-up (dimensions not settled yet)
        if (root.width < 8 || root.height < 8 || cv.width < 8 || cv.height < 8 || bgcv.width < 8 || bgcv.height < 8)
            return;
        // Inject personal settings (birthdays/location/cycle) from localcfg.js — committed EMPTY in the public
        // repo, filled on THIS machine by install.sh from the gitignored config.local.json. Absent/empty → no
        // birthdays (a fresh clone stays clean). Done once, before the first setup.
        if (!root.cfgApplied) {
            root.cfgApplied = true;
            try { if (Local && Local.CONFIG) City.applyConfig(Local.CONFIG); } catch (e) { /* empty → shared defaults */ }
        }
        // LOCATION from the wallpaper-config dialog (System Settings → Wallpaper → CityLive).
        // Precedence: config-dialog location > config.local.json location > engine default.
        // 999 = "unset" (the dialog's default), so a fresh install never overrides the bake.
        // Applied every boot (not once): the user can change it live from the dialog, and
        // applyConfig re-derives the architecture region + weather/sky for the new place.
        try {
            if (configuration && configuration.latitude !== undefined &&
                configuration.latitude >= -90 && configuration.latitude <= 90 &&
                configuration.longitude >= -180 && configuration.longitude <= 180) {
                City.applyConfig({ lat: configuration.latitude, lon: configuration.longitude });
            }
        } catch (e) { /* invalid/unset → keep the baked or default location */ }
        // FINALE pin + "end the world now"/"start a fresh world" request from the config
        // dialog. worldRestartAt > 0 means the user clicked one of those buttons; applied
        // every boot so re-clicking (a fresh timestamp) fires again.
        try {
            if (configuration && configuration.finale !== undefined) {
                City.applyConfig({ finale: configuration.finale });
            }
            if (configuration && configuration.worldRestartAt > 0) {
                City.applyConfig({ worldRestartAt: configuration.worldRestartAt, worldRestartMode: configuration.worldRestartMode });
            }
        } catch (e) { /* invalid/unset → keep the current finale/world state */ }
        // LIVE FLIGHTS on/off from the config dialog (real aircraft overlay). Applied every boot.
        try {
            if (configuration && configuration.flights !== undefined) {
                City.applyConfig({ flights: configuration.flights });
            }
            // bills: EITHER source enables it — the config-dialog checkbox OR config.local.json.
            // (Only turn ON here; a false dialog default must not clobber a config.local.json bills:true.)
            if (configuration && configuration.bills) {
                City.applyConfig({ bills: true });
            }
        } catch (e) { /* unset → engine default (on) */ }
        City.setup(root.scene, {
            cw:   cv.width,
            ch:   cv.height,
            woff: Math.round(root.worldLeftPx / root.pxk),        // this screen's left edge, in world px
            ww:   Math.round(root.worldWidthPx / root.pxk),       // whole city width, in world px
            taskbarWp: Math.ceil(root.panelBottomPx / root.pxk),  // keep the road above the taskbar
            pxk:  root.pxk,                                       // resolution → city.js KSP scale
            zoom: root.zoom,                                      // canvas px per world px on this screen
            quality: root.quality                                 // effect-density tier
        });
        bgcv.requestPaint();
        cv.requestPaint();
        console.log("CityLive screen located: virtualX=" + Screen.virtualX + " " + root.width + "x" + root.height
                    + " dpr=" + root.dpr + " zoom=" + root.zoom + " -> woff=" + Math.round(root.worldLeftPx / root.pxk) + "wp " + cv.width + "x" + cv.height
                    + " panelBottom=" + root.panelBottomPx + "px (" + Math.ceil(root.panelBottomPx / root.pxk) + "wp)");
    }

    // debounce the flurry of width/height/x changes at bring-up into one setup
    Timer { id: bootTimer; interval: 60; onTriggered: root.boot() }

    // NOTIFICATIONS (Nick): ~1/min, only when something of SUBSTANCE is on screen. Engine probe is
    // pure; this screen dedupes by the stable event key. ONLY the leftmost screen notifies (one
    // desktop = one notification, not one per monitor). Toggle: wallpaper config → notifyEvents.
    Loader { id: notifier; source: "Notifier.qml"; asynchronous: true }
    Timer {
        interval: 60000; repeat: true
        running: root.visible && configuration.notifyEvents && root.worldLeftPx === 0 && notifier.status === Loader.Ready
        property string lastKey: ""
        onTriggered: {
            try {
                var n = City.notifySnapshot(Date.now());
                if (n && n.key && n.key !== lastKey) {
                    lastKey = n.key;
                    notifier.item.fire("CityLive — " + n.title, n.body || "");
                }
            } catch (e) { /* the notifier must never hurt the wallpaper */ }
        }
    }
    // one-shot SETTLE pass: 6s after bring-up, re-run setup + repaint — shakes out any
    // transient geometry/scale state from login/output reconfiguration (stripe insurance)
    Timer { id: settleTimer; interval: 6000; running: true; onTriggered: { root.boot(); bgcv.requestPaint(); cv.requestPaint() } }
    Component.onCompleted: bootTimer.restart()
    onSceneChanged: bootTimer.restart()
    // location changed in the config dialog → re-boot with the new place (weather/sun/stars/architecture)
    Connections {
        target: configuration
        ignoreUnknownSignals: true
        function onLatitudeChanged(){ bootTimer.restart() }
        function onLongitudeChanged(){ bootTimer.restart() }
        function onFinaleChanged(){ bootTimer.restart() }
        function onWorldRestartAtChanged(){ bootTimer.restart() }
    }
    onWidthChanged: bootTimer.restart()
    onHeightChanged: bootTimer.restart()
    onWorldLeftPxChanged: bootTimer.restart()
    onPanelBottomPxChanged: bootTimer.restart()
    Connections { target: cv; function onWidthChanged(){ bootTimer.restart() } function onHeightChanged(){ bootTimer.restart() } }
}
