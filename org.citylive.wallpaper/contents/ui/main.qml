import QtQuick
import QtQuick.Window
import org.kde.plasma.plasmoid
import "../js/city.js" as City
import "../js/localcfg.js" as Local   // per-machine personal settings (birthdays/location/cycle); committed EMPTY, filled by install.sh from config.local.json

WallpaperItem {
    id: root

    readonly property string scene: (configuration && configuration.scene) ? configuration.scene : "neon"
    property bool cfgApplied: false   // local personal config (birthdays/location/cycle) is injected once, at first boot
    // DEVICE px per world/canvas pixel — the chunkiness of the pixel art.
    readonly property int pxk: 3    // hi-res "128-bit" mode (6→4→3; ~1.8x pixels of pxk4; KSP=6/pxk in city.js adapts speeds/masses)
    // QUALITY tier: spectacle (full 12fps everything) / balanced / performance (8fps, thinner
    // effects — laptop & battery friendly). Config override, else auto by total canvas load.
    readonly property string quality: {
        if (configuration && configuration.quality) return configuration.quality;
        return (width * height > 2200000) ? "balanced" : "spectacle";
    }
    // This screen's device-pixel ratio (fractional display scaling, e.g. 1.1 at 110%). ALL world
    // geometry below is in DEVICE pixels: with fractional scaling Qt rasterizes the scene at device
    // resolution, so only a device-integer canvas scale avoids duplicated-pixel seam lines.
    readonly property real dpr: (Screen.devicePixelRatio > 0) ? Screen.devicePixelRatio : 1
    // buffer px per canvas pixel: pxk logical px worth, rounded to an INTEGER number of buffer
    // px (Qt rasterizes at dpr x logical). Integer -> no duplicated-pixel seams; ~pxk logical
    // -> the city has the SAME apparent size on every screen regardless of display scaling.
    // On fractionally-scaled screens plasmashell renders integer-2x and KWin downsamples to the
    // output (e.g. 1.65x) — that resample drops buffer columns in a periodic cadence, which
    // stripes chunky pixel blocks (verified with a comb test pattern). Defense: render FINE
    // texels there (texelBuf buffer px per canvas px) and draw the world at ZOOM canvas px per
    // world px — a dropped column then costs a sliver of a feature, like any native-res window.
    readonly property real texelBuf: (dpr === 1) ? pxk : 2
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

    Canvas {
        id: cv
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
        smooth: root.dpr !== 1   // crisp NEAREST on integer-scale screens; LINEAR on fractionally-
                                 // scaled ones (e.g. 1.65x) so KWin's downsample doesn't stripe the
                                 // screen with dropped-column beat lines. The ~1px ramp is imperceptible.
        antialiasing: false
        renderTarget: Canvas.FramebufferObject
        transformOrigin: Item.TopLeft
        scale: root.texelBuf / root.dpr

        onPaint: {
            var g = getContext("2d");
            City.draw(g);
        }
    }

    Timer {
        interval: root.quality === "performance" ? 125 : 100   // 8 vs 10 fps by quality tier (10fps offsets the pxk3 hi-res cost; motion is time-based so no speed change)
        running: root.visible
        repeat: true
        onTriggered: cv.requestPaint()
    }

    function boot() {
        // ignore the transient boots during screen bring-up (dimensions not settled yet)
        if (root.width < 8 || root.height < 8 || cv.width < 8 || cv.height < 8)
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
        console.log("CityLive screen located: virtualX=" + Screen.virtualX + " " + root.width + "x" + root.height
                    + " dpr=" + root.dpr + " zoom=" + root.zoom + " -> woff=" + Math.round(root.worldLeftPx / root.pxk) + "wp " + cv.width + "x" + cv.height
                    + " panelBottom=" + root.panelBottomPx + "px (" + Math.ceil(root.panelBottomPx / root.pxk) + "wp)");
    }

    // debounce the flurry of width/height/x changes at bring-up into one setup
    Timer { id: bootTimer; interval: 60; onTriggered: root.boot() }
    // one-shot SETTLE pass: 6s after bring-up, re-run setup + repaint — shakes out any
    // transient geometry/scale state from login/output reconfiguration (stripe insurance)
    Timer { id: settleTimer; interval: 6000; running: true; onTriggered: { root.boot(); cv.requestPaint() } }
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
