// SUPERBLOOM — the desert remembers its rain. `desertBloom` is a slow per-screen integrator in the
// snowpack/wetness family: it rises only while the REAL forecast is raining on a dune land with warm
// air (~2 real hours of steady rain fills it), and it decays over ~4 real days. While it is up, the
// dunes carry scattered gold / vermilion / mauve tufts on the windward backs and the flat pan —
// never the slip faces, which avalanche whatever tries to grow there.
// Tests PIN desertBloom directly (it is state, like wetness); the tuft placement itself is a pure
// function of (world x, clock).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');
const RAIN = { code: 63, cloud: 98, wind: 14, temp: 20, precip: 2.4 };   // rainK 0.7 — blooms need warm rain
const CLEAR = { code: 0, cloud: 20, wind: 6, temp: 20, precip: 0 };
const NOON = 1791734400000;                     // a hard-noon instant (light > 0.85)

function load(land, t, wx) {
  const sandbox = { Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    isNaN, isFinite, parseInt, parseFloat, console,
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {} };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), context, { filename: 'city.js' });
  context.NOFETCH = true;
  context.NOWOVR = t; context.CLOCK = t;
  context.weather = Object.assign({}, CLEAR, { temp: 20, feels: 18 }, wx || {});
  context.applyConfig({ land: land || 'dunes' });
  context.setup('neon', { cw: 853, ch: 480, woff: 582, ww: 2269, pxk: 6, quality: 'performance' });
  context.wetness = 0; context.kpNow = 7;
  return context;
}

const grad = { addColorStop() {} };
// the superbloom owns three rgb triples nowhere else in the engine — the test finds the bloom by
// colour alone, so any second owner would make this suite pass on a lit-window district.
const BLOOM = ['255,206,74', '232,104,64', '196,122,212'];

test('the engine alone owns the bloom palette triples', () => {
  const src = fs.readFileSync(ENGINE, 'utf8');
  for (const col of BLOOM) {
    const lines = src.split('\n').filter(l => l.indexOf(col) >= 0);
    assert.ok(lines.length === 1, 'bloom colour ' + col + ' appears on ' + lines.length + ' lines — it must stay unique to the bcols row');
  }
});

function bloomOps(c) {
  const ops = [];
  let style = '';
  const g = new Proxy({}, {
    get(_t, p) {
      if (p === 'measureText') return () => ({ width: 4 });
      if (String(p).startsWith('create')) return () => { ops.push(['GRAD']); return grad; };
      if (p === 'getImageData') return () => ({ data: [] });
      if (p === 'fillRect') return (x, y, w, h) => {
        ops.push([style, x | 0, y | 0, w | 0, h | 0,
          Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(w) || Number.isNaN(h)]);
      };
      return () => {};
    },
    set(_t, p, v) { if (p === 'fillStyle') style = v; return true; }
  });
  c.draw(g, undefined);
  return ops.filter(o => BLOOM.some(b => String(o[0]).indexOf(b) >= 0));
}

test('a rain-memory desert carries flower tufts; a dry one carries none; no NaN ever', () => {
  const c = load('dunes', NOON);
  c.desertBloom = 1;
  const withBloom = bloomOps(c);
  assert.ok(withBloom.length > 120, 'full bloom drew only ' + withBloom.length + ' tuft ops — the desert is not flowering');
  assert.ok(withBloom.every(o => !o[5]), 'a tuft drew a NaN rect');
  c.desertBloom = 0;
  assert.strictEqual(bloomOps(c).length, 0, 'the dry desert drew flower tufts');
});

test('the rain memory rises only in warm rain on the dunes, and fades on a dry day', () => {
  // ⚠ dt comes from the CLOCK DELTA (clamped by FRAME_MS*2.5) — pinning now and re-drawing gives
  // dt=0 and no integration at all. Advance NOWOVR by one real frame per call instead.
  const bareG = () => { const gr = { addColorStop() {} }; return [new Proxy({}, { get(_t, p) { if (String(p).startsWith('create')) return () => gr; return () => {}; }, set() { return true; } })]; };
  const step = (cc, baseT, frames) => { for (let i = 0; i < frames; i++) { cc.NOWOVR = baseT + i * 16; cc.CLOCK = cc.NOWOVR; const [g] = bareG(); cc.draw(g, 'live'); } };
  const c = load('dunes', NOON, RAIN);
  c.desertBloom = 0;
  let prev = c.desertBloom, rose = 0;
  for (let i = 0; i < 300; i++) { const [g] = bareG(); c.NOWOVR = NOON + i * 16; c.CLOCK = c.NOWOVR; c.draw(g, 'live'); if (c.desertBloom > prev) rose++; prev = c.desertBloom; }
  assert.ok(prev > 0 && prev < 0.02, '300 warm-rain frames should nudge the bloom up slightly (got ' + prev + ')');
  assert.ok(rose >= 250, 'the integrator should rise frame-on-frame in steady rain');
  // the dune WITHOUT rain — same engine, clear sky — must not rise
  const cold = load('dunes', NOON);
  cold.desertBloom = 0;
  for (let i = 0; i < 300; i++) { const [g] = bareG(); cold.NOWOVR = NOON + i * 16; cold.CLOCK = cold.NOWOVR; cold.draw(g, 'live'); }
  assert.strictEqual(cold.desertBloom, 0, 'the desert rose toward bloom on a clear day');
  // dry day decays an existing bloom
  const c2 = load('dunes', NOON);
  c2.desertBloom = 0.5;
  step(c2, NOON, 120);
  assert.ok(c2.desertBloom < 0.5, 'the bloom must fade once the rain stops');
});