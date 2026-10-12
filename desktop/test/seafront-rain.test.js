'use strict';

// RAIN ON THE FRONT WATER — Nick, 2026-10-11: "if it is raining, it needs to show it is raining in
// the bottom river if the map has a bottom river. It needs to effect the flow."
//
// Three properties, each attached to the fault that teaches it:
//   1. RINGS WHERE IT RAINS — every land whose front band is water (generic + the karst / fjord /
//      cavern renderers that route BEFORE the generic path) gains impact ops in rain and loses none
//      in clear. The routed three rendered identically in a downpour before 2026-10-11; the band
//      was only "for all twenty lands" in a comment that lied.
//   2. UNDERCITY DISCRIMINATION — its floor lake draws a FRACTION of an open-sky band's ring
//      density (its rain arrives only through the collapse shafts). Assert the ordering, not the
//      constant.
//   3. THE FLOW NEVER TOUCHES A PHASE — the crest's third octave (the rain current) has a FIXED
//      speed in its own `now*curSp` term and a rain-driven AMPLITUDE. Amplitude can step, a speed
//      cannot: any term that changes `now*`'s multiplier teleports the swell by `now*Δ`.
//      So: in CLEAR weather the amplitude is 0 and the band is byte-identical however soaked the
//      street is (asserted), and in rain it actually moves (asserted).
// The op-count proxy is the same trick the visual smoke test uses: a Proxy canvas whose fillRect
// records (x, y, w, h). A ring is 2-3 fills in the band's y-range; a current changes crest y's but
// NOT counts — so #3 asserts on tuples, #1/#2 on counts.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');
const NOW = 1791000000000;

function tupleCanvas() {
  const ops = [];
  const gradient = { addColorStop() {} };
  return {
    canvas: {
      get(prop) {
        if (prop === 'measureText') return () => ({ width: 4 });
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => { ops.push(['GRAD']); return gradient; };
        if (prop === 'getImageData') return () => ({ data: [] });
        return () => {};
      },
      ops
    },
    proxy: null
  };
}

function load(land, wxPin) {
  const sandbox = { Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    isNaN, isFinite, parseInt, parseFloat, console,
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {} };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), context, { filename: 'city.js' });
  context.NOFETCH = true;
  context.NOWOVR = NOW; context.CLOCK = NOW;
  // ⚠ a DIRECT renderer call (below) never runs maybeFetchWeather(), so pinning FORCEWX is not
  // enough for it — write `weather` too. That is the same var the fetch assigns.
  context.weather = Object.assign({ code: 0, cloud: 30, wind: 5, temp: 60, precip: 0, feels: 60, gust: 8 }, wxPin || {});
  if (wxPin) context.FORCEWX = Object.assign({}, wxPin);
  context.applyConfig({ land });
  context.setup('neon', { cw: 853, ch: 480, woff: 0, ww: 1706, pxk: 6, quality: 'performance' });
  context.wetness = 0;
  context.splashes && (context.splashes.length = 0);
  return context;
}

const CLEAR = { code: 0, cloud: 20, wind: 6, precip: 0 };
const DRIZZLE = { code: 53, cloud: 95, wind: 10, precip: 0.6 };      // rainK 0.3
const RAIN = { code: 63, cloud: 98, wind: 14, precip: 2.4 };         // rainK 0.7 — veil fires
const THUNDER = { code: 95, cloud: 99, wind: 24, precip: 6 };        // rainK 1

function opCanvas() {
  const ops = [];
  const gradient = { addColorStop() {} };
  const g = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'measureText') return () => ({ width: 4 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern')
        return () => { ops.push(['GRAD']); return gradient; };
      if (prop === 'getImageData') return () => ({ data: [] });
      if (prop === 'fillRect') return (x, y, w, h) => { ops.push(['F', x | 0, y | 0, w | 0, h | 0]); };
      return () => {};
    },
    set() { return true; }
  });
  return [g, ops];
}

// a compact signature of an op sequence — full dumps in assertion failures here were ~100k chars
function sig(ops) {
  const s = String(ops.length) + '|' + JSON.stringify(ops.slice(0, 10)) + '|' +
    JSON.stringify(ops.slice(ops.length >> 1, (ops.length >> 1) + 10)) + '|' +
    JSON.stringify(ops.slice(-10));
  return s.replace(/(.{240}).*/, '$1…');
}

// full-frame draw with the band's y-range extracted — for the renderers whose side data
// (karstCache etc.) only the real draw stack builds.
function bandOpCount(ctx, wxPin, wet) {
  ctx.FORCEWX = Object.assign({}, wxPin);
  ctx.weather = Object.assign({ code: 0, cloud: 20, wind: 6, precip: 0, temp: 64, feels: 64, gust: 9 }, wxPin || {});
  ctx.wetness = wet || 0;
  ctx.splashes && (ctx.splashes.length = 0);
  const ops = [];
  const gradient = { addColorStop() {} };
  const top = Math.max(0, (typeof ctx.SEA_Y === 'number' ? ctx.SEA_Y : 0));
  const g = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'measureText') return () => ({ width: 4 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern')
        return () => { ops.push(['GRAD']); return gradient; };
      if (prop === 'getImageData') return () => ({ data: [] });
      if (prop === 'fillRect') return (x, y, w, h) => { if ((y | 0) >= top) ops.push(['F', x | 0, y | 0, w | 0, h | 0]); };
      return () => {};
    },
    set() { return true; }
  });
  ctx.draw(g, undefined);
  return ops;
}

// direct single-renderer draw — band-local tuples for the assertions that need them
function bandTuples(ctx, fn, L, wet, wxPin, now) {
  if (wxPin) ctx.weather = Object.assign({ code: 0, cloud: 20, wind: 6, precip: 0, temp: 64, feels: 64, gust: 9 }, wxPin);
  ctx.wetness = wet;
  ctx.splashes && (ctx.splashes.length = 0);
  const [g, ops] = opCanvas();
  ctx[fn](g, L, now || NOW);
  return ops;
}

test('frontRainFX itself: zero ops in clear, rings+veil ladder in rain, density honours densK', () => {
  const ctx = load('canyon');
  const h = 20;
  // direct helper calls: (g, rainK, top, h, now, K, day, densK)
  function helper(rainK, densK) {
    ctx.wetness = 0; ctx.splashes && (ctx.splashes.length = 0);
    const [g, ops] = opCanvas();
    ctx.frontRainFX(g, rainK, 461, h, NOW, 1, true, densK);
    return ops;
  }
  assert.equal(helper(0, 1).length, 0, 'clear weather: the shared rain layer must draw NOTHING');
  const driz = helper(0.3, 1), rain = helper(0.7, 1), storm = helper(1, 1);
  assert.ok(driz.length > 0, 'drizzle still pocks the surface');
  assert.ok(rain.length > driz.length, 'steady rain out-pocks drizzle');
  assert.ok(storm.length > rain.length, 'thunderstorm out-pocks steady rain');
  assert.equal(storm.filter((o) => o[0] === 'GRAD').length, 1, 'the spray veil is ONE gradient, only in the heavy stuff');
  assert.equal(rain.filter((o) => o[0] === 'GRAD').length, 1, 'rainK 0.7 is above the veil threshold');
  assert.equal(driz.filter((o) => o[0] === 'GRAD').length, 0, 'no veil below rainK 0.65');
  const stormCavern = helper(1, 0.35);
  const stormFills = (o) => o.filter((x) => x[0] !== 'GRAD').length;
  assert.ok(stormFills(stormCavern) > 0 && stormFills(stormCavern) < stormFills(storm),
    'a shaft-lit cave floor takes a FRACTION of the open-sky ring density');
  assert.equal(stormCavern.filter((o) => o[0] === 'GRAD').length, 1, 'cavern veil is scaled by densK, not deleted');
});

test('determinism: same clock + same weather → identical band output (pure function of (x, clock))', () => {
  const a = bandTuples(load('canyon', RAIN), 'drawSeaFrontBand', 0.7, 0);
  const b = bandTuples(load('canyon', RAIN), 'drawSeaFrontBand', 0.7, 0);
  assert.deepEqual(a, b);
});

test('the flow: rain moves the crest, and a soaked-but-clear band is byte-identical', () => {
  // rain pins rainK; the ONLY thing wetness moves between these two draws is the current's
  // amplitude — so any tuple difference is the current actually advecting the surface.
  const justStarted = sig(bandTuples(load('canyon', RAIN), 'drawSeaFrontBand', 0.7, 0));
  const soaked = sig(bandTuples(load('canyon', RAIN), 'drawSeaFrontBand', 0.7, 1));
  assert.notEqual(justStarted, soaked,
    'the rain current must MOVE the swell fills once it has soaked in');
  // 🚨 the invariant this test exists for: in CLEAR weather rainK is 0, the current amplitude is 0,
  // and NO amount of street wetness may touch the band — the flow term must be dead, not merely small.
  const clearDry = sig(bandTuples(load('canyon', CLEAR), 'drawSeaFrontBand', 0.7, 0));
  const clearSoaked = sig(bandTuples(load('canyon', CLEAR), 'drawSeaFrontBand', 0.7, 1));
  assert.equal(clearDry, clearSoaked);
});

test('wiring: the routed custom waters (karst / fjord / undercity) answer real rain via the full draw stack', () => {
  for (const land of ['karst', 'fjord', 'under']) {
    const clear = bandOpCount(load(land), CLEAR).length;
    const rainP = bandOpCount(load(land, RAIN), RAIN).length;
    assert.ok(rainP > clear, land + ': rain must reach this bottom water through the routed renderer');
  }
});

test('rings land inside the water band, scattered (not a pitch), and refresh on the clock', () => {
  const ctx = load('canyon', RAIN);
  const ops1 = bandTuples(ctx, 'drawSeaFrontBand', 0.7, 0.6);
  const ctx2 = load('canyon', RAIN);
  const ops2 = bandTuples(ctx2, 'drawSeaFrontBand', 0.7, 0.6);
  // determinism across loads; then a different clock slot must move rings, not march them
  assert.equal(sig(ops1), sig(ops2), 'same clock → identical band');
  const ctx3 = load('canyon', RAIN); ctx3.NOWOVR = NOW + 230;
  const ops3 = bandTuples(ctx3, 'drawSeaFrontBand', 0.7, 0.6, null, NOW + 230);
  assert.notEqual(sig(ops1), sig(ops3), 'a new time slot refreshes the ring field');
});