// CityLive — the performance guard for the Electron app.
//
// Decides, continuously and cheaply, whether each wallpaper surface is worth drawing at all, and at
// what tier. Three independent signals, all of which the Windows build previously ignored completely:
//
//   1. OCCLUSION — is this monitor's desktop actually visible? (occlusion.js, Win32)
//   2. POWER     — is the machine on battery, locked, or asleep? (Electron powerMonitor, all platforms)
//   3. HARDWARE  — how much machine is there? (perf-policy.js)
//
// 🔑 SUSPENSION IS THE WHOLE GAME. On KDE, suspending covered screens moved the wallpaper from 43.1%
// of a core to 10.6% — more than every JavaScript optimisation in this project's history combined, and
// by a wide margin. It works because the cost of a wallpaper is not the city; it is rasterising and
// uploading a full-screen canvas, which costs exactly the same whether it carries 200 people or none
// (that was ceiling-tested: deleting EVERY person, car and seated figure moved the real desktop 43.1%
// → 40.5%, inside noise). You cannot optimise your way out of painting. You can decline to paint.
//
// ⚠ WHY POLL AND NOT AN EVENT HOOK. `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` would be the elegant
// answer and it needs a Win32 message pump on the calling thread plus a cross-thread native callback —
// neither of which is safe to bolt onto Electron's main loop through an FFI. A poll of a handful of
// user32 calls is measured in microseconds; the elegance is not worth the class of crash.
//
// ⚠ THE POLL RATE IS DELIBERATELY INVERTED. Slow while drawing (noticing "I became covered" a second
// late costs one second of drawing we were doing anyway); fast while suspended (noticing "I became
// visible" late is a frozen wallpaper, which the user SEES). While suspended we are saving 100% of the
// draw cost, so the faster poll is free.

const policy = require('./perf-policy');

const POLL_VISIBLE_MS = 1500;   // drawing → a late "now covered" costs nothing
const POLL_HIDDEN_MS = 400;     // suspended → a late "now visible" is a frozen wallpaper

let cfg = null;
let timer = null;
let lastCovered = {};           // displayId -> bool, as last SENT to the renderers
let lastTier = null;
let powerState = { onBattery: false, locked: false, asleep: false };
let running = false;
let pollCost = { n: 0, totalMs: 0 };

function log(msg) { try { console.log('[citylive] throttle: ' + msg); } catch (e) {} }

// ── Tier ────────────────────────────────────────────────────────────────────────────────────────
// Recomputed only on DISCRETE events (startup, AC↔battery, display change, settings save). Nick's
// explicit call, and it is right: a guard that continuously retunes the frame rate reads as stutter,
// which is the exact complaint this whole effort exists to fix.
function machineFacts() {
  const os = require('os');
  const cores = (os.cpus() || []).length || 1;
  const memMB = Math.round(os.totalmem() / 1048576);
  let pixels = 0, displayCount = 1;
  try {
    const ds = cfg.screen.getAllDisplays();
    displayCount = ds.length || 1;
    // The BIGGEST surface we have to paint — a tier has to be affordable for the worst screen, not
    // the average one. (The old rule used whichever screen happened to be asking.)
    for (const d of ds) {
      const p = d.bounds.width * d.bounds.height * (d.scaleFactor || 1) * (d.scaleFactor || 1);
      if (p > pixels) pixels = p;
    }
  } catch (e) { /* pre-ready */ }
  return {
    cores: cores, memMB: memMB, pixels: pixels, displayCount: displayCount,
    onBattery: powerState.onBattery,
    userChoice: (cfg.getUserQuality && cfg.getUserQuality()) || null
  };
}

function recomputeTier(why) {
  const facts = machineFacts();
  const d = policy.decide(facts);
  if (d.tier === lastTier) return d;
  const prev = lastTier;
  lastTier = d.tier;
  log('tier ' + (prev || '—') + ' → ' + d.tier + ' (' + d.reason + '; ' + why + '; ' +
      facts.cores + ' cores, ' + facts.memMB + ' MB, ' + facts.displayCount + ' display(s)' +
      (facts.onBattery ? ', on battery' : '') + ')');
  send('citylive:throttle', { tier: d.tier, reason: d.reason });
  if (cfg.perflog) cfg.perflog.mark('tier', { tier: d.tier, reason: d.reason, why: why, facts: facts });
  return d;
}

// ── Suspension ──────────────────────────────────────────────────────────────────────────────────
function send(channel, payload, onlyDisplayId) {
  for (const e of cfg.getWindows() || []) {
    if (!e || !e.win || e.win.isDestroyed()) continue;
    if (onlyDisplayId != null && e.displayId !== onlyDisplayId) continue;
    try { e.win.webContents.send(channel, payload); } catch (err) { /* window going away */ }
  }
}

// A single evaluation: who is covered, is the machine locked/asleep, and does anything need telling.
function evaluate() {
  if (!running) return;
  const t0 = Date.now();
  const wins = cfg.getWindows() || [];
  if (!wins.length) return;

  // Locked or asleep suspends EVERYTHING regardless of what any window rect says — and it is the one
  // signal that works identically on Windows and Linux, which is why it is checked first.
  const globalOff = powerState.locked || powerState.asleep;

  let covered = {};
  if (!globalOff && cfg.occlusion && cfg.occlusion.available()) {
    try {
      const scr = cfg.screen;
      const displays = scr.getAllDisplays().map((d) => ({
        // ⚠ PHYSICAL PIXELS. `workArea` is DIP; `GetWindowRect` is physical. On a 150%-scaled Surface
        // those differ by half again, and comparing them raw makes every window look too small to
        // cover anything — the guard would then never fire and would look like it was working.
        id: d.id,
        rect: (() => { try { return scr.dipToScreenRect(null, d.workArea); } catch (e) { return d.workArea; } })()
      }));
      const own = [];
      for (const e of wins) { if (e.hwnd != null) own.push(e.hwnd); }
      covered = cfg.occlusion.coveredDisplays(displays, own);
    } catch (e) { covered = {}; }
  }

  for (const e of wins) {
    const want = globalOff || !!covered[e.displayId];
    if (lastCovered[e.displayId] === want) continue;
    lastCovered[e.displayId] = want;
    send('citylive:throttle', { suspended: want }, e.displayId);
    log('display ' + e.displayId + ' → ' + (want ? 'SUSPENDED (' + (globalOff ? (powerState.locked ? 'locked' : 'asleep') : 'desktop covered') + ')' : 'resumed'));
    if (cfg.perflog) cfg.perflog.mark('suspend', { display: e.displayId, suspended: want, locked: powerState.locked, asleep: powerState.asleep });
  }

  pollCost.n++; pollCost.totalMs += Date.now() - t0;
  reschedule();
}

// Any surface suspended → poll fast so a reveal is near-instant. All drawing → poll lazily.
function reschedule() {
  if (!running) return;
  let anyHidden = false;
  for (const k in lastCovered) if (lastCovered[k]) { anyHidden = true; break; }
  clearTimeout(timer);
  timer = setTimeout(evaluate, anyHidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS);
  if (timer.unref) timer.unref();
}

// ── Wiring ──────────────────────────────────────────────────────────────────────────────────────
// `opts.getWindows` → [{ win, displayId, hwnd }]. `hwnd` may be null off Windows.
// `opts.getUserQuality` → the explicit tier from config, or null for auto.
function start(opts) {
  cfg = Object.assign({ occlusion: null, perflog: null }, opts || {});
  if (!cfg.getWindows || !cfg.screen) return false;
  if (running) return true;
  running = true;
  lastCovered = {};

  const pm = cfg.powerMonitor;
  if (pm) {
    // 🔑 THESE ARE THE CROSS-PLATFORM HALF OF THE GUARD. Occlusion is Windows-only (there is no
    // portable way to ask X11 and Wayland the same question), but lock / sleep / battery work on
    // Windows and Linux alike — and on a laptop they cover the cases that matter most for battery
    // life, which is the half of "don't tank the machine" that CPU percentages never show.
    const set = (k, v, why) => { if (powerState[k] === v) return; powerState[k] = v; log(why); if (k === 'onBattery') recomputeTier(why); evaluateNow(); };
    try { pm.on('lock-screen', () => set('locked', true, 'screen locked')); } catch (e) {}
    try { pm.on('unlock-screen', () => set('locked', false, 'screen unlocked')); } catch (e) {}
    try { pm.on('suspend', () => set('asleep', true, 'system suspending')); } catch (e) {}
    try { pm.on('resume', () => set('asleep', false, 'system resumed')); } catch (e) {}
    try { pm.on('on-battery', () => set('onBattery', true, 'switched to battery')); } catch (e) {}
    try { pm.on('on-ac', () => set('onBattery', false, 'switched to AC')); } catch (e) {}
    // The screen physically turning off is the strongest possible "nobody can see this" signal.
    try { pm.on('shutdown', () => { running = false; }); } catch (e) {}
    try { powerState.onBattery = (typeof pm.isOnBatteryPower === 'function') ? pm.isOnBatteryPower() : false; } catch (e) {}
  }

  recomputeTier('startup');
  evaluate();
  return true;
}

function evaluateNow() { clearTimeout(timer); timer = setTimeout(evaluate, 0); if (timer.unref) timer.unref(); }

// Called when the set of windows changes (display hotplug rebuilds them all).
function windowsChanged() {
  lastCovered = {};
  recomputeTier('displays changed');
  evaluateNow();
}

// Called after a settings save — the user may have picked an explicit tier.
function settingsChanged() { recomputeTier('settings'); }

function stop() { running = false; clearTimeout(timer); timer = null; }

function state() {
  return {
    tier: lastTier,
    onBattery: powerState.onBattery, locked: powerState.locked, asleep: powerState.asleep,
    suspended: Object.keys(lastCovered).filter((k) => lastCovered[k]).length,
    surfaces: (cfg && cfg.getWindows) ? (cfg.getWindows() || []).length : 0,
    // Proves the guard is not itself the cost. If this ever climbs, the poll is the bug.
    pollAvgMs: pollCost.n ? Math.round((pollCost.totalMs / pollCost.n) * 100) / 100 : 0
  };
}

module.exports = { start, stop, windowsChanged, settingsChanged, state, evaluateNow };
