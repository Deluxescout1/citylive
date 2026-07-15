// Windows screensaver integration.
//
// A Windows screensaver (.scr) is just a normal .exe with a different extension.
// Our NSIS installer drops a copy of the app exe named "CityLive.scr" next to it,
// and Windows launches that .scr with one of:
//     /s            run the screensaver full-screen (what fires on idle)
//     /c[:hwnd]     show the configuration UI
//     /p <hwnd>     draw a small preview into the given window
// This module parses those flags and drives the window accordingly, and it can
// register/unregister CityLive as the active screensaver (HKCU — no elevation).

const { app } = require('electron');
const path = require('path');
const { execFile } = require('child_process');

// Parse the screensaver flag Windows passed. argv[0] is the exe; flags may be
// "/s", "/S", "/c", "/c:12345", "/p 12345", etc.
function parseFlags(argv) {
  const a = (argv || []).slice(1).map((s) => String(s).toLowerCase());
  const has = (f) => a.some((s) => s === f || s.startsWith(f + ':'));
  return { screensaver: has('/s'), config: has('/c'), preview: has('/p') };
}

// Turn a normal window into a screensaver surface: full-screen kiosk, on top of
// everything, no chrome, and quit on real user input (with a short grace period so
// the cursor settling at launch doesn't dismiss it instantly).
function applyToWindow(win) {
  if (!win) return;
  try {
    win.setMenu(null);
    win.setMenuBarVisibility(false);
    win.setKiosk(true);
    win.setAlwaysOnTop(true, 'screen-saver');
    win.focus();
  } catch (e) { /* best effort */ }

  const start = Date.now();
  const quit = () => app.quit();
  win.webContents.on('input-event', (_e, input) => {
    if (Date.now() - start < 1000) return; // ignore initial cursor settle
    if (input.type === 'mouseMove' || input.type === 'mouseDown' || input.type === 'keyDown') quit();
  });
}

// Full path to the installed .scr (created next to the exe by the installer).
function scrPath() {
  return path.join(path.dirname(app.getPath('exe')), 'CityLive.scr');
}

// Register (or clear) CityLive as the current Windows screensaver. HKCU only, so no
// admin prompt. timeoutSeconds defaults to 5 minutes when enabling.
function setRegistered(on, timeoutSeconds, cb) {
  cb = cb || (() => {});
  if (process.platform !== 'win32') return cb(new Error('screensaver registration is Windows-only'));
  const key = 'HKCU\\Control Panel\\Desktop';
  const reg = (args, next) => execFile('reg', args, (err) => next && next(err));
  if (on) {
    reg(['add', key, '/v', 'SCRNSAVE.EXE', '/t', 'REG_SZ', '/d', scrPath(), '/f'], () =>
      reg(['add', key, '/v', 'ScreenSaveActive', '/t', 'REG_SZ', '/d', '1', '/f'], () =>
        reg(['add', key, '/v', 'ScreenSaveTimeOut', '/t', 'REG_SZ', '/d', String(timeoutSeconds || 300), '/f'], cb)));
  } else {
    // Leave other screensavers alone; just clear ours and mark inactive.
    reg(['delete', key, '/v', 'SCRNSAVE.EXE', '/f'], () =>
      reg(['add', key, '/v', 'ScreenSaveActive', '/t', 'REG_SZ', '/d', '0', '/f'], cb));
  }
}

// Is CityLive.scr the currently-registered screensaver?
function isRegistered(cb) {
  if (process.platform !== 'win32') return cb(false);
  execFile('reg', ['query', 'HKCU\\Control Panel\\Desktop', '/v', 'SCRNSAVE.EXE'], (err, stdout) => {
    cb(!err && typeof stdout === 'string' && stdout.toLowerCase().includes('citylive.scr'));
  });
}

// Launch the installed screensaver full-screen, exactly as Windows would on idle.
function preview() {
  if (process.platform !== 'win32') return;
  try { execFile(scrPath(), ['/s']); } catch (e) { /* not installed yet */ }
}

module.exports = { parseFlags, applyToWindow, setRegistered, isRegistered, preview, scrPath };
