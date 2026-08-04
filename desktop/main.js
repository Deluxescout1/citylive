// CityLive — Electron main process.
// Opens the pixel-city engine in a native window on Windows, macOS and Linux.
// The renderer (renderer/index.html + renderer/city.js) is the exact same engine
// that powers the KDE Plasma wallpaper, so the city looks identical everywhere.

const { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain, dialog, Notification } = require('electron');
const path = require('path');
const store = require('./config-store');
const chronicle = require('./chronicle-store');
const screensaver = require('./screensaver');
const wallpaper = require('./wallpaper');

// Windows may launch us as a screensaver (.scr) with /s, /c or /p. Detect that up front;
// it changes how the window is created and whether we take the single-instance lock.
const SS = screensaver.parseFlags(process.argv);
// --wallpaper: start straight into behind-the-icons desktop wallpaper mode (Windows).
const START_WALLPAPER = process.argv.includes('--wallpaper');
// --settings: open the Control Center (the "CityLive Settings" desktop shortcut).
const START_SETTINGS = process.argv.includes('--settings');

// Where the friend's personal settings (birthdays / location / speed) live. This is in
// the OS user-data folder, OUTSIDE the app bundle, so auto-updates never overwrite it.
// Set once the app is ready (needs app.getPath). All config I/O goes through config-store.
let CONFIG_PATH = null;
let CHRONICLE_PATH = null;

// Auto-update from GitHub Releases: when you tag a new version and CI publishes a release, installed
// apps download it in the background and apply it on the next launch. Optional in dev (module may be absent).
let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) { /* dev without the dep → no updates */ }
if (autoUpdater) {
  autoUpdater.autoDownload = true;          // fetch the new version as soon as it's seen
  autoUpdater.autoInstallOnAppQuit = true;  // safety net if the immediate install below ever fails
}

// A single shared render process is plenty; allow GPU canvas acceleration.
// ⚠⚠ WINDOWS DROPS EVERY NOTIFICATION WITHOUT THIS, SILENTLY. Reported by Micah: he got no
// notifications at all while Nick got them on KDE, and he asked what he needed to change on his end —
// nothing. On Windows a toast is only delivered if the process has an AppUserModelID that matches a
// Start Menu shortcut; with no AUMID set, `new Notification().show()` succeeds and nothing appears.
// Linux has no such requirement, which is exactly why this was invisible to us: the platform that
// works is the platform we develop on.
// Must match `build.appId` in package.json and the NSIS shortcut it installs.
if (process.platform === 'win32') app.setAppUserModelId('org.citylive.app');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.disableHardwareAcceleration && false; // (keep HW accel on for smooth canvas)

// ================================================================================================
// CRASH RECOVERY — never leave the user staring at a black window they cannot fix
// ------------------------------------------------------------------------------------------------
// ⚠⚠ REPORTED BY MICAH, 2026-08-02: "citylive crashed this morning and now the settings wont open."
// The Control Center opened and painted nothing but its own `#05070c` background — a black box, on
// every launch, permanently. Two separate gaps made that state both PERMANENT and INVISIBLE:
//   · Electron caches compiled GPU/shader and code artefacts under userData. A hard crash can leave
//     those TORN, and every later run renders blank windows off them. Nothing ever cleared them, so
//     the app could not recover from its own crash no matter how many times he restarted it.
//   · This file had NO `did-fail-load`, `render-process-gone`, `gpu-process-crashed` or `unresponsive`
//     handler anywhere. A renderer that died left a window that merely SAT there, and because `ccWin`
//     was still truthy `openControlCenter` would `show()` the corpse forever after.
// 🔑 A FAILURE THE USER CANNOT SEE OR CLEAR IS WORSE THAN A CRASH. A crash restarts; this did not.
// So an unclean shutdown is now DETECTED and the volatile caches are dropped before boot; a repeat
// crash escalates to disabling hardware acceleration, the standard cure for a driver that cannot be
// trusted with a canvas. Both are logged so the next report has something in it.
const fsx = require('fs');
let CRASH_STATE = { unclean: false, count: 0 };
function crashMarkPath() { return path.join(app.getPath('userData'), '.running'); }
function recoverFromUncleanShutdown() {
  let mark = null;
  try { mark = crashMarkPath(); } catch (e) { return; }            // userData unavailable → nothing to do
  try {
    if (fsx.existsSync(mark)) {
      CRASH_STATE.unclean = true;
      try { CRASH_STATE.count = (JSON.parse(fsx.readFileSync(mark, 'utf8')) || {}).count || 1; }
      catch (e) { CRASH_STATE.count = 1; }
      // Drop only VOLATILE, regenerable caches. config.json and chronicle.json are the user's data
      // and are never touched here — losing a city's history to a graphics glitch would be its own bug.
      const ud = app.getPath('userData');
      for (const dir of ['GPUCache', 'Code Cache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'ShaderCache']) {
        try { fsx.rmSync(path.join(ud, dir), { recursive: true, force: true }); } catch (e) { /* best effort */ }
      }
      console.log('[citylive] previous run did not exit cleanly (x' + CRASH_STATE.count + ') — cleared GPU/code caches');
      // Twice in a row is not a fluke: stop trusting the GPU for this machine.
      if (CRASH_STATE.count >= 2) {
        try { app.disableHardwareAcceleration(); } catch (e) { /* too late / unsupported */ }
        console.log('[citylive] repeated unclean shutdowns — hardware acceleration DISABLED for this run');
      }
    }
  } catch (e) { /* recovery must never be the thing that stops the app starting */ }
  try {
    fsx.mkdirSync(path.dirname(mark), { recursive: true });
    fsx.writeFileSync(mark, JSON.stringify({ count: (CRASH_STATE.unclean ? CRASH_STATE.count : 0) + 1, at: Date.now() }), 'utf8');
  } catch (e) { /* best effort */ }
}
function clearCrashMark() { try { fsx.rmSync(crashMarkPath(), { force: true }); } catch (e) { /* best effort */ } }
// `--safe-mode` is the escape hatch to hand a user whose machine we cannot see.
if (process.argv.includes('--safe-mode')) { try { app.disableHardwareAcceleration(); } catch (e) {} }
recoverFromUncleanShutdown();
app.on('will-quit', clearCrashMark);
app.on('before-quit', clearCrashMark);

// Attach the handlers that turn a dead renderer into either a working window or a VISIBLE error.
// Without these the window is simply black and the user has nothing to report but "it won't open".
function guardWindow(w, label, reload) {
  if (!w || w.isDestroyed()) return w;
  const wc = w.webContents;
  wc.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;                        // -3 = aborted (navigation superseded)
    console.log('[citylive] ' + label + ' failed to load: ' + code + ' ' + desc + ' ' + url);
    if (reload && !w.isDestroyed()) { try { reload(w); } catch (err) { /* fall through to the notice */ } }
  });
  wc.on('render-process-gone', (e, details) => {
    console.log('[citylive] ' + label + ' render process gone: ' + (details && details.reason));
    if (w.isDestroyed()) return;
    if (reload) { try { reload(w); return; } catch (err) { /* fall through */ } }
    try { w.destroy(); } catch (err) {}
  });
  wc.on('unresponsive', () => console.log('[citylive] ' + label + ' unresponsive'));
  return w;
}
// A GPU process that dies takes every window's pixels with it. Recover once, then stop trusting it.
app.on('child-process-gone', (e, details) => {
  if (!details || details.type !== 'GPU') return;
  console.log('[citylive] GPU process gone: ' + details.reason + ' — windows may be blank until restart');
});

let win = null;
// ⚠⚠ SIBLING WALLPAPER WINDOWS — ONE PER EXTRA DISPLAY. Reported by Micah on 1920x1080 + 3840x2160:
// the city drew over his taskbar on one screen and had NO GROUND AT ALL on the other.
// One union window has ONE bottom edge and ONE scale; a mixed-DPI multi-monitor desktop has neither, so
// `HORIZON = SH - GROUND` landed at the bottom of the UNION — i.e. the bottom of the 4K panel — which is
// a whole monitor below the 1080p panel's visible area. Same assumption broke the taskbar reserve, which
// took the MAX bottom gap across displays and applied it globally.
// 🔑 The fix is the model the KDE plugin has always used: ONE ENGINE INSTANCE PER SCREEN, each with its
// own height, its own taskbar reserve and its own `woff` — continuity across monitors comes from `woff`,
// never from one window being physically wide enough.
// ⚠ `win` stays the PRIMARY window so the tray, menus, dialogs, reload and every IPC target keep working
// unchanged; only wallpaper mode grows siblings.
// ⚠ The VM-verified constraint in this file is that a FULLSCREEN window goes blank when reparented into
// Progman — it says nothing about window COUNT, and wallpaper.js's attach/detach/isStillAttached are all
// per-window. Multiple reparented children are fine.
let extraWins = [];
let tray = null;
let wallpaperMode = false;       // legacy ambient full-screen (non-Windows fallback)
let desktopWallpaper = false;    // real behind-the-icons wallpaper (Windows)
let wpWatch = null;              // watchdog timer that re-attaches after Explorer restarts
let wpFailStreak = 0;            // consecutive failed (re)attaches before we give up + fall back
let wpDialogShown = false;       // latch so one failed attempt shows the fallback dialog once
let wallpaperPref = null;        // tri-state mirror of config `wallpaper`: true/false/null(=never decided)
let ccWin = null;                // the Control Center window (settings.html) — never assigned to `win`
let firstRunBalloon = false;     // show the one-time "this is your wallpaper now" tray balloon
let quitting = false;            // true once the user really wants to exit (before-quit)

function createWindow(opts) {
  const wp = !!(opts && opts.wallpaper);
  const bare = SS.screensaver || wp;   // screensaver + wallpaper both want a chromeless full window
  // A wallpaper window must NOT be Chromium-fullscreen: converting a fullscreen window into
  // a WS_CHILD of Progman leaves its compositor blank (VM-verified — the reparented surface
  // stops painting, while a plain window reparents and paints fine). So the wallpaper gets a
  // frameless window SIZED like the desktop instead. ONE CONTINUOUS CITY across all monitors:
  // bounds = the union of every display (like the KDE tri-monitor setup). wallpaper.js's
  // MoveWindow then covers the same virtual screen natively after the reparent (child coords
  // are Progman-client-relative, origin = virtual-screen top-left) — the two agree by design.
  // ⚠ SIZED TO THE PRIMARY DISPLAY, NOT THE UNION. The union is still computed, but only so each window
  // knows how wide the shared world is (`uw`) and where it sits in it (`dx`).
  let wpBounds = null, wpUnion = null, wpDisp = null;
  if (wp) {
    try {
      const scr = require('electron').screen;
      wpUnion = displayUnion();
      wpDisp = scr.getPrimaryDisplay();
      wpBounds = wpDisp.bounds;
    } catch (e) { wpBounds = null; wpUnion = null; wpDisp = null; }
  }
  win = new BrowserWindow({
    width: wpBounds ? wpBounds.width : 1280,
    height: wpBounds ? wpBounds.height : 720,
    ...(wpBounds ? { x: wpBounds.x, y: wpBounds.y, resizable: false } : {}),
    minWidth: 480,
    minHeight: 320,
    fullscreen: SS.screensaver,   // fullscreen ONLY for the screensaver (see note above)
    frame: !bare,
    skipTaskbar: bare,
    focusable: !wp,              // a wallpaper never steals focus
    backgroundColor: '#05070c',
    title: 'CityLive',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,       // menu bar hidden until Alt (Win/Linux); macOS uses top bar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false // keep animating when unfocused / in the background
    }
  });

  // ⚠ THE WALLPAPER DIES THE SAME WAY THE SETTINGS WINDOW DOES. In the VM reproduction of Micah's
  // report, killing the renderer left the Control Center black AND took the city off the desktop —
  // and neither came back. A wallpaper that has silently stopped is the worse of the two, because it
  // is reparented behind the icons where there is nothing to click and no window to close.
  if (wp && wpDisp) win._clDisplayId = wpDisp.id;   // the primary wallpaper window's own display
  const winArgs = (wp && wpDisp && wpUnion) ? { search: dispSearch(wpDisp, wpUnion) } : undefined;
  guardWindow(win, 'wallpaper', (w) => w.loadFile(path.join(__dirname, 'renderer', 'index.html'), winArgs));
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'), winArgs);

  // NOTIFICATIONS (Nick): poll the engine ~1/min for something of SUBSTANCE on screen (elections,
  // CAT-3+ disasters, the takeover, the finale approach, eclipse days). The engine's notifySnapshot
  // is pure/stateless; the HOST dedupes by its stable event key. Toggle: Settings → notifications.
  if (!global.__cityNotifyTimer) {
    let lastNotifyKey = '';
    global.__cityNotifyTimer = setInterval(() => {
      try {
        if (!win || win.isDestroyed()) return;
        const ncfg = store.readConfig(CONFIG_PATH);
        if (ncfg && ncfg.notifications === false) return;
        win.webContents.executeJavaScript('(typeof notifySnapshot==="function")?JSON.stringify(notifySnapshot(Date.now())||null):"null"', true)
          .then((raw) => {
            const n = JSON.parse(raw);
            if (n && n.key && n.key !== lastNotifyKey) {
              lastNotifyKey = n.key;
              if (Notification.isSupported()) new Notification({ title: 'CityLive — ' + n.title, body: n.body || '' }).show();
            }
          }).catch(() => {});
      } catch (e) { /* never let the notifier hurt the wallpaper */ }
    }, 60000);
  }

  // External links (if any) open in the user's real browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Once the page is up, sink the window behind the desktop icons — and verify it took.
  // On RECOVERY (Explorer restarted, Progman was recreated) retry quietly instead of
  // popping the fallback dialog: Progman may still be respawning for a second or two.
  if (wp) {
    const recovering = !!(opts && opts.recovering);
    win.webContents.once('did-finish-load', () => {
      if (recovering) attachWithRetry(win, 5);
      else attachOrFallback(win);
      try { spawnSiblingWallpapers(wpUnion, wpDisp); } catch (e) {}
    });
  }

  // Only null the module ref if it still points at THIS window — during a wallpaper-mode
  // swap the old window's `closed` fires after the replacement was already assigned.
  // LOSS DETECTION lives HERE (not window-all-closed): with the Control Center open,
  // window-all-closed never fires when Explorer's restart destroys our reparented child,
  // so the wallpaper would silently never resurrect. The window's own `closed` always fires.
  const self = win;
  win.on('closed', () => {
    if (win !== self) return;
    destroySiblingWallpapers();
    win = null;
    if (wp && !quitting && desktopWallpaper) handleWallpaperWindowLost();
  });
}

// Everything one wallpaper window needs to place its own city: where this display sits inside the world,
// how tall it is, its own bottom-taskbar gap, and how wide the whole desktop is so all screens share one
// continuous world. Per DISPLAY — never a global maximum.
function dispSearch(d, uni) {
  const bottomGap = (d.bounds.y + d.bounds.height) - (d.workArea.y + d.workArea.height);
  return 'dx=' + (d.bounds.x - uni.x) +
         '&dw=' + d.bounds.width +
         '&dh=' + d.bounds.height +
         '&uw=' + uni.width +
         '&tb=' + Math.max(0, bottomGap) +
         '&sf=' + (d.scaleFactor || 1);
}

// The union rectangle of every connected display — the whole desktop, all monitors.
function displayUnion() {
  const ds = require('electron').screen.getAllDisplays();
  if (!ds.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of ds) {
    minX = Math.min(minX, d.bounds.x); minY = Math.min(minY, d.bounds.y);
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width);
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// --- Desktop-wallpaper support helpers (Windows) --------------------------------

// Remember the choice in userData/config.json (survives auto-updates) so the city comes
// back as the wallpaper after a reboot. Always writes an EXPLICIT true/false: false is a
// real opt-out (fresh installs default ON, so "absent" must never mean "user said no").
// Read-modify-write so birthdays etc. are untouched.
function persistWallpaperPref(on) {
  if (!CONFIG_PATH) return;
  try {
    const cfg = store.readConfig(CONFIG_PATH);
    cfg.wallpaper = !!on;
    store.writeConfig(CONFIG_PATH, cfg);
    wallpaperPref = !!on;
  } catch (e) { /* non-fatal: worst case the pref just doesn't persist */ }
}

// Launch at login in wallpaper mode so it behaves like a real wallpaper. Packaged Windows
// only — never register the dev Electron binary, never touch login items on other OSes.
function syncLoginItem(on) {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  try { app.setLoginItemSettings({ openAtLogin: on, args: ['--wallpaper'] }); }
  catch (e) { /* best effort */ }
}

// Attach behind the icons and verify it actually took. A failed reparent — or one that
// silently drops a moment later on a quirky Explorer build — must never leave a chromeless
// fullscreen window covering the desktop; fall back to a normal window + explain.
// One frameless, non-focusable wallpaper window per NON-primary display, each reparented into Progman on
// its own. Each carries its own `dx/dh/tb`, so each puts its ground on ITS OWN bottom edge and reserves
// ITS OWN taskbar — which is the whole bug Micah reported.
// ⚠ These deliberately do NOT touch `win`: no tray, no menu, no dialogs, no IPC. They are pure canvases.
function spawnSiblingWallpapers(uni, primary) {
  destroySiblingWallpapers();
  if (!uni || !primary || !desktopWallpaper) return;
  const scr = require('electron').screen;
  for (const d of scr.getAllDisplays()) {
    if (d.id === primary.id) continue;
    const w = new BrowserWindow({
      x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height,
      frame: false, skipTaskbar: true, focusable: false, resizable: false,
      backgroundColor: '#05070c', title: 'CityLive',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true, nodeIntegration: false, backgroundThrottling: false
      }
    });
    w._clDisplayId = d.id;                 // so every re-attach lands on THIS display, not the union
    w.setMenuBarVisibility(false);
    // Same guard on every extra display — a sibling that dies leaves ONE monitor blank, which is
    // even harder to attribute than all of them going at once.
    guardWindow(w, 'wallpaper-sibling', (ww) => {
      ww.loadFile(path.join(__dirname, 'renderer', 'index.html'), { search: dispSearch(d, uni) });
      ww.webContents.once('did-finish-load', () => { if (!ww.isDestroyed()) { try { wpAttach(ww); } catch (e) {} } });
    });
    w.loadFile(path.join(__dirname, 'renderer', 'index.html'), { search: dispSearch(d, uni) });
    w.webContents.once('did-finish-load', () => {
      if (!w.isDestroyed()) { try { wpAttach(w); } catch (e) {} }
    });
    extraWins.push(w);
  }
}
function destroySiblingWallpapers() {
  for (const w of extraWins) {
    try { if (w && !w.isDestroyed()) { try { wallpaper.detach(w); } catch (e) {} w.destroy(); } } catch (e) {}
  }
  extraWins = [];
}

// 🚨 EVERY ATTACH GOES THROUGH HERE, and the reason is Micah's report. `wallpaper.attach` used to
// resize whatever it was given to the WHOLE VIRTUAL DESKTOP — so the per-display windows this file
// creates were sized correctly and then immediately blown back up to the union, which is precisely the
// bug the per-display windows exist to fix. It now takes the display's PHYSICAL rect, and the only way
// to be sure every caller passes one is for there to be exactly one caller.
// ⚠ `dipToScreenRect` is the conversion that matters: `d.bounds` is in DIP and MoveWindow wants
// physical pixels. On a mixed-DPI desktop those are different numbers, which is the other half of what
// went wrong on his machine.
function wpAttach(w) {
  if (!w || w.isDestroyed()) return false;
  let rect = null;
  try {
    const scr = require('electron').screen;
    const id = w._clDisplayId;
    let d = null;
    if (id != null) { for (const dd of scr.getAllDisplays()) if (dd.id === id) { d = dd; break; } }
    if (!d) d = scr.getDisplayNearestPoint(w.getBounds());
    if (d) rect = scr.dipToScreenRect(null, d.bounds);
  } catch (e) { rect = null; }
  // 🧪 TEST HOOK — `CITYLIVE_WP_TESTRECT="x,y,w,h"` (physical px) forces the placement.
  // ⚠⚠ THIS EXISTS BECAUSE THE BUG IS UNREACHABLE OTHERWISE. The failure only appears on a
  // multi-monitor desktop, and the WinTest VM is single-head — the QXL driver is installed but with no
  // SPICE client attached the second head never comes up, so the case that broke for Micah cannot be
  // reproduced there. With this, ONE monitor is enough to prove the thing that actually changed: that
  // `attach` now puts the window where it is TOLD to, instead of stretching it over the whole virtual
  // screen. Pass half the screen; if the city fills half the screen, the fix is real.
  // 🔑 A harness that cannot express the case cannot verify the fix — the same reason `FORCEDIS.win`
  // and `disphase=` had to be built before their features could be judged.
  try {
    const tr = process.env.CITYLIVE_WP_TESTRECT;
    if (tr) {
      const n = tr.split(',').map(Number);
      if (n.length === 4 && n.every((v) => isFinite(v))) rect = { x: n[0], y: n[1], width: n[2], height: n[3] };
    }
  } catch (e) {}
  try { return wallpaper.attach(w, rect); } catch (e) { return false; }
}

function attachOrFallback(w) {
  if (!wpAttach(w)) { onWallpaperFailed('attach'); return; }
  wpFailStreak = 0;
  setTimeout(() => {
    if (!desktopWallpaper || win !== w || w.isDestroyed()) return;
    if (!wallpaper.isStillAttached(w)) onWallpaperFailed('dropped');
    else maybeShowFirstRunBalloon();   // attach VERIFIED — safe to greet the first-run user
  }, 1500);
}

// Recovery attach (after an Explorer restart recreated Progman): keep retrying for a few
// seconds before giving up, so a transient "Progman not ready yet" doesn't tear down the
// user's wallpaper and pop a dialog. Only falls back after the retries are exhausted.
function attachWithRetry(w, triesLeft) {
  if (quitting || !desktopWallpaper || !w || w.isDestroyed() || win !== w) return;
  if (wpAttach(w)) {
    setTimeout(() => {
      if (quitting || !desktopWallpaper || win !== w || w.isDestroyed()) return;
      if (wallpaper.isStillAttached(w)) return;                 // recovered
      if (triesLeft > 0) attachWithRetry(w, triesLeft - 1);
      else onWallpaperFailed('recover-dropped');
    }, 1200);
    return;
  }
  if (triesLeft > 0) setTimeout(() => attachWithRetry(w, triesLeft - 1), 1200);
  else onWallpaperFailed('recover-attach');
}

// The wallpaper window was destroyed out from under us — almost always because Explorer
// restarted (its Progman owns our reparented child window, so it dies with Explorer). A
// wallpaper must survive that: rebuild the window and re-attach to the NEW Progman instead
// of letting the app quit. Delayed so Explorer/Progman can finish respawning first.
function handleWallpaperWindowLost() {
  if (quitting || !desktopWallpaper) return;
  setTimeout(() => {
    if (quitting || !desktopWallpaper || (win && !win.isDestroyed())) return;
    createWindow({ wallpaper: true, recovering: true });
    if (wpWatch) { clearInterval(wpWatch); wpWatch = null; }
    startWallpaperWatch();
  }, 1500);
}

// Behind-icons couldn't be established (or was lost and won't come back). Reshape to a
// normal window — setDesktopWallpaper(false) does the full teardown, un-persists the pref
// and drops the login item so a broken mode can't relaunch every login — then explain.
function onWallpaperFailed(reason) {
  if (!desktopWallpaper) return;
  setDesktopWallpaper(false);
  showWallpaperFallbackDialog();
}

// Friendly "it didn't work, here's what you can do instead" dialog.
function showWallpaperFallbackDialog() {
  if (wpDialogShown) return;
  wpDialogShown = true;
  dialog.showMessageBox(win && !win.isDestroyed() ? win : undefined, {
    type: 'info',
    title: 'CityLive',
    message: "CityLive couldn't attach behind your desktop icons.",
    detail: 'Whether this works depends on your Windows / Explorer build. The city is now '
      + 'running as a normal window. You can instead use it as a screensaver, or set it as a '
      + 'true wallpaper with the free Lively Wallpaper app.',
    buttons: ['Use Screensaver Instead', 'Set Up Lively Wallpaper', 'Keep as a Window'],
    defaultId: 2,
    cancelId: 2
  }).then((r) => {
    if (r.response === 0) enableScreensaver();
    else if (r.response === 1) shell.openExternal('https://deluxescout1.github.io/citylive/setup.html').catch(() => {});
  }).catch(() => {});
}

// Watchdog: if Explorer restarts, the WorkerW dies and we lose our parent — re-attach.
// After a few straight failures, give up gracefully rather than thrash forever.
function startWallpaperWatch() {
  if (wpWatch) { clearInterval(wpWatch); wpWatch = null; }
  wpWatch = setInterval(() => {
    if (!desktopWallpaper) return;
    // THE SIBLINGS NEED THE WATCHDOG TOO. Explorer restarting kills every WorkerW, not just the
    // primary's — watching only `win` left the second monitor with a dead wallpaper until the app
    // was restarted. Re-attach them QUIETLY: a sibling that can't come back must not trip the
    // global give-up and take the working screens down with it.
    for (const w of extraWins) {
      try { if (w && !w.isDestroyed() && !wallpaper.isStillAttached(w)) wpAttach(w); } catch (e) {}
    }
    if (!win || win.isDestroyed()) return;
    if (wallpaper.isStillAttached(win)) { wpFailStreak = 0; return; }
    if (wpAttach(win)) { wpFailStreak = 0; }
    else if (++wpFailStreak >= 3) { onWallpaperFailed('watchdog'); }
  }, 4000);
}

// Turn the real "live wallpaper behind icons" mode on/off (Windows). On other
// platforms fall back to the legacy ambient full-screen look.
function setDesktopWallpaper(on) {
  if (process.platform !== 'win32' || !wallpaper.available()) return setWallpaperMode(on);
  desktopWallpaper = on;
  if (on) wpDialogShown = false;   // allow a fresh failure dialog for this attempt
  wpFailStreak = 0;
  persistWallpaperPref(on);
  syncLoginItem(on);
  // Frame/skip-taskbar/focusable are set at window creation, so re-create the window in
  // the right shape instead of mutating a live one. CREATE THE REPLACEMENT FIRST: the old
  // window's destroy() fires `closed` → `window-all-closed` SYNCHRONOUSLY (verified), and
  // that handler quits the app — destroy-first would kill us mid-toggle.
  const old = (win && !win.isDestroyed()) ? win : null;
  createWindow({ wallpaper: on });
  if (old) { wallpaper.detach(old); old.destroy(); }
  rebuildMenu();
  if (wpWatch) { clearInterval(wpWatch); wpWatch = null; }
  if (on) startWallpaperWatch();
}

// Reload the city so a settings change applies through the exact same startup path
// (one config code path — no separate "apply live" logic to drift out of sync).
function reloadCity() {
  if (win && !win.isDestroyed()) win.reload();
  for (const w of extraWins) { try { if (w && !w.isDestroyed()) w.reload(); } catch (e) {} }
}

// THE CONTROL CENTER: a separate window (renderer/settings.html) that controls the
// wallpaper without ever tearing it down — the city keeps running behind the icons while
// you edit settings. Replaces the old "drop the wallpaper to a window to reach Settings"
// excursion entirely. Reached from the tray, the app menu, the "CityLive Settings"
// desktop/Start-menu shortcut (--settings), and the screensaver Settings button (/c).
function openControlCenter(tab) {
  const wanted = tab === 'chronicle' ? 'chronicle' : 'settings';
  // ⚠⚠ A LIVE HANDLE IS NOT A LIVE WINDOW. This used to `show()` whatever `ccWin` pointed at, and if
  // that window's renderer had died the user got the black box again on every single launch — the
  // exact loop Micah was stuck in, because nothing here ever asked whether the thing was still alive.
  if (ccWin && !ccWin.isDestroyed() && ccWin.webContents && !ccWin.webContents.isCrashed()) {
    ccWin.show(); ccWin.focus(); ccWin.webContents.send('citylive:navigate', wanted); return;
  }
  if (ccWin && !ccWin.isDestroyed()) { try { ccWin.destroy(); } catch (e) {} }   // dead: rebuild it
  ccWin = null;
  ccWin = new BrowserWindow({
    width: 620, height: 760, minWidth: 480, minHeight: 520,
    title: 'CityLive Settings',
    backgroundColor: '#05070c',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const ccFile = path.join(__dirname, 'renderer', 'settings.html');
  // One retry, then a VISIBLE explanation. The window must never again be a silent black rectangle:
  // if it cannot show the Control Center it says so, and says what to do about it.
  let ccTried = 0;
  guardWindow(ccWin, 'control-center', (w) => {
    if (ccTried++ < 1) { w.loadFile(ccFile); return; }
    w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
      '<body style="background:#05070c;color:#cfe6ff;font:14px system-ui;padding:28px">' +
      '<h2 style="color:#5ad7ff">CityLive Settings could not load</h2>' +
      '<p>The settings page failed to render. This is usually a graphics-driver problem after a crash.</p>' +
      '<p>Quit CityLive from the tray icon and start it again — it clears its graphics cache automatically ' +
      'after an unclean shutdown. If it keeps happening, start it once with <b>--safe-mode</b>.</p></body>'));
  });
  ccWin.loadFile(ccFile);
  ccWin.webContents.once('did-finish-load', () => { pushStateToCC(); ccWin.webContents.send('citylive:navigate', wanted); });
  ccWin.on('closed', () => { ccWin = null; });
}

// Keep the Control Center's live readouts (wallpaper toggle, screensaver status) current.
function pushStateToCC() {
  if (!ccWin || ccWin.isDestroyed()) return;
  screensaver.isRegistered((ss) => {
    if (!ccWin || ccWin.isDestroyed()) return;
    ccWin.webContents.send('citylive:state', {
      wallpaper: desktopWallpaper,
      wallpaperAvailable: process.platform === 'win32' && wallpaper.available(),
      screensaver: !!ss,
      version: app.getVersion()
    });
  });
}

// Persist user settings while preserving the tri-state wallpaper flag. The Settings panel
// and reset build a fresh { birthdays, cycle, lat?, lon? } object with no knowledge of
// wallpaper mode, so a raw write would drop the key — which means "never decided" and
// would resurrect wallpaper mode on a machine where the user explicitly opted out.
function writeUserConfig(cfg) {
  const overlay = {};
  if (desktopWallpaper || wallpaperPref === true) overlay.wallpaper = true;
  else if (wallpaperPref === false) overlay.wallpaper = false;
  return store.writeConfig(CONFIG_PATH, Object.assign({}, cfg, overlay));
}

function resetSettings() {
  if (!CONFIG_PATH) return;
  writeUserConfig(store.DEFAULT_CONFIG);
  reloadCity();
}

// All config I/O for the renderer. MUST be registered before the window loads, because
// the preload calls the sync channel while the page is loading — if it isn't ready yet
// the friend's saved settings would silently vanish behind the defaults.
function registerConfigIpc() {
  // Synchronous: preload reads this as the page loads, before city.js's first frame.
  ipcMain.on('citylive:get-config-sync', (e) => {
    try { e.returnValue = JSON.stringify(store.readConfig(CONFIG_PATH)); }
    catch (err) { e.returnValue = JSON.stringify(store.DEFAULT_CONFIG); }
  });
  // Async: the Settings panel loads the current values to populate its fields.
  ipcMain.handle('citylive:get-config', () => store.readConfig(CONFIG_PATH));
  // The Control Center saves; persist then reload the city so the change takes effect —
  // the wallpaper stays attached behind the icons the whole time.
  ipcMain.handle('citylive:save-config', (e, cfg) => { const clean = writeUserConfig(cfg); reloadCity(); return clean; });
  ipcMain.handle('citylive:reset-config', () => { const def = writeUserConfig(store.DEFAULT_CONFIG); reloadCity(); return def; });
  ipcMain.handle('citylive:open-config-file', () => (CONFIG_PATH ? shell.openPath(CONFIG_PATH) : Promise.resolve('')));
  ipcMain.handle('citylive:get-version', () => app.getVersion());
  ipcMain.handle('citylive:open-chronicle', () => { openControlCenter('chronicle'); return true; });
  ipcMain.handle('citylive:get-chronicle', () => chronicle.read(CHRONICLE_PATH));
  ipcMain.handle('citylive:chronicle-record', (e, snapshot) => chronicle.record(CHRONICLE_PATH, snapshot));
  ipcMain.handle('citylive:chronicle-enabled', (e, enabled) => chronicle.setEnabled(CHRONICLE_PATH, enabled));
  ipcMain.handle('citylive:chronicle-clear', () => chronicle.clear(CHRONICLE_PATH));
  ipcMain.handle('citylive:chronicle-remove-life', (e, life) => chronicle.removeLife(CHRONICLE_PATH, life));
  ipcMain.handle('citylive:chronicle-export', async (e, format) => {
    const type = ['json','txt','png'].includes(format) ? format : 'txt';
    const data = chronicle.read(CHRONICLE_PATH), stamp = new Date().toISOString().slice(0,10);
    const pick = await dialog.showSaveDialog(ccWin || undefined, { title:'Export City Chronicle',
      defaultPath:'CityLive-Chronicle-'+stamp+'.'+type,
      filters:type==='png'?[{name:'PNG image',extensions:['png']}]:type==='json'?[{name:'JSON backup',extensions:['json']}]:[{name:'Text document',extensions:['txt']}] });
    if(pick.canceled || !pick.filePath) return false;
    if(type==='json') require('fs').writeFileSync(pick.filePath,JSON.stringify(data,null,2)+'\n');
    else if(type==='txt') require('fs').writeFileSync(pick.filePath,chronicle.toText(data));
    else { const rect=await e.sender.executeJavaScript(`(function(){var r=document.getElementById('cardChronicle').getBoundingClientRect();return{x:Math.max(0,Math.floor(r.x)),y:Math.max(0,Math.floor(r.y)),width:Math.ceil(r.width),height:Math.min(Math.ceil(r.height),4000)}})()`);
      const image=await e.sender.capturePage(rect); require('fs').writeFileSync(pick.filePath,image.toPNG()); }
    return true;
  });
  // Settings panel location lookup: city/ZIP/address → candidate {label,lat,lon,name}
  // list. Delegates to geocode.js (no Electron dependency, unit-tested standalone).
  ipcMain.handle('citylive:geocode', (e, q) => require('./geocode').lookup(q));
  // Environment facts the render page needs before its first frame: whether it's the
  // wallpaper (reserve street above the taskbar), and the primary display's logical width
  // (feature scale reference on a multi-monitor union canvas).
  ipcMain.on('citylive:get-env-sync', (e) => {
    try {
      const scr = require('electron').screen;
      const prim = scr.getPrimaryDisplay();
      let taskbarPx = 0;
      for (const d of scr.getAllDisplays()) {
        const bottomGap = (d.bounds.y + d.bounds.height) - (d.workArea.y + d.workArea.height);
        if (bottomGap > taskbarPx) taskbarPx = bottomGap;   // bottom taskbars only
      }
      e.returnValue = JSON.stringify({
        wallpaper: desktopWallpaper,
        taskbarPx: taskbarPx,
        primaryW: prim.bounds.width,
        primaryScale: prim.scaleFactor || 1,
        displayCount: scr.getAllDisplays().length
      });
    } catch (err) { e.returnValue = JSON.stringify({}); }
  });
  // Control Center actions
  ipcMain.handle('citylive:set-wallpaper', (e, on) => { setDesktopWallpaper(!!on); pushStateToCC(); return desktopWallpaper; });
  ipcMain.handle('citylive:refresh-wallpaper', () => { reloadCity(); return true; });
  ipcMain.handle('citylive:screensaver', (e, action) => new Promise((resolve) => {
    if (action === 'enable') screensaver.setRegistered(true, 300, () => { pushStateToCC(); resolve(true); });
    else if (action === 'disable') screensaver.setRegistered(false, 0, () => { pushStateToCC(); resolve(true); });
    else if (action === 'preview') { screensaver.preview(); resolve(true); }
    else screensaver.isRegistered((on) => resolve(!!on));
  }));
  ipcMain.handle('citylive:check-updates', async () => {
    if (!autoUpdater) return 'Updates unavailable in this build.';
    try {
      const r = await autoUpdater.checkForUpdates();
      const v = r && r.updateInfo && r.updateInfo.version;
      if (v && v !== app.getVersion()) return 'Update available: v' + v + ' — downloading now; CityLive will restart itself updated (your city continues exactly where it is).';
      return "You're up to date (v" + app.getVersion() + ').';
    } catch (err) {
      // No published release yet (404) or offline — both are fine, not errors to the user.
      return "You're up to date (v" + app.getVersion() + ').';
    }
  });
}

// Frameless, borderless full-screen "wallpaper" look. Not literally behind desktop
// icons (that is OS-specific), but a clean ambient full-screen mode you can send to
// the back and leave running. Toggle with the menu / tray / F11.
function setWallpaperMode(on) {
  if (!win) return;
  wallpaperMode = on;
  win.setFullScreen(on);
  win.setAlwaysOnTop(false);
  if (on) win.blur();
  rebuildMenu();
}

function toggleFullScreen() {
  if (!win) return;
  win.setFullScreen(!win.isFullScreen());
}

// Turn CityLive on/off as the Windows screensaver, with a friendly confirmation.
function enableScreensaver() {
  screensaver.setRegistered(true, 300, (err) => {
    if (err) return;
    dialog.showMessageBox({
      type: 'info', title: 'CityLive',
      message: 'CityLive is now your screensaver.',
      detail: 'It will start after 5 minutes idle. Change the wait time or turn it off any time in Windows Screen Saver settings.',
      buttons: ['Open Screen Saver Settings', 'OK'], defaultId: 1
    }).then((r) => { if (r.response === 0) shell.openExternal('ms-settings:lockscreen').catch(() => {}); });
  });
}
function disableScreensaver() { screensaver.setRegistered(false, 0, () => {}); }

function rebuildMenu() {
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';
  const screensaverItems = isWin ? [
    { type: 'separator' },
    { label: 'Use CityLive as Screen Saver', click: enableScreensaver },
    { label: 'Turn Off CityLive Screen Saver', click: disableScreensaver },
    { label: 'Preview Screen Saver', click: () => screensaver.preview() }
  ] : [];
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'CityLive',
      submenu: [
        { label: 'Open Control Center…', accelerator: 'CmdOrCtrl+,', click: () => openControlCenter('settings') },
        { label: 'City Chronicle…', accelerator: 'CmdOrCtrl+H', click: () => openControlCenter('chronicle') },
        { label: 'Open Config File', click: () => CONFIG_PATH && shell.openPath(CONFIG_PATH) },
        { label: 'Reset Settings to Defaults', click: resetSettings },
        { type: 'separator' },
        { label: 'Full Screen', accelerator: 'F11', click: toggleFullScreen },
        {
          label: isWin ? 'Desktop Wallpaper (behind icons)' : 'Wallpaper Mode',
          type: 'checkbox',
          checked: isWin ? desktopWallpaper : wallpaperMode,
          accelerator: 'CmdOrCtrl+Shift+W',
          click: (item) => (isWin ? setDesktopWallpaper(item.checked) : setWallpaperMode(item.checked))
        },
        // Escape hatch for the case we CAN'T auto-detect: the reparent succeeds but a given
        // Windows build composites our layer wrong (nothing in the API reveals this).
        ...(isWin ? [{
          label: 'Wallpaper didn’t work?',
          click: () => { if (desktopWallpaper) setDesktopWallpaper(false); wpDialogShown = false; showWallpaperFallbackDialog(); }
        }] : []),
        ...screensaverItems,
        { type: 'separator' },
        { label: 'Reload City', accelerator: 'CmdOrCtrl+R', click: () => win && win.reload() },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'viewMenu' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  rebuildTrayMenu();   // keep the tray (the only UI in wallpaper mode) in sync
}

// (Re)build the tray menu from CURRENT state. The tray is the canonical UI once the city
// is the wallpaper (the window is behind the icons and click-through), and a baked-once
// menu would show stale checkbox state after any mode change — so rebuildMenu() calls
// this every time state changes.
function rebuildTrayMenu() {
  if (!tray) return;
  const trayIsWin = process.platform === 'win32';
  tray.setToolTip('CityLive v' + app.getVersion());
  tray.setContextMenu(Menu.buildFromTemplate([
    // "Show"/"Full Screen" are meaningless while the window is glued behind the icons.
    ...(desktopWallpaper ? [] : [
      { label: 'Show', click: () => { if (win) { win.show(); win.focus(); } } },
      { label: 'Full Screen', click: toggleFullScreen }
    ]),
    { label: 'Control Center / Settings…', click: () => openControlCenter('settings') },
    { label: 'City Chronicle…', click: () => openControlCenter('chronicle') },
    { label: 'Open Config File', click: () => CONFIG_PATH && shell.openPath(CONFIG_PATH) },
    (trayIsWin
      ? { label: 'Desktop Wallpaper (behind icons)', type: 'checkbox', checked: desktopWallpaper, click: (i) => setDesktopWallpaper(i.checked) }
      : { label: 'Wallpaper Mode', type: 'checkbox', checked: wallpaperMode, click: (i) => setWallpaperMode(i.checked) }),
    ...(trayIsWin ? [{ label: 'Wallpaper didn’t work?', click: () => { if (desktopWallpaper) setDesktopWallpaper(false); wpDialogShown = false; showWallpaperFallbackDialog(); } }] : []),
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]));
}

function createTray() {
  try {
    const img = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png'));
    if (img.isEmpty()) return;
    tray = new Tray(img.resize({ width: 18, height: 18 }));
    rebuildTrayMenu();
    tray.on('click', () => { if (win && !desktopWallpaper) { win.isVisible() ? win.focus() : win.show(); } });
  } catch (e) { /* tray is optional; ignore on platforms without a system tray */ }
}

// One-time greeting after the FIRST successful auto-attach: with the window now behind the
// icons, a brand-new user has no idea where the app lives — point them at the tray.
function maybeShowFirstRunBalloon() {
  if (!firstRunBalloon || !tray) return;
  firstRunBalloon = false;
  try {
    tray.displayBalloon({
      title: 'CityLive is now your wallpaper',
      content: 'Right-click the CityLive icon in the taskbar corner (it may be under the ^ arrow) to change settings, add birthdays, or turn this off.'
    });
  } catch (e) { /* balloons are Windows-only + best-effort */ }
}

if (SS.preview) {
  // Windows preview thumbnail (/p): we don't paint into the tiny preview window, so
  // exit cleanly (Windows shows a blank preview) instead of popping a stray window.
  app.whenReady().then(() => app.quit());
} else if (SS.screensaver) {
  // Screensaver (/s): run full-screen and INDEPENDENTLY of any normal instance — do
  // not take the single-instance lock, or it would just focus a running app and quit.
  app.whenReady().then(() => {
    CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
    CHRONICLE_PATH = path.join(app.getPath('userData'), 'chronicle.json');
    store.ensureConfig(CONFIG_PATH);
    registerConfigIpc();
    createWindow();
    screensaver.applyToWindow(win);
  });
  app.on('window-all-closed', () => app.quit());
} else {
  // Normal app (double-click, or /c configure → open and show Settings).
  // Single-instance: focus the existing window instead of spawning a second city.
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', (e, argv) => {
      // The "CityLive Settings" shortcut (--settings) and the screensaver Settings button
      // (/c) relaunch the exe — route them to the Control Center in THIS instance.
      const flags = screensaver.parseFlags(argv || []);
      if ((argv || []).includes('--settings') || flags.config) { openControlCenter(); return; }
      if (win && !desktopWallpaper) { if (win.isMinimized()) win.restore(); win.focus(); }
      else openControlCenter();   // wallpaper mode has no reachable window — CC is the app
    });
    // A real exit (tray Quit / OS shutdown) must actually quit; a window merely being
    // destroyed by an Explorer restart must NOT (see window-all-closed below).
    app.on('before-quit', () => { quitting = true; });

    app.whenReady().then(() => {
      // Personal settings live in userData (survives auto-updates). Seed + wire the IPC
      // BEFORE createWindow, so the preload's sync request is answered as the page loads.
      CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
      CHRONICLE_PATH = path.join(app.getPath('userData'), 'chronicle.json');
      store.ensureConfig(CONFIG_PATH);
      registerConfigIpc();
      // It's a WALLPAPER app: on Windows a fresh install becomes the desktop background
      // with zero clicks. Tri-state `wallpaper` in config decides — true = on,
      // explicit false = the user turned it off (respect that forever, never auto-retry),
      // key absent = never decided → default ON (packaged Windows). --wallpaper (autostart)
      // remains an explicit ON request. One code path (setDesktopWallpaper) creates the
      // window, arms the watchdog and builds the menus; otherwise a normal window.
      const bootCfg = store.readConfig(CONFIG_PATH);
      wallpaperPref = ('wallpaper' in bootCfg) ? bootCfg.wallpaper : null;
      const wantWp = wallpaper.available() && wallpaperPref !== false &&
        (START_WALLPAPER || wallpaperPref === true ||
         (process.platform === 'win32' && app.isPackaged));   // first-run default: ON
      createTray();                                // tray first — it's the UI in wallpaper mode
      if (wantWp) {
        firstRunBalloon = (wallpaperPref === null);   // greet only the never-decided first run
        setDesktopWallpaper(true);
      } else {
        createWindow();
        rebuildMenu();
      }
      if (SS.config || START_SETTINGS) openControlCenter();   // /c (screensaver Settings) or --settings shortcut
      // Monitors added/removed/rescaled while we're the wallpaper: rebuild the window at
      // the new union so the one continuous city covers whatever is connected. Debounced —
      // Windows fires several metrics events per hotplug.
      let displayDebounce = null;
      const onDisplayChange = () => {
        if (!desktopWallpaper) return;
        clearTimeout(displayDebounce);
        displayDebounce = setTimeout(() => { if (desktopWallpaper && !quitting) setDesktopWallpaper(true); }, 2000);
      };
      try {
        const scr = require('electron').screen;
        scr.on('display-added', onDisplayChange);
        scr.on('display-removed', onDisplayChange);
        scr.on('display-metrics-changed', onDisplayChange);
      } catch (e) { /* screen module should exist post-ready; best effort */ }
      // Auto-update: check at startup AND every 6 hours — a wallpaper runs for months, one
      // launch-time check isn't enough. Silent; downloads in background, installs on next launch.
      // (electron-updater self-installs on Windows, macOS and the Linux AppImage.)
      const checkUpdates = () => { if (autoUpdater) { try { autoUpdater.checkForUpdatesAndNotify(); } catch (e) { /* offline / no release yet */ } } };
      // Linux .deb (dpkg-managed) can't self-install via electron-updater — so on a NON-AppImage packaged
      // Linux build, check the GitHub release manually and, if newer, show a clickable "update available"
      // notification pointing at the release (the user updates the .deb through their package manager).
      const semverNewer = (a, b) => {
        const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
        for (let i = 0; i < 3; i++) { const x = pa[i] || 0, y = pb[i] || 0; if (x !== y) return x > y; }
        return false;
      };
      const checkDebUpdate = () => {
        if (!(app.isPackaged && process.platform === 'linux' && !process.env.APPIMAGE)) return;
        try {
          require('https').get({ host: 'api.github.com', path: '/repos/Deluxescout1/citylive/releases/latest',
            headers: { 'User-Agent': 'CityLive', 'Accept': 'application/vnd.github+json' } }, (res) => {
            let body = ''; res.on('data', (d) => body += d); res.on('end', () => {
              try {
                const tag = (JSON.parse(body).tag_name || '').replace(/^v/, '');
                if (tag && semverNewer(tag, app.getVersion())) {
                  const url = 'https://github.com/Deluxescout1/citylive/releases/latest';
                  if (ccWin && !ccWin.isDestroyed()) ccWin.webContents.send('citylive:update-status',
                    'Update v' + tag + ' available — click to download (the .deb updates via your package manager).');
                  if (Notification.isSupported()) {
                    const n = new Notification({ title: 'CityLive v' + tag + ' available', body: 'Click to download the update.' });
                    n.on('click', () => shell.openExternal(url)); n.show();
                  }
                }
              } catch (e) { /* malformed / offline */ }
            });
          }).on('error', () => {}).setTimeout(15000, function () { this.destroy(); });
        } catch (e) { /* best effort */ }
      };
      const runUpdateChecks = () => { checkUpdates(); checkDebUpdate(); };
      runUpdateChecks();
      setInterval(runUpdateChecks, 6 * 3600 * 1000);
      // Forward updater status to the Control Center's Updates line.
      if (autoUpdater) {
        const fwd = (msg) => { if (ccWin && !ccWin.isDestroyed()) ccWin.webContents.send('citylive:update-status', msg); };
        autoUpdater.on('checking-for-update', () => fwd('Checking for updates…'));
        autoUpdater.on('update-available', (i) => fwd('Update available: v' + (i && i.version) + ' — downloading…'));
        autoUpdater.on('update-not-available', () => fwd("You're up to date (v" + app.getVersion() + ').'));
        autoUpdater.on('download-progress', (p) => fwd('Downloading update… ' + Math.round((p && p.percent) || 0) + '%'));
        autoUpdater.on('update-downloaded', (i) => {
          fwd('Update v' + (i && i.version) + ' downloaded — restarting to apply…');
          // APPLY IMMEDIATELY: the city is a pure function of the wall clock and all personal
          // settings/progress live in userData (outside the app bundle), so a silent in-place
          // restart resumes exactly where the world was — same buildings, same day, same life.
          setTimeout(() => {
            try { quitting = true; autoUpdater.quitAndInstall(true, true); }   // silent install + relaunch
            catch (e) { quitting = false; /* fall back to autoInstallOnAppQuit */ }
          }, 2500);   // a beat so the Control Center can show the message first
        });
        autoUpdater.on('error', () => fwd("You're up to date (v" + app.getVersion() + ').'));
      }
      app.on('activate', () => { if (win === null && !SS.screensaver) createWindow(); });
    });

    app.on('window-all-closed', () => {
      // If our wallpaper window vanished (Explorer restart destroyed Progman + our child)
      // and the user isn't actually quitting, resurrect it instead of exiting — otherwise
      // the live wallpaper would disappear until the next reboot.
      if (!quitting && desktopWallpaper && process.platform === 'win32' && wallpaper.available()) {
        handleWallpaperWindowLost();
        return;
      }
      if (process.platform !== 'darwin') app.quit();
    });
  }
}
