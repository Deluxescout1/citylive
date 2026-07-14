// CityLive — Electron main process.
// Opens the pixel-city engine in a native window on Windows, macOS and Linux.
// The renderer (renderer/index.html + renderer/city.js) is the exact same engine
// that powers the KDE Plasma wallpaper, so the city looks identical everywhere.

const { app, BrowserWindow, Menu, Tray, nativeImage, shell } = require('electron');
const path = require('path');

// Auto-update from GitHub Releases: when you tag a new version and CI publishes a release, installed
// apps download it in the background and apply it on the next launch. Optional in dev (module may be absent).
let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) { /* dev without the dep → no updates */ }

// A single shared render process is plenty; allow GPU canvas acceleration.
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.disableHardwareAcceleration && false; // (keep HW accel on for smooth canvas)

let win = null;
let tray = null;
let wallpaperMode = false;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 480,
    minHeight: 320,
    backgroundColor: '#05070c',
    title: 'CityLive',
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
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

  win.on('closed', () => { win = null; });
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

function rebuildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'CityLive',
      submenu: [
        { label: 'Full Screen', accelerator: 'F11', click: toggleFullScreen },
        {
          label: 'Wallpaper Mode',
          type: 'checkbox',
          checked: wallpaperMode,
          accelerator: 'CmdOrCtrl+Shift+W',
          click: (item) => setWallpaperMode(item.checked)
        },
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
      { label: 'Wallpaper Mode', type: 'checkbox', checked: wallpaperMode, click: (i) => setWallpaperMode(i.checked) },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ]));
    tray.on('click', () => { if (win) { win.isVisible() ? win.focus() : win.show(); } });
  } catch (e) { /* tray is optional; ignore on platforms without a system tray */ }
}

// Single-instance: focus the existing window instead of spawning a second city.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

  app.whenReady().then(() => {
    createWindow();
    rebuildMenu();
    createTray();
    // check for a newer released version (silent; installs on next launch). Never block startup on it.
    if (autoUpdater) { try { autoUpdater.checkForUpdatesAndNotify(); } catch (e) { /* offline / no release yet */ } }
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
