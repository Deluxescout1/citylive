// Desktop-wallpaper mode for Windows: reparent the city window BEHIND the desktop
// icons so it becomes the live wallpaper.
//
// This uses the exact same Win32 sequence as the proven `electron-as-wallpaper`
// library, just expressed through koffi (an N-API FFI, so it loads under Electron
// with no native rebuild):
//   1. FindWindow("Progman")
//   2. SendMessageTimeout(Progman, 0x052C, 0xD, 0x1)  -> asks Explorer to spawn the
//      wallpaper-host WorkerW behind the icon layer
//   3. EnumWindows: find the window that OWNS "SHELLDLL_DefView" (the icons) and take
//      the "WorkerW" that is its next sibling; fall back to Progman's WorkerW child
//   4. SetParent(ourWindow, thatWorkerW) + make it click-through
//
// Everything is best-effort and Windows-only; on other platforms these are no-ops so
// the caller can treat the module uniformly.

let koffi = null;
let u32 = null;         // resolved user32 functions
let EnumProto = null;

function isWin() { return process.platform === 'win32'; }

// Lazily load koffi + bind the handful of user32 calls we need. Returns false if
// unavailable (non-Windows, or koffi failed to load) so callers degrade gracefully.
function ensureBindings() {
  if (u32) return true;
  if (!isWin()) return false;
  try {
    koffi = require('koffi');
    const lib = koffi.load('user32.dll');
    EnumProto = koffi.proto('bool __stdcall EnumProc(void *hwnd, intptr_t lparam)');
    u32 = {
      FindWindowA: lib.func('void* __stdcall FindWindowA(const char *cls, const char *win)'),
      FindWindowExA: lib.func('void* __stdcall FindWindowExA(void *parent, void *after, const char *cls, const char *win)'),
      SendMessageTimeoutA: lib.func('intptr_t __stdcall SendMessageTimeoutA(void *hwnd, uint msg, uintptr_t wp, intptr_t lp, uint flags, uint timeout, void *res)'),
      EnumWindows: lib.func('bool __stdcall EnumWindows(void *proc, intptr_t lparam)'),
      GetParent: lib.func('void* __stdcall GetParent(void *hwnd)'),
      SetParent: lib.func('void* __stdcall SetParent(void *child, void *parent)'),
      GetWindowLongPtr: lib.func('intptr_t __stdcall GetWindowLongPtrW(void *hwnd, int index)'),
      SetWindowLongPtr: lib.func('intptr_t __stdcall SetWindowLongPtrW(void *hwnd, int index, intptr_t value)'),
      SetLayeredWindowAttributes: lib.func('bool __stdcall SetLayeredWindowAttributes(void *hwnd, uint32_t key, uint8_t alpha, uint32_t flags)'),
      MoveWindow: lib.func('bool __stdcall MoveWindow(void *hwnd, int x, int y, int w, int h, bool repaint)'),
      GetSystemMetrics: lib.func('int __stdcall GetSystemMetrics(int index)')
    };
    return true;
  } catch (e) {
    u32 = null;
    return false;
  }
}

function available() { return isWin() && ensureBindings(); }

// Electron hands us the HWND as an 8-byte (x64) buffer holding the pointer VALUE;
// koffi accepts a BigInt as a pointer address.
function hwndOf(win) {
  const buf = win.getNativeWindowHandle();
  return process.arch === 'x64' ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0));
}

// Locate the wallpaper-host WorkerW (see sequence above). Returns a koffi pointer or null.
function findWorkerW() {
  const progman = u32.FindWindowA('Progman', null);
  u32.SendMessageTimeoutA(progman, 0x052C, 0xD, 0x1, 0x0 /*SMTO_NORMAL*/, 1000, null);
  let worker = null;
  const cb = koffi.register((top /* void* */) => {
    const defview = u32.FindWindowExA(top, null, 'SHELLDLL_DefView', null);
    if (defview) {
      const ww = u32.FindWindowExA(null, top, 'WorkerW', null);
      if (ww) worker = ww;
    }
    return true;
  }, koffi.pointer(EnumProto));
  try { u32.EnumWindows(cb, 0); } finally { koffi.unregister(cb); }
  if (!worker) worker = u32.FindWindowExA(progman, null, 'WorkerW', null); // Win11 fallback
  return worker || null;
}

const GWL_EXSTYLE = -20;
const WS_EX_LAYERED = 0x80000, WS_EX_TRANSPARENT = 0x20, WS_EX_TOOLWINDOW = 0x80;
const SM_CXVIRTUALSCREEN = 78, SM_CYVIRTUALSCREEN = 79;

let attachedHwnd = null;

// Reparent `win` behind the desktop icons. Returns true on success.
function attach(win) {
  if (!available() || !win) return false;
  try {
    const hwnd = hwndOf(win);
    const worker = findWorkerW();
    if (!worker) return false;
    u32.SetParent(hwnd, worker);
    // Click-through + keep out of Alt-Tab (WS_EX_TRANSPARENT|TOOLWINDOW), and layered so
    // Windows composites it like a wallpaper (matches the proven library's approach).
    const ex = Number(u32.GetWindowLongPtr(hwnd, GWL_EXSTYLE));
    u32.SetWindowLongPtr(hwnd, GWL_EXSTYLE, ex | WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW);
    u32.SetLayeredWindowAttributes(hwnd, 0, 255, 0x02 /*LWA_ALPHA*/);
    // Cover the whole virtual desktop (relative to the WorkerW origin).
    const vw = u32.GetSystemMetrics(SM_CXVIRTUALSCREEN);
    const vh = u32.GetSystemMetrics(SM_CYVIRTUALSCREEN);
    u32.MoveWindow(hwnd, 0, 0, vw, vh, true);
    attachedHwnd = hwnd;
    return true;
  } catch (e) {
    return false;
  }
}

// Pop the window back out to a normal top-level window.
function detach(win) {
  if (!available() || !win) return false;
  try {
    const hwnd = hwndOf(win);
    u32.SetParent(hwnd, null);
    const ex = Number(u32.GetWindowLongPtr(hwnd, GWL_EXSTYLE));
    u32.SetWindowLongPtr(hwnd, GWL_EXSTYLE, ex & ~(WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW));
    attachedHwnd = null;
    return true;
  } catch (e) {
    return false;
  }
}

// True if the given window is still parented into a WorkerW (used by the watchdog to
// notice when Explorer restarted and dropped us).
function isStillAttached(win) {
  if (!available() || !win) return false;
  try { return !!u32.GetParent(hwndOf(win)); } catch (e) { return false; }
}

module.exports = { available, attach, detach, isStillAttached };
