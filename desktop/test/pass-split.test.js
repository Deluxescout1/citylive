'use strict';
// The KDE wallpaper runs two canvases: a slow "bg" backdrop and a fast "live" layer on top.
// That only composites to the right picture if the two passes are exact complements of the
// classic single-canvas frame — nothing drawn twice, nothing dropped. A pass gate added for a
// new effect without considering "live" would silently lose it from the wallpaper (or double
// it), which is invisible in a unit test that only checks "does it throw".

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');
const SRC = fs.readFileSync(ENGINE, 'utf8');

function canvasStub() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(_t, p) {
      if (p === 'measureText') return (s) => ({ width: String(s || '').length * 4 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => gradient;
      if (p === 'getImageData') return () => ({ data: [] });
      if (p === 'canvas') return { width: 854, height: 480 };
      return () => {};
    },
    set() { return true; }
  });
}

// run one pass on a fresh engine, recording which draw* functions actually ran
function drawFns(pass) {
  const sandbox = {
    Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    isNaN, isFinite, parseInt, parseFloat, console,
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {},
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(SRC, ctx, { filename: 'city.js' });
  ctx.NOFETCH = true;
  ctx.setup('neon', { cw: 854, ch: 480, woff: 776, ww: 2269, pxk: 3, zoom: 1, quality: 'spectacle' });
  ctx.CLOCK = 1784916000000; ctx.NOWOVR = 1784916000000;   // pin the clock so all three passes agree

  const called = new Set();
  for (const name of Object.keys(ctx)) {
    if (typeof ctx[name] !== 'function' || !/^draw[A-Z]/.test(name)) continue;
    const orig = ctx[name];
    ctx[name] = function (...a) { called.add(name); return orig.apply(this, a); };
  }
  if (pass === undefined) ctx.draw(canvasStub());
  else ctx.draw(canvasStub(), pass);
  return called;
}

test('"bg" + "live" cover exactly what the single-canvas frame draws', () => {
  const full = drawFns(undefined);
  const bg = drawFns('bg');
  const live = drawFns('live');

  assert.ok(full.size > 50, `expected a busy frame, got ${full.size} draw fns`);
  assert.ok(bg.size > 0, 'the backdrop pass drew nothing');
  assert.ok(live.size > 0, 'the live pass drew nothing');

  const union = new Set([...bg, ...live]);
  const missing = [...full].filter(f => !union.has(f));
  const extra = [...union].filter(f => !full.has(f));

  assert.deepStrictEqual(missing, [], `dropped from the wallpaper (in full, in neither bg nor live): ${missing.join(', ')}`);
  assert.deepStrictEqual(extra, [], `drawn only when split (in bg/live, not in full): ${extra.join(', ')}`);
});

test('the two passes do not double-paint (terrain excepted, which is split by half)', () => {
  const bg = drawFns('bg');
  const live = drawFns('live');
  const both = [...bg].filter(f => live.has(f));
  // drawTerrain takes an explicit "bg"/"fg" half, and drawTree is called from inside each half.
  const allowed = new Set(['drawTerrain', 'drawTree']);
  const unexpected = both.filter(f => !allowed.has(f));
  assert.deepStrictEqual(unexpected, [], `painted by BOTH canvases: ${unexpected.join(', ')}`);
});

test('the live pass clears itself so it cannot smear over the backdrop', () => {
  // it is composited on top of bg, so a frame that does not clear leaves motion trails
  let cleared = false;
  const sandbox = {
    Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    isNaN, isFinite, parseInt, parseFloat, console,
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {},
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(SRC, ctx, { filename: 'city.js' });
  ctx.NOFETCH = true;
  ctx.setup('neon', { cw: 854, ch: 480, woff: 776, ww: 2269, pxk: 3, zoom: 1, quality: 'spectacle' });
  const gradient = { addColorStop() {} };
  const g = new Proxy({}, {
    get(_t, p) {
      if (p === 'clearRect') return () => { cleared = true; };
      if (p === 'measureText') return (s) => ({ width: String(s || '').length * 4 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => gradient;
      if (p === 'getImageData') return () => ({ data: [] });
      if (p === 'canvas') return { width: 854, height: 480 };
      return () => {};
    },
    set() { return true; }
  });
  ctx.draw(g, 'live');
  assert.ok(cleared, 'the "live" pass never called clearRect — it will smear motion trails');
});
