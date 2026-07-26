'use strict';
// WEATHER MUST FALL AT THE SAME REAL SPEED ON EVERY SHELL, AND AT THE SPEED IT ALWAYS HAS.
//
// draw() used to advance its integrators by a dt hard-capped at 50ms — below the live-pass interval
// of every shell we ship, so the cap was hit every frame and the *apparent* speed became a function
// of the frame rate: 12fps x 50ms = 600ms of particle time per second, but KDE's 200ms "balanced"
// tier gave 5 x 50 = 250ms per second. That is the quarter-speed snow Nick saw as "slow".
//
// The fix derives dt from real elapsed time, so this now has to be pinned from BOTH sides:
//   1. every frame interval must produce the same travel per second of wall clock, and
//   2. that speed must still be the one that shipped — 50ms of particle time per 83ms frame.
// Miss (2) and the bug simply inverts: snow 4x too fast instead of 4x too slow.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'city.js'), 'utf8');
const CYC = 604800000, EPOCH = 1783972450746;

function engine() {
  let s = 0x9e3779b9;
  const M = Object.create(Math);
  M.random = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const sb = { console, Math: M, Date, JSON, Object, Array, String, Number, isNaN, parseInt, parseFloat, setTimeout, clearTimeout };
  sb.global = sb;
  vm.createContext(sb);
  vm.runInContext(SRC, sb, { filename: 'city.js' });
  return sb;
}
const stub = () => new Proxy({}, {
  get(_t, p) {
    if (p === 'measureText') return (x) => ({ width: String(x || '').length * 4 });
    if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => ({ addColorStop() {} });
    if (p === 'getImageData') return () => ({ data: [] });
    if (p === 'canvas') return { width: 854, height: 480 };
    return () => {};
  },
  set() { return true; }
});

// Total distance the snowfield travels over ONE SECOND of wall clock, at a given frame interval.
// Measured as the sum of per-frame downward advance, so flakes recycling off the bottom of the
// frame can't be mistaken for travel.
function snowTravelPerSecond(frameMs) {
  const E = engine();
  E.NOFETCH = true;
  E.GROW_CYCLE = CYC;
  E.NOWOVR = E.CLOCK = EPOCH + 55 * CYC + Math.round(0.45 * CYC);
  E.setup('neon', { cw: 854, ch: 480, woff: 0, ww: 2269, pxk: 3, zoom: 1, quality: 'balanced', frameMs: frameMs });
  E.FORCEAGE = 0.85;
  E.weather.code = 73;          // WMO 73 = moderate continuous snow
  E.weather.temp = 24;
  E.weather.wind = 0;           // no sway: measure fall, not drift
  const g = stub();
  E.draw(g, 'live');            // seed the flake field
  E.draw(g, 'live');
  assert.ok(E.flakes && E.flakes.length > 0, 'no snow was produced — the scenario is wrong, not the engine');

  let travel = 0;
  const frames = Math.round(1000 / frameMs);
  for (let f = 0; f < frames; f++) {
    const before = E.flakes.map(k => k.y);
    E.NOWOVR = E.CLOCK = E.NOWOVR + frameMs;
    E.draw(g, 'live');
    // per-flake advance, ignoring any flake that wrapped back to the top this frame
    let sum = 0, n = 0;
    E.flakes.forEach((k, i) => { const d = k.y - before[i]; if (d >= 0 && d < 200) { sum += d; n++; } });
    if (n) travel += sum / n;
  }
  return travel;
}

test('snow falls at the same real speed at 83ms and at 200ms', () => {
  const fast = snowTravelPerSecond(83);     // desktop / web / phone tier
  const slow = snowTravelPerSecond(200);    // KDE "balanced" — Nick's three screens
  const ratio = slow / fast;
  assert.ok(ratio > 0.9 && ratio < 1.1,
    `snowfall speed still depends on the frame rate: 200ms tier travels ${ratio.toFixed(2)}x ` +
    `what the 83ms tier does per second (${slow.toFixed(1)} vs ${fast.toFixed(1)} px/s)`);
});

test('that speed is the one that shipped — 50ms of particle time per 83ms frame', () => {
  // MOTION_RATE exists precisely to preserve the approved look. If someone "simplifies" it to 1,
  // frame-rate independence still holds but every shell's weather speeds up by 1.67x.
  const E = engine();
  assert.ok(Math.abs(E.MOTION_RATE - 50 / 83) < 1e-9,
    `MOTION_RATE is ${E.MOTION_RATE}, not 50/83 — the weather no longer runs at the speed that shipped`);
});

test('a resumed-from-sleep gap cannot fling the weather across the frame', () => {
  // The cap is the whole reason dt was ever clamped. It has to survive being made relative.
  const E = engine();
  E.NOFETCH = true;
  E.GROW_CYCLE = CYC;
  E.NOWOVR = E.CLOCK = EPOCH + 55 * CYC + Math.round(0.45 * CYC);
  E.setup('neon', { cw: 854, ch: 480, woff: 0, ww: 2269, pxk: 3, zoom: 1, quality: 'balanced', frameMs: 200 });
  E.FORCEAGE = 0.85;
  E.weather.code = 73; E.weather.temp = 24; E.weather.wind = 0;
  const g = stub();
  E.draw(g, 'live'); E.draw(g, 'live');
  const before = E.flakes.map(k => k.y);
  E.NOWOVR = E.CLOCK = E.NOWOVR + 3 * 3600 * 1000;      // three hours asleep
  E.draw(g, 'live');
  const worst = Math.max(...E.flakes.map((k, i) => k.y - before[i]).filter(d => d >= 0));
  assert.ok(worst < 480, `a single frame moved a flake ${worst.toFixed(0)}px — the sleep cap is not holding`);
});
