'use strict';
// NOBODY ON THE STREET MAY BE A STATUE.
//
// Nick: "I am also seeing a bunch of people on the street that aren't moving, what is going on with
// them?" Two causes, both structural rather than accidental:
//
//  1. The amble was a SINE. Outside the ~2 hours a day anyone commutes, every citizen is ambling,
//     and the sine's PEAK speed was a median of 0.96 world px per SECOND — a full second to move
//     one pixel at their fastest — while a sine is slowest exactly where it spends most of its
//     time, at the two turnarounds.
//  2. Worse, every "stay at home" branch was a CONSTANT (`wx=homeX`). Those citizens were not slow,
//     they were mathematically incapable of moving. At 20:00 that was a third of the cast.
//
// These are the metrics that actually describe what an eye sees, so they are the ones pinned here.
// A pure count of "changed position at all" does NOT work — it scored the old broken sine HIGHER
// than the fix, because a person ticking one pixel per second counts as moving and looks frozen.

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

// One screen of Nick's desktop, at a given hour, watched in five-second glances.
function watch(hour, life) {
  const E = engine();
  E.NOFETCH = true;
  E.GROW_CYCLE = CYC;
  const d = new Date(EPOCH + life * CYC + Math.round(0.45 * CYC));
  d.setHours(hour, 0, 0, 0);
  E.NOWOVR = E.CLOCK = d.getTime();
  E.setup('neon', { cw: 854, ch: 480, woff: 776, ww: 2269, pxk: 3, zoom: 1, taskbarWp: 28, quality: 'balanced', frameMs: 125 });
  E.FORCEAGE = 0.85;
  E.weather.code = 0; E.weather.wind = 6; E.weather.temp = 62;
  const g = stub();
  let walking = 0, sampled = 0, frozen = 0, seen = 0;
  for (let w = 0; w < 10; w++) {
    const t0 = new Map();
    E.draw(g, 'live');
    for (const p of E.drawnNamed) t0.set(p.pid, p.sx);
    let mid = null;
    for (let f = 0; f < 40; f++) {                 // five seconds at 8fps
      E.NOWOVR = E.CLOCK = E.NOWOVR + 125;
      E.draw(g, 'live');
      if (f === 19) { mid = new Map(); for (const p of E.drawnNamed) mid.set(p.pid, p.sx); }
      if (f === 21) {
        for (const p of E.drawnNamed) {
          if (!mid.has(p.pid)) continue;
          sampled++;
          if (Math.abs(p.sx - mid.get(p.pid)) / 0.25 >= 1.5) walking++;   // >= 1.5 world px/s
        }
      }
    }
    for (const p of E.drawnNamed) { if (!t0.has(p.pid)) continue; seen++; if (p.sx === t0.get(p.pid)) frozen++; }
  }
  assert.ok(seen > 40, `only ${seen} citizen-observations — the scenario drew almost nobody`);
  return { walking: walking / sampled, frozen: frozen / seen };
}

// Midday and evening are the two cases that were worst: at 13:00 nobody is commuting, and at 20:00
// a third of the cast are homebodies the leisure block never reassigns.
for (const hour of [13, 20]) {
  test(`at ${hour}:00 almost nobody is still in the same spot after five seconds`, () => {
    const r = watch(hour, 76);
    assert.ok(r.frozen <= 0.15,
      `${(100 * r.frozen).toFixed(0)}% of people had not moved a pixel after 5 seconds ` +
      `(was 17% at 13:00 and 36% at 20:00 before the fix; budget is 15%)`);
  });
  test(`at ${hour}:00 a good share of the street is visibly walking`, () => {
    const r = watch(hour, 76);
    assert.ok(r.walking >= 0.22,
      `only ${(100 * r.walking).toFixed(0)}% were moving at a visible pace (>=1.5 world px/s); ` +
      `was 13% at 13:00 and 9% at 20:00 before the fix, budget is 22%`);
  });
}

test('the amble is still a pure, continuous function of (seed, now)', () => {
  // The whole reason a sine was chosen: no state, safe across a freeze, and identical on both sides
  // of a bezel where two screens draw the same citizen. A walk-stand-walk cycle has to keep that.
  const E = engine();
  E.NOFETCH = true;
  E.GROW_CYCLE = CYC;
  E.NOWOVR = E.CLOCK = EPOCH + 76 * CYC + Math.round(0.45 * CYC);
  E.setup('neon', { cw: 854, ch: 480, woff: 0, ww: 2269, pxk: 3, zoom: 1, quality: 'balanced', frameMs: 125 });
  const t = E.NOWOVR;
  for (const seed of [12345, 0xdeadbeef, 7, 99999991]) {
    // pure: same inputs, same answer, whenever it is asked
    const a = E.strollX(seed, 400, 17, t);
    const b = E.strollX(seed, 400, 17, t);
    assert.strictEqual(a, b, 'strollX is not a pure function of its arguments');
    // continuous: no jump between adjacent instants, including across a leg boundary
    let prev = E.strollX(seed, 400, 17, t);
    for (let k = 1; k <= 400; k++) {
      const now = t + k * 60;                       // 24 s at 60ms granularity
      const cur = E.strollX(seed, 400, 17, now);
      assert.ok(Math.abs(cur - prev) < 2.0,
        `strollX jumped ${Math.abs(cur - prev).toFixed(2)}px in 60ms for seed ${seed} — a teleport`);
      prev = cur;
    }
  }
});
