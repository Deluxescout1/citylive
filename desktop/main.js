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

  // Once the page is up, sink the window behind the desktop icons.
  if (wp) win.webContents.once('did-finish-load', () => { wallpaper.attach(win); });

  win.on('closed', () => { win = null; });
}

// Turn the real "live wallpaper behind icons" mode on/off (Windows). On other
// platforms fall back to the legacy ambient full-screen look.
function setDesktopWallpaper(on) {
  if (process.platform !== 'win32' || !wallpaper.available()) return setWallpaperMode(on);
  desktopWallpaper = on;
  // Frame/skip-taskbar/focusable are set at window creation, so re-create the window
  // in the right shape instead of trying to mutate a live one.
  if (win && !win.isDestroyed()) { const old = win; win = null; old.destroy(); }
  createWindow({ wallpaper: on });
  rebuildMenu();
  if (wpWatch) { clearInterval(wpWatch); wpWatch = null; }
  if (on) {
    // If Explorer restarts, the WorkerW dies and we lose our parent — re-attach.
    wpWatch = setInterval(() => {
      if (desktopWallpaper && win && !win.isDestroyed() && !wallpaper.isStillAttached(win)) wallpaper.attach(win);
    }, 4000);
  }
}

// Reload the city so a settings change applies through the exact same startup path
// (one config code path — no separate "apply live" logic to drift out of sync).
function reloadCity() { if (win && !win.isDestroyed()) win.reload(); }

// Ask the renderer to open its Settings panel.
function openSettings() { if (win) win.webContents.send('citylive:open-settings'); }

function resetSettings() {
  if (!CONFIG_PATH) return;
  store.writeConfig(CONFIG_PATH, store.DEFAULT_CONFIG);
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
  ipcMain.handle('citylive:save-config', (e, cfg) => { const clean = store.writeConfig(CONFIG_PATH, cfg); reloadCity(); return clean; });
  ipcMain.handle('citylive:reset-config', () => { const def = store.writeConfig(CONFIG_PATH, store.DEFAULT_CONFIG); reloadCity(); return def; });
  ipcMain.handle('citylive:open-config-file', () => (CONFIG_PATH ? shell.openPath(CONFIG_PATH) : Promise.resolve('')));
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
        { label: 'Settings / Birthdays…', accelerator: 'CmdOrCtrl+,', click: openSettings },
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
}

function createTray() {
  try {
    const img = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png'));
    if (img.isEmpty()) return;
    tray = new Tray(img.resize({ width: 18, height: 18 }));
    tray.setToolTip('CityLive');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show', click: () => { if (win) { win.show(); win.focus(); } } },
      { label: 'Full Screen', click: toggleFullScreen },
      (process.platform === 'win32'
        ? { label: 'Desktop Wallpaper (behind icons)', type: 'checkbox', checked: desktopWallpaper, click: (i) => setDesktopWallpaper(i.checked) }
        : { label: 'Wallpaper Mode', type: 'checkbox', checked: wallpaperMode, click: (i) => setWallpaperMode(i.checked) }),
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ]));
    tray.on('click', () => { if (win) { win.isVisible() ? win.focus() : win.show(); } });
  } catch (e) { /* tray is optional; ignore on platforms without a system tray */ }
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
      const startWp = START_WALLPAPER && wallpaper.available();
      createWindow(startWp ? { wallpaper: true } : undefined);
      if (startWp) {
        desktopWallpaper = true;
        wpWatch = setInterval(() => {
          if (desktopWallpaper && win && !win.isDestroyed() && !wallpaper.isStillAttached(win)) wallpaper.attach(win);
        }, 4000);
      }
      rebuildMenu();
      createTray();
      if (SS.config) win.webContents.once('did-finish-load', openSettings);
      // check for a newer released version (silent; installs on next launch). Never block startup on it.
      if (autoUpdater) { try { autoUpdater.checkForUpdatesAndNotify(); } catch (e) { /* offline / no release yet */ } }
      app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
    });

    app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  }
}
