// CityLive — Electron main process.
// Opens the pixel-city engine in a native window on Windows, macOS and Linux.
// The renderer (renderer/index.html + renderer/city.js) is the exact same engine
// that powers the KDE Plasma wallpaper, so the city looks identical everywhere.

const { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const store = require('./config-store');
const screensaver = require('./screensaver');
const wallpaper = require('./wallpaper');

// Windows may launch us as a screensaver (.scr) with /s, /c or /p. Detect that up front;
// it changes how the window is created and whether we take the single-instance lock.
const SS = screensaver.parseFlags(process.argv);
// --wallpaper: start straight into behind-the-icons desktop wallpaper mode (Windows).
const START_WALLPAPER = process.argv.includes('--wallpaper');

// Where the friend's personal settings (birthdays / location / speed) live. This is in
// the OS user-data folder, OUTSIDE the app bundle, so auto-updates never overwrite it.
// Set once the app is ready (needs app.getPath). All config I/O goes through config-store.
let CONFIG_PATH = null;

// Auto-update from GitHub Releases: when you tag a new version and CI publishes a release, installed
// apps download it in the background and apply it on the next launch. Optional in dev (module may be absent).
let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) { /* dev without the dep → no updates */ }

// A single shared render process is plenty; allow GPU canvas acceleration.
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.disableHardwareAcceleration && false; // (keep HW accel on for smooth canvas)

let win = null;
let tray = null;
let wallpaperMode = false;       // legacy ambient full-screen (non-Windows fallback)
let desktopWallpaper = false;    // real behind-the-icons wallpaper (Windows)
let wpWatch = null;              // watchdog timer that re-attaches after Explorer restarts
let wpFailStreak = 0;            // consecutive failed (re)attaches before we give up + fall back
let wpDialogShown = false;       // latch so one failed attempt shows the fallback dialog once
let wallpaperPref = null;        // tri-state mirror of config `wallpaper`: true/false/null(=never decided)
let suspendedForSettings = false;// wallpaper temporarily dropped to a window so Settings is reachable
let firstRunBalloon = false;     // show the one-time "this is your wallpaper now" tray balloon

function createWindow(opts) {
  const wp = !!(opts && opts.wallpaper);
  const bare = SS.screensaver || wp;   // screensaver + wallpaper both want a chromeless full window
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 480,
    minHeight: 320,
    fullscreen: bare,
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

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // External links (if any) open in the user's real browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Once the page is up, sink the window behind the desktop icons — and verify it took.
  if (wp) win.webContents.once('did-finish-load', () => { attachOrFallback(win); });

  // Only null the module ref if it still points at THIS window — during a wallpaper-mode
  // swap the old window's `closed` fires after the replacement was already assigned.
  const self = win;
  win.on('closed', () => { if (win === self) win = null; });
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
function attachOrFallback(w) {
  if (!wallpaper.attach(w)) { onWallpaperFailed('attach'); return; }
  wpFailStreak = 0;
  setTimeout(() => {
    if (!desktopWallpaper || win !== w || w.isDestroyed()) return;
    if (!wallpaper.isStillAttached(w)) onWallpaperFailed('dropped');
    else maybeShowFirstRunBalloon();   // attach VERIFIED — safe to greet the first-run user
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
    if (!desktopWallpaper || !win || win.isDestroyed()) return;
    if (wallpaper.isStillAttached(win)) { wpFailStreak = 0; return; }
    if (wallpaper.attach(win)) { wpFailStreak = 0; }
    else if (++wpFailStreak >= 3) { onWallpaperFailed('watchdog'); }
  }, 4000);
}

// Turn the real "live wallpaper behind icons" mode on/off (Windows). On other
// platforms fall back to the legacy ambient full-screen look.
// opts.temporary = a Settings excursion, not a user decision: don't persist, don't touch
// the login item (the wallpaper resumes when Settings closes).
function setDesktopWallpaper(on, opts) {
  if (process.platform !== 'win32' || !wallpaper.available()) return setWallpaperMode(on);
  const temporary = !!(opts && opts.temporary);
  desktopWallpaper = on;
  if (on) wpDialogShown = false;   // allow a fresh failure dialog for this attempt
  wpFailStreak = 0;
  if (!temporary) {
    suspendedForSettings = false;  // an explicit decision cancels any pending Settings resume
    persistWallpaperPref(on);
    syncLoginItem(on);
  }
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
function reloadCity() { if (win && !win.isDestroyed()) win.reload(); }

// Ask the renderer to open its Settings panel.
function openSettings() { if (win) win.webContents.send('citylive:open-settings'); }

// Open Settings so it's actually usable. In wallpaper mode the window sits BEHIND the
// desktop icons and is click-through, so its in-window Settings panel can't be reached —
// TEMPORARILY drop to a normal window (no persistence: opening Settings must not turn
// the wallpaper off), then resume wallpaper mode when the panel closes or saves.
function openSettingsInteractive() {
  if (desktopWallpaper) {
    suspendedForSettings = true;
    setDesktopWallpaper(false, { temporary: true });
    if (win) win.webContents.once('did-finish-load', openSettings);
  } else {
    if (win) { win.show(); win.focus(); }
    openSettings();
  }
}

// Return to wallpaper mode after a Settings excursion. Idempotent: the flag is the gate,
// and any explicit user toggle in the meantime clears it (see setDesktopWallpaper).
function resumeWallpaperIfSuspended() {
  if (!suspendedForSettings) return;
  suspendedForSettings = false;
  setDesktopWallpaper(true, { temporary: true });  // pref is already true; nothing to rewrite
}

// Persist user settings while preserving the tri-state wallpaper flag. The Settings panel
// and reset build a fresh { birthdays, cycle, lat?, lon? } object with no knowledge of
// wallpaper mode, so a raw write would drop the key — which means "never decided" and
// would resurrect wallpaper mode on a machine where the user explicitly opted out.
function writeUserConfig(cfg) {
  const overlay = {};
  if (desktopWallpaper || suspendedForSettings || wallpaperPref === true) overlay.wallpaper = true;
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
  // Async: the Settings panel saves; we persist then reload so the change takes effect.
  // After a save/reset during a Settings excursion, resume wallpaper mode instead of a
  // plain reload — the window recreation reloads the config anyway. Deferred a tick so
  // the invoke's reply reaches the renderer before its window is destroyed.
  const applyAndReturn = (clean) => {
    if (suspendedForSettings) setImmediate(resumeWallpaperIfSuspended);
    else reloadCity();
    return clean;
  };
  ipcMain.handle('citylive:save-config', (e, cfg) => applyAndReturn(writeUserConfig(cfg)));
  ipcMain.handle('citylive:reset-config', () => applyAndReturn(writeUserConfig(store.DEFAULT_CONFIG)));
  ipcMain.handle('citylive:open-config-file', () => (CONFIG_PATH ? shell.openPath(CONFIG_PATH) : Promise.resolve('')));
  ipcMain.handle('citylive:get-version', () => app.getVersion());
  // The Settings panel was dismissed without saving (Cancel/Escape) — resume the wallpaper.
  ipcMain.on('citylive:settings-closed', () => { resumeWallpaperIfSuspended(); });
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
        { label: 'Settings / Birthdays…', accelerator: 'CmdOrCtrl+,', click: openSettingsInteractive },
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
    { label: 'Settings / Birthdays…', click: openSettingsInteractive },
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
    app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

    app.whenReady().then(() => {
      // Personal settings live in userData (survives auto-updates). Seed + wire the IPC
      // BEFORE createWindow, so the preload's sync request is answered as the page loads.
      CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
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
      if (SS.config) win.webContents.once('did-finish-load', openSettings);
      // check for a newer released version (silent; installs on next launch). Never block startup on it.
      if (autoUpdater) { try { autoUpdater.checkForUpdatesAndNotify(); } catch (e) { /* offline / no release yet */ } }
      app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
    });

    app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  }
}
