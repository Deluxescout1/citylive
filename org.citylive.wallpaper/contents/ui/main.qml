import QtQuick
import QtQuick.Window
import QtQuick.LocalStorage
import org.kde.plasma.plasmoid
import org.kde.taskmanager as TaskManager
import org.kde.plasma.plasma5support as P5Support   // one-shot hardware probe; see detectHardware()
import "../js/city.js" as City
import "../js/localcfg.js" as Local   // per-machine personal settings (birthdays/location/cycle); committed EMPTY, filled by install.sh from config.local.json

WallpaperItem {
    id: root

    readonly property string scene: (configuration && configuration.scene) ? configuration.scene : "neon"
    property bool cfgApplied: false   // local personal config (birthdays/location/cycle) is injected once, at first boot
    property string renderError: ""
    property string lastChronicleKey: ""
    readonly property bool chronicleEnabled: !configuration || configuration.chronicleEnabled === undefined || configuration.chronicleEnabled
    // QUALITY tier — this only ever set the frame rate; EVERY feature draws in every tier, which is
    // the point (Nick: "still show all the features by default"). Live pass:
    //   spectacle 83ms = 12fps · balanced 125ms = 8fps · performance 500ms = 2fps (battery)
    // The comment here used to claim performance was 8fps; it has always been 500ms. Config
    // override, else auto by total canvas load.
    // 🚨 THE AUTO RULE WAS SCREEN AREA ALONE, AND ON A LAPTOP IT IS INVERTED. Area was standing in
    // for "how much machine is there", and the correlation runs the wrong way at the bottom of the
    // market: a cheap laptop has a SMALL screen, fell through to `spectacle`, and so ran the most
    // expensive tier we ship on the weakest hardware we ship to — while a 4K desktop with 28 threads
    // got the cheap one. `hwCap` is what the CPU and RAM can actually afford.
    // 🔑 IT IS A CAP, NOT A REPLACEMENT. Area still decides; the machine can only pull the tier DOWN.
    // Nick's three-monitor desktop is the surface this project is judged on and its look is settled
    // (8 fps + coarse texels, chosen explicitly and confirmed) — a rule that re-derived his tier from
    // scratch could change it to fix a laptop nobody is looking at. 28 threads and 64 GB cap at
    // `spectacle`, which is no cap at all, so his machine resolves exactly as it does today.
    // ⚠ AND IF WE CANNOT TELL, WE DO NOT GUESS. `hwCap` defaults to "spectacle" (no cap), so a
    // sandbox that hides /proc leaves behaviour byte-identical to before this change.
    readonly property var tierOrder: ({ spectacle: 0, balanced: 1, performance: 2 })
    property string hwCap: "spectacle"
    function cheaper(a, b) {
        return (tierOrder[a] === undefined ? 0 : tierOrder[a]) >= (tierOrder[b] === undefined ? 0 : tierOrder[b]) ? a : b;
    }
    readonly property string quality: {
        if (configuration && configuration.quality) return configuration.quality;
        var byScreen = (width * height > 2200000) ? "balanced" : "spectacle";
        return cheaper(byScreen, hwCap);
    }
    // Read the machine's own numbers once, at boot.
    // ⚠⚠ THE OBVIOUS ROUTE DOES NOT WORK, AND IT FAILS SILENTLY. The first version of this read
    // /proc/cpuinfo and /proc/meminfo through QML's XMLHttpRequest, which is the documented way to
    // read a local file from QML. Qt DISABLES file:// GET by default ("Set QML_XHR_ALLOW_FILE_READ
    // to 1 to enable this feature") — so it returned empty, `cores` came out 0, the guard fell
    // through to its safe default of "no cap", and the whole feature was dead code that logged
    // nothing and changed nothing. It would have shipped looking exactly like a working cap.
    // 🔑 Measured, not assumed: a standalone qml6 probe printed `cores=0 memMB=0` before this file
    // was ever installed. The Plasma executable DataSource below printed `28 / 64057`.
    // ⚠ THRESHOLDS MIRROR desktop/perf-policy.js DELIBERATELY. Two shells disagreeing about what a
    // machine can afford is how the same laptop ends up smooth in one and stuttering in the other.
    P5Support.DataSource {
        id: hwProbe
        engine: "executable"
        connectedSources: []
        onNewData: function (source, data) {
            disconnectSource(source);                     // one shot — never leave a shell connected
            try {
                var out = String(data["stdout"] || "").trim().split("\n");
                var cores = parseInt(out[0], 10), memMB = parseInt(out[1], 10);
                if (!(cores > 0) || !(memMB > 0)) return;  // could not tell → no cap, behave as before
                if (cores >= 8 && memMB >= 15000) root.hwCap = "spectacle";
                else if (cores >= 4 && memMB >= 7000) root.hwCap = "balanced";
                else root.hwCap = "performance";
                console.log("CityLive hardware: " + cores + " cores, " + memMB + " MB -> tier cap " + root.hwCap);
            } catch (e) { /* no cap */ }
        }
    }
    function detectHardware() {
        try { hwProbe.connectSource("nproc; awk '/MemTotal/{print int($2/1024)}' /proc/meminfo"); }
        catch (e) { /* no cap — the wallpaper must never fail to start over a performance hint */ }
    }
    // The probe is asynchronous, so the first `setup()` may already have run with the uncapped tier.
    // Re-boot when the answer actually lowers it, rather than waiting for the 6 s settle pass — this
    // fires at most once per session, and only on a machine that needed capping in the first place.
    onHwCapChanged: if (hwCap !== "spectacle") bootTimer.restart()
    // DEVICE px per world/canvas pixel. Keep the original wide pxk3 composition in every quality
    // tier; performance comes from retained layers and scheduling, never by zooming the city in.
    readonly property int pxk: 3
    // This screen's device-pixel ratio (fractional display scaling, e.g. 1.1 at 110%). ALL world
    // geometry below is in DEVICE pixels: with fractional scaling Qt rasterizes the scene at device
    // resolution, so only a device-integer canvas scale avoids duplicated-pixel seam lines.
    readonly property real dpr: (Screen.devicePixelRatio > 0) ? Screen.devicePixelRatio : 1
    readonly property bool fractionalDpr: Math.abs(dpr - Math.round(dpr)) > 0.01
    // buffer px per canvas pixel: pxk logical px worth, rounded to an INTEGER number of buffer
    // px (Qt rasterizes at dpr x logical). Integer -> no duplicated-pixel seams; ~pxk logical
    // -> the city has the SAME apparent size on every screen regardless of display scaling.
    // On fractionally-scaled screens plasmashell renders integer-2x and KWin downsamples to the
    // output (e.g. 1.65x) — that resample drops buffer columns in a periodic cadence, which
    // stripes chunky pixel blocks (verified with a comb test pattern). Defense: render FINE
    // texels there (texelBuf buffer px per canvas px) and draw the world at ZOOM canvas px per
    // world px — a dropped column then costs a sliver of a feature, like any native-res window.
    // Any dpr > 1 gets the fine texels, not just an arithmetically-fractional one. A 4K at 165%
    // reports dpr EXACTLY 2 (Plasma renders integer-2x and KWin does the 1.65x downsample itself),
    // so `fractionalDpr` is false on the very screen that stripes. With pxk texels each canvas
    // pixel covers 3 buffer px, and that block size beats against KWin's 4656->3840 resample into
    // vertical lines every ~58px. The engine's own render is provably clean — the same frame drawn
    // at integer scale has zero anomalous columns — so this is purely a texel-size artefact.
    // ⚠ THE FINE TEXELS ARE NOT FREE, and the note that used to sit here saying they were is wrong.
    // "54.4% with vs 55.2% without" holds only at the 200ms (5fps) cadence, where the canvas render
    // thread has time to spare. Re-measured back to back at 125ms on the same three screens:
    //     5 fps  fine 38.8%   coarse 31.7%
    //     8 fps  fine 63.6%   coarse 51.2%
    // Fine texels cost TWELVE POINTS the moment the frame rate goes up, because they make this
    // screen's LIVE canvas 2328x1311 instead of 1552x874 — 2.24x the pixels, repainted every frame.
    // Nick chose to spend that on smoothness instead (8fps), so the defense comes off and the 4K
    // screen goes back to the SAME texel density as the other two monitors: 3 device px per canvas
    // px, which is what pxk 3 has always meant. The cheap half of the defense stays — `smooth:` on
    // the live canvas below is linear filtering, costs nothing, and per the note above is what
    // actually absorbs KWin's dropped columns. If the vertical lines ever come back on the 4K@165%,
    // this line is the first thing to put back (and it is a QUALITY choice, not a bug fix).
    // ⚠⚠ AND THEY CAME BACK. Nick, three times in one session: "more lines in those mountains",
    // "those lines need to be corrected they are back on my left screen - they look bad". The note
    // above called this shot exactly — the defence was traded away for frame rate and said so, and
    // said this line is the first thing to put back if the lines returned. They returned.
    // ⚠ CONFIRMED, NOT ASSUMED: his exact frame (life 363, age 0.482, alpine, cloudy) rendered
    // offscreen at 1:1 has NO vertical lines anywhere in it. The engine output is clean; the lines
    // are made downstream by KWin's 4656->3840 resample beating against 3-device-px texel blocks.
    // ⚠ ONLY THE SCREEN THAT NEEDS IT PAYS. Fine texels go back on for dpr > 1 — the 4K at 165%,
    // which reports dpr exactly 2 because Plasma renders integer-2x and KWin does the 1.65x itself —
    // and the other two monitors keep the cheap coarse texels they never had a problem with.
    // The cost is real and measured, not hand-waved: this screen's live canvas becomes 2328x1311
    // instead of 1552x874 (2.24x the pixels, repainted every frame), which came to about twelve
    // points of one core at 8fps across the three screens last time it was measured.
    // ⚠⚠⚠ AND THEY CAME BACK A FOURTH TIME — Nick, 2026-08-02: "also the lines are back", on THE KARST.
    // The guard above keyed on `dpr > 1`, which is not the trigger. It is a PROXY for the trigger that
    // happened to be true on the only screen that had ever shown the fault, and the note beside it even
    // said the other two monitors "never had a problem" — scoping a fix to where the symptom appeared,
    // which is this project's most repeated mistake.
    // THE REAL TRIGGER IS WHETHER THE CANVAS IS UPSCALED BY A WHOLE NUMBER. With coarse texels the canvas
    // is `ceil(width*dpr/pxk)` and the compositor stretches it back to `width*dpr`. Measured on his three:
    //   · 3840 @1.65 → dpr 2 → fine texels already          → clean
    //   · 2560 @1    → 2560/3 = 853.3 → 854*3 = 2562 ≠ 2560 → stretched by 2.9977, BEATS  ← the karst screen
    //   · 1920 @1    → 1920/3 = 640   → 640*3  = 1920 ✓     → exact, clean
    // That is why exactly one monitor striped and why it looked screen-specific: 1920 divides by pxk and
    // 2560 does not. Verified by rendering his exact frame (SCR 854x480 Z1 K2 WOFF 776) both ways — the
    // coarse canvas streaks down the towers, the fine one is clean.
    // So the test is the arithmetic, not the dpr. A screen whose canvas scales by an exact integer keeps
    // the cheap coarse texels and pays nothing; only a screen that would be fractionally stretched pays.
    readonly property bool fractionalTexel: {
        var q = (width * dpr) / pxk;
        return Math.abs(q - Math.round(q)) > 0.001;
    }
    readonly property real texelBuf: (dpr > 1 || fractionalTexel) ? 1 : pxk
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

    // ---- PERFORMANCE GUARD: never pay to draw a screen nobody can see ----
    // Plasma does NOT mark a wallpaper invisible when a window covers it. Measured on this desktop:
    // fully occluded by a fullscreen window cost 45.8% of one core versus 43.5% visible — the
    // wallpaper pays full price behind every game, every fullscreen video, every maximised window,
    // for a picture no one is looking at. When the probe that found this was first run, two of the
    // three screens were completely covered and both were still drawing at full cost.
    // So we work it out ourselves from the window list. This is the ONE throttle that costs nothing
    // visually — by definition you cannot see what it turns off — which is why it runs by default.
    // libtaskmanager refuses this protocol to untrusted clients, but a wallpaper lives inside
    // plasmashell, which KWin trusts. It yields nothing when run standalone; test it in place.
    readonly property bool guardOn: !configuration || configuration.pauseWhenCovered === undefined || configuration.pauseWhenCovered
    property bool covered: false
    TaskManager.TasksModel {
        id: winModel
        groupMode: TaskManager.TasksModel.GroupDisabled
        filterByVirtualDesktop: true       // a maximised window on another desktop is not covering this one
        filterByActivity: true
    }
    // Poll rather than react to model signals: a dozen rows once a second is free next to a frame,
    // and it cannot get wedged in a stale state the way a missed signal can.
    Timer {
        interval: 1000; repeat: true; running: root.guardOn && root.visible
        onTriggered: root.covered = root.isCovered()
    }
    function isCovered() {
        // ⚠ COMPARE AGAINST THE AVAILABLE RECT, NOT THE SCREEN. A *maximised* window covers the
        // screen MINUS the panels — the first version of this tested against the full screen rect
        // and so never fired even once: Brave maximised on the 4K measured 2327x1259 against a
        // 1309-tall screen, exactly the 50px panel short. What is left uncovered is the strip behind
        // an opaque panel, which nobody can see either. Auto-hidden panels give the whole screen
        // back, and then this is the full-screen test again.
        var sx = Screen.virtualX, sy = Screen.virtualY, sw = root.width, sh = root.height;
        if (sw < 8 || sh < 8) return false;
        try {
            var r = Plasmoid.availableScreenRect;
            if (r && r.width > 8 && r.height > 8) { sx += r.x; sy += r.y; sw = r.width; sh = r.height; }
        } catch (e) { /* unreachable → fall back to the whole screen */ }
        for (var i = 0; i < winModel.count; i++) {
            var idx = winModel.index(i, 0);
            if (winModel.data(idx, TaskManager.AbstractTasksModel.IsMinimized)) continue;
            var g = winModel.data(idx, TaskManager.AbstractTasksModel.Geometry);
            if (!g || g.width < 8 || g.height < 8) continue;
            // A couple of px of slack: a "maximised" window is often a hair short of the screen rect.
            if (g.x <= sx + 2 && g.y <= sy + 2 && g.x + g.width >= sx + sw - 2 && g.y + g.height >= sy + sh - 2)
                return true;
        }
        return false;
    }
    // Coming back has to be instant — a revealed desktop must not sit on a stale frame waiting for
    // the next tick. The engine is clock-driven, so the city simply resumes at the correct moment;
    // the dt cap (see FRAME_MS) already absorbs the gap so nothing lurches on the first frame back.
    onCoveredChanged: if (!covered) { bgcv.requestPaint(); cv.requestPaint(); }

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
    // "balanced" was 200ms — FIVE frames a second, and that is what Nick meant by "jittery". It is
    // also far slower than the other shells' balanced tier (Electron/web/phone run 10fps there), so
    // the KDE wallpaper was the choppiest surface we ship, on the machine it was written for.
    // 125ms = 8fps, measured back to back on his three screens at 51.2% of one core (vs 31.7% at
    // 5fps). CPU scales almost exactly linearly with this number — 1.6x the frames cost 1.6x the
    // CPU — because engine JS is only ~1/3 of the cost and rasterising/uploading/compositing is the
    // rest, and none of that shrinks when the JS does. So this is a deliberate spend, not a free
    // win: don't raise it further without re-measuring with tools/perf-ab.sh. 10fps was 62.2%.
    // (Weather no longer changes speed when this does — see MOTION_RATE in city.js.)
    readonly property int frameMs: quality === "performance" ? 500 : (quality === "balanced" ? 125 : 83)
    // ⚠⚠ COVERED IS A HEARTBEAT, NOT A HALT — AND STOPPING THESE TIMERS OUTRIGHT WAS A REAL BUG.
    // Every piece of city state the chronicle and the notifier read (`curDis`, `cityPhase`,
    // `curMayor`, `curRegime`, `curPlague`…) is assigned INSIDE `City.draw()` — see city.js ~53057.
    // `chronicleSnapshot` is a pure probe of those globals, which is exactly why it is safe to call
    // and exactly why it is worthless if nothing is writing them. So while a window covered this
    // screen, the chronicle timer below went on running at full speed, reading state frozen at the
    // moment of covering, and the city's history simply stopped being recorded — silently, for as
    // long as anything was maximised, which on a laptop is most of the day. Nobody would ever see
    // that fail; they would just find holes in the chronicle.
    // 🔑 One frame every 30 s instead of eight a second is 0.4% of the drawing cost — nothing, against
    // the 43.1% → 10.6% this guard is worth — and it keeps the history, the notifications and the
    // canvas contents alive. A reveal then uncovers a city at most 30 s stale instead of hours.
    readonly property int heartbeatMs: 30000
    Timer {
        interval: root.covered ? root.heartbeatMs : root.frameMs
        running: root.visible
        repeat: true
        onTriggered: cv.requestPaint()
    }

    // The backdrop only has to keep up with the sun, the weather and the seasons, so it repaints
    // about once a second instead of twelve times. This is where the saving actually comes from.
    Timer {
        interval: root.covered ? root.heartbeatMs
                               : (root.quality === "performance" ? 4000 : (root.quality === "balanced" ? 2000 : 1000))
        running: root.visible
        repeat: true
        onTriggered: bgcv.requestPaint()
    }

    // ⚠ WAS ONE SECOND. Nothing it reports can change faster than a disaster stage — minutes, not
    // seconds — and on a laptop a timer wakeup costs battery whether or not it costs measurable CPU.
    // Three screens at 1 Hz is three wakeups a second, forever, to notice something that happens a
    // few times an hour.
    Timer {
        interval: 5000; running: root.visible; repeat: true
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
            quality: root.quality,                                // effect-density tier
            frameMs: root.frameMs                                 // live-pass interval → frame-rate-independent weather (see FRAME_MS in city.js)
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
    Component.onCompleted: { root.detectHardware(); bootTimer.restart() }
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
