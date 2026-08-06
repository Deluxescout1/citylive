// CityLive — "is this monitor's desktop actually visible?" for Windows.
//
// 🚨 THE FINDING THIS IS BUILT ON (measured on KDE, 2026-07-26): a desktop wallpaper is NEVER marked
// invisible when a window covers it. Occluded by a fullscreen window measured 45.8% of a core vs 43.5%
// visible — i.e. the city was drawn at FULL PRICE behind every game, every video, every maximised
// browser. Suspending covered screens took the whole wallpaper from 43.1% → 10.6%. That is the largest
// single win ever measured on this project, and on Windows it does not exist at all.
//
// 🔑 WHY ELECTRON'S OWN CHECKS DO NOT WORK HERE. The renderer's frame loop guards on `document.hidden`,
// which is never true for a wallpaper: the window is reparented into Progman/WorkerW where it is always
// "visible", never minimised and never occluded as far as Chromium is concerned. And `webPreferences`
// sets `backgroundThrottling: false` deliberately, so Chromium's own throttling is switched off. There
// is no Electron API for occlusion on Windows. So we ask Win32 directly.
//
// ⚠⚠ COMPARE AGAINST THE WORK AREA, NOT THE SCREEN RECT. The KDE version of this guard shipped once and
// never fired a single time, because it tested the full screen: a MAXIMISED window covers the screen
// MINUS the panels (a browser 2327x1259 on a 1309-tall screen — exactly the 50 px panel short). What is
// left uncovered is the strip behind an opaque taskbar, which nobody can see. `display.workArea` is
// exactly the right rectangle, and it is the whole reason this guard is worth anything on a laptop,
// where a maximised window is the normal state of the machine.
//
// ⚠ `GetWindowRect` is in PHYSICAL pixels; `display.workArea` is in DIP. On a 150%-scaled Surface those
// are different numbers, so the caller converts with `screen.dipToScreenRect` before handing rects here.
// Mixing the two units silently makes every window look too small to cover anything, and the guard
// quietly never fires — the same failure mode as the KDE v1, arriving by a different route.

let koffi = null;
let u32 = null;
let dwm = null;
let EnumProto = null;
let bindFailed = false;

function isWin() { return process.platform === 'win32'; }

const GWL_EXSTYLE = -20;
const WS_EX_TOOLWINDOW = 0x00000080;
const WS_EX_NOACTIVATE = 0x08000000;
const DWMWA_CLOAKED = 14;

// Shell surfaces are not "windows covering the desktop" — Progman IS the desktop, WorkerW is the
// wallpaper host we live inside, and the tray/taskbar is the thing whose height `workArea` already
// removed. Counting any of them as an occluder would suspend the city permanently.
const SHELL_CLASSES = {
  Progman: 1, WorkerW: 1, Shell_TrayWnd: 1, Shell_SecondaryTrayWnd: 1,
  SysShadow: 1, Button: 1, TaskListThumbnailWnd: 1,
  'Windows.UI.Core.CoreWindow': 1, 'Xaml_WindowedPopupClass': 1,
  'Progman.SHELLDLL_DefView': 1, 'ForegroundStaging': 1,
  'MultitaskingViewFrame': 1, 'EdgeUiInputTopWndClass': 1
};

function ensureBindings() {
  if (u32) return true;
  if (bindFailed || !isWin()) return false;
  try {
    koffi = require('koffi');
    const lib = koffi.load('user32.dll');
    EnumProto = koffi.proto('bool __stdcall ClOccProc(void *hwnd, intptr_t lparam)');
    koffi.struct('ClRect', { left: 'int32_t', top: 'int32_t', right: 'int32_t', bottom: 'int32_t' });
    u32 = {
      EnumWindows: lib.func('bool __stdcall EnumWindows(void *proc, intptr_t lparam)'),
      IsWindowVisible: lib.func('bool __stdcall IsWindowVisible(void *hwnd)'),
      IsIconic: lib.func('bool __stdcall IsIconic(void *hwnd)'),
      GetWindowRect: lib.func('bool __stdcall GetWindowRect(void *hwnd, _Out_ ClRect *r)'),
      GetWindowLongPtr: lib.func('intptr_t __stdcall GetWindowLongPtrW(void *hwnd, int index)'),
      GetClassNameA: lib.func('int __stdcall GetClassNameA(void *hwnd, _Out_ char *buf, int max)'),
      GetShellWindow: lib.func('void* __stdcall GetShellWindow()')
    };
    // Cloaking is how Windows hides a UWP app that is "running" but not on screen, and how it hides
    // every window on a virtual desktop you are not looking at. A cloaked window has a perfectly good
    // full-screen rect and is completely invisible — counting it would suspend the city while the user
    // stares at their wallpaper. There is no user32 call for this; it lives in dwmapi.
    try {
      const d = koffi.load('dwmapi.dll');
      dwm = { DwmGetWindowAttribute: d.func('int __stdcall DwmGetWindowAttribute(void *hwnd, uint32_t attr, _Out_ void *val, uint32_t size)') };
    } catch (e) { dwm = null; }   // no dwmapi → treat nothing as cloaked, guard still works
    return true;
  } catch (e) {
    bindFailed = true;
    u32 = null;
    return false;
  }
}

function available() { return isWin() && ensureBindings(); }

const cloakBuf = Buffer.alloc(4);
function isCloaked(hwnd) {
  if (!dwm) return false;
  try {
    cloakBuf.writeInt32LE(0, 0);
    const hr = dwm.DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, cloakBuf, 4);
    if (hr !== 0) return false;
    return cloakBuf.readInt32LE(0) !== 0;
  } catch (e) { return false; }
}

const clsBuf = Buffer.alloc(256);
function classOf(hwnd) {
  try {
    const n = u32.GetClassNameA(hwnd, clsBuf, 255);
    if (!(n > 0)) return '';
    return clsBuf.toString('latin1', 0, n);
  } catch (e) { return ''; }
}

// Does `a` (a window rect) completely contain `b` (a display's work area)? Pure arithmetic, exported so
// the coverage rule can be tested off Windows — the same reason `clientRectFor` is exported from
// wallpaper.js. A maximised window's rect is normally slightly LARGER than the work area (Windows keeps
// invisible resize borders outside the visible frame), so exact equality would never match; `slack`
// forgives a few pixels the other way so a window that is one rounded-corner pixel short still counts.
function covers(a, b, slack) {
  const s = slack == null ? 2 : slack;
  return a.left - s <= b.x &&
         a.top - s <= b.y &&
         a.right + s >= b.x + b.width &&
         a.bottom + s >= b.y + b.height;
}

// `displays`: [{ id, rect:{x,y,width,height} }] — work areas in PHYSICAL pixels.
// `ownHwnds`: Set/array of our own window handles as strings, so the city never occludes itself.
// Returns { [displayId]: true } for displays whose desktop is completely hidden.
//
// Enumeration is top-of-z-order first, and we stop as soon as every display is accounted for, so the
// usual laptop case (one screen, one maximised window) costs a handful of syscalls.
function coveredDisplays(displays, ownHwnds) {
  const out = {};
  if (!available() || !displays || !displays.length) return out;
  const own = {};
  if (ownHwnds) for (const h of ownHwnds) { if (h != null) own[String(h)] = 1; }
  let remaining = displays.length;
  const rect = {};
  try {
    const cb = koffi.register((hwnd) => {
      try {
        if (own[String(koffi.address ? koffi.address(hwnd) : hwnd)]) return true;
        if (!u32.IsWindowVisible(hwnd)) return true;
        if (u32.IsIconic(hwnd)) return true;
        const ex = Number(u32.GetWindowLongPtr(hwnd, GWL_EXSTYLE));
        if (ex & WS_EX_TOOLWINDOW) return true;          // palettes, tray helpers — not real coverage
        const cls = classOf(hwnd);
        if (SHELL_CLASSES[cls]) return true;
        if (isCloaked(hwnd)) return true;                // background UWP / other virtual desktop
        if (!u32.GetWindowRect(hwnd, rect)) return true;
        const w = rect.right - rect.left, h = rect.bottom - rect.top;
        if (!(w > 0 && h > 0)) return true;
        for (const d of displays) {
          if (out[d.id]) continue;
          if (covers(rect, d.rect)) { out[d.id] = true; remaining--; }
        }
        return remaining > 0;                            // false stops the enumeration early
      } catch (e) { return true; }                       // one bad window must never abort the sweep
    }, koffi.pointer(EnumProto));
    try { u32.EnumWindows(cb, 0); } finally { koffi.unregister(cb); }
  } catch (e) { return {}; }                             // any failure = "nothing covered" = draw normally
  return out;
}

module.exports = { available, coveredDisplays, covers };
