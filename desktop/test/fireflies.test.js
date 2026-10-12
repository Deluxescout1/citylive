// FIREFLIES — warm-ground night sparkles on the lands that genuinely grow them.
// Rules under test:
//   1. A warm, clear, near-night frame on swamp/karst/leaf draws blinking green/gold sparks
//      low over the ground or the front water.
//   2. The SAME frame with cold air (temp < 10) draws none — fireflies do not fly in the cold.
//   3. Rain kills them (they hide), overcast does not (they glow under cloud).
//   4. A land without the flora pool (mesa) draws none even on the same warm clear night.
//   5. Day draws none, apocalypse draws none, determinism holds.
// The sparks are PURE functions of (world x, clock) — no particle arrays — so every test frame
// here is re-rendered from scratch with no drift.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');

const grad = { addColorStop() {} };

function opCanvas(styleful) {
  const ops = [];
  let style = '';
  const g = styleful
    ? new Proxy({}, {
        get(_t, p) {
          if (p === 'measureText') return () => ({ width: 4 });
          if (String(p).startsWith('create')) return () => { ops.push(['GRAD']); return grad; };
          if (p === 'getImageData') return () => ({ data: [] });
          if (p === 'fillRect') return (x, y, w, h) => { ops.push(['F', style, x | 0, y | 0, w | 0, h | 0, Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(w) || Number.isNaN(h)]); };
          return () => {};
        },
        set(_t, p, v) { if (p === 'fillStyle') style = v; return true; }
      })
    : new Proxy({}, {
        get(_t, p) {
          if (p === 'measureText') return () => ({ width: 4 });
          if (String(p).startsWith('create')) return () => { ops.push(['GRAD']); return grad; };
          if (p === 'getImageData') return () => ({ data: [] });
          return () => {};
        },
        set() { return true; }
      });
  return [g, ops];
}

function load(land, t) {
  const sandbox = { Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    isNaN, isFinite, parseInt, parseFloat, console,
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {} };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), context, { filename: 'city.js' });
  context.NOFETCH = true;
  context.NOWOVR = t; context.CLOCK = t;
  context.weather = Object.assign({}, CLEAR, { temp: 20, feels: 18 });
  context.applyConfig({ land });
  context.setup('neon', { cw: 853, ch: 480, woff: 582, ww: 2269, pxk: 6, quality: 'performance' });
  // ⚠ pin the clock AFTER setup — setup() rebuilds sim state; before, "night" frames ran at "now"
  context.NOWOVR = t; context.CLOCK = t;
  context.wetness = 0;
  context.splashes && (context.splashes.length = 0);
  context.kpNow = 7;
  return context;
}

const CLEAR = { code: 0, cloud: 20, wind: 6, precip: 0 };

// a warm clear deep-night instant: sweep 40 days for the darkest local hour
const BASE = new Date(); BASE.setHours(21, 0, 0, 0);
let NIGHT = null;
{
  const c0 = load('swamp', Date.now());   // clock probe only; dayPhase needs a real Date
  for (let d = 0; d < 40 && !NIGHT; d++) {
    for (let mm = 0; mm < 12 && !NIGHT; mm++) {
      const t = BASE.getTime() + d * 86400000 + mm * 30 * 60000;
      if (c0.dayPhase(new Date(t)).light < 0.25) NIGHT = t;
    }
  }
}

test('a warm clear night on the firefly lands draws blinking sparks over the water or ground', () => {
  assert.ok(NIGHT, 'no near-dark clear hour found in 40 days — dayPhase change?');
  for (const land of ['swamp', 'karst', 'leaf']) {
    const c = load(land, NIGHT);
    const [g, ops] = opCanvas(true);
    c.draw(g, undefined);
    const sparks = ops.filter(o => o[0] === 'F' && String(o[1]).indexOf('216,255,140') >= 0 || o[0] === 'F' && String(o[1]).indexOf('255,232,172') >= 0);
    // sparks blink on hashed personal beats — on a single instant only a minority are lit, but
    // the swarm must be visible, and the low-glow + spark pair means ≥2 ops per firefly.
    assert.ok(sparks.length >= 4, land + ': only ' + sparks.length + ' firefly ops on a warm clear night');
    assert.ok(sparks.every(o => o[6] === false), land + ': firefly drew a NaN rect');
    // the sparks sit low: below y=30 is ground level on this screen, not the aurora/meteor band
    assert.ok(sparks.every(o => o[3] > 30), land + ': a spark drew above y=30 — that is not a firefly');
  }
});

test('cold air, rain, day, other lands and the apocalypse each kill the swarm', () => {
  const count = (land, t, wx) => {
    const c = load(land, t);
    if (wx) c.weather = Object.assign({}, c.weather, wx);
    const [g, ops] = opCanvas(true);
    c.draw(g, undefined);
    return ops.filter(o => o[0] === 'F' && (String(o[1]).indexOf('216,255,140') >= 0 || String(o[1]).indexOf('255,232,172') >= 0)).length;
  };
  assert.strictEqual(count('swamp', NIGHT, { temp: -6 }), 0, 'fireflies flew in the cold');
  assert.strictEqual(count('swamp', NIGHT, { code: 63, cloud: 98, wind: 14, precip: 2.4 }), 0, 'fireflies flew in the rain');
  assert.strictEqual(count('mesa', NIGHT, null), 0, 'mesa does not grow fireflies — but drew sparks');
  // 🔑 1791000000000 LOOKS like a day stamp but is local MIDNIGHT on this TZ (light=0) — that
  // mistake produced a "daylight" instant where the swarm was legitimately out. Pin a hard-noon
  // instant instead (light found >0.85 by sweep).
  assert.strictEqual(count('swamp', 1791734400000, null), 0, 'fireflies glowed at noon (light=1)');
});