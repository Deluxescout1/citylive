'use strict';
// LIFE-WALK — integration through the engine's own clock math, on the FULL pass. This is the
// complement to render-matrix.test.js: the matrix freezes each land at a village-phase instant
// (deterministic, fast), so anything that only happens LATER in the growth curve — the el-train
// running its timetable, the whole disaster arc, the death band — is invisible to it. The walk
// found the `cwY` pantograph bug (`fillRect(x, NaN, …)` on every service pass, forever) precisely
// because trains only run once the city has grown.
//
// No mocks beyond the op canvas: applies real configs, walks real wall time (NOWOVR pins), draws
// the legacy full pass every step.
//
// 🚨 GOTCHA the first draft hit: every context needs setup('neon', GEO) after applyConfig — a bare
// applyConfig + draw renders a zero-op frame and "passes" every assertion against nothing at all.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'city.js'), 'utf8');
function load() {
  const sb = { Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    isNaN, isFinite, parseInt, parseFloat, console,
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {} };
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  const c = vm.createContext(sb);
  vm.runInContext(SRC, c, { filename: 'city.js' });
  c.NOFETCH = true;
  return c;
}
function opG() { let n = 0, bad = 0; const grad = { addColorStop() {} };
  const g = new Proxy({}, { get(_t, p) {
    if (p === 'measureText') return () => ({ width: 4 });
    if (p.startsWith('create')) return () => grad;
    if (p === 'getImageData') return () => ({ data: [] });
    if (['save','restore','beginPath','closePath','clip','translate','rotate','scale','setTransform','resetTransform','setLineDash','setLineJoin','setLineCap','clearRect'].includes(p)) return () => {};
    return (...a) => { n++; for (const v of a) if (typeof v === 'number' && !isFinite(v)) bad++; };
  }, set() { return true; } });
  return [g, () => [n, bad]];
}
// walk a window of real time, drawing the full pass every `step` ms
function walk(c, from, ms, step, WXPin) {
  const out = { steps: 0, ex: null, bad: 0, minOps: 1e12, rollovers: 0, disSteps: 0, apocSteps: 0 };
  let prevLife = c.lifeIndexOf(from);
  for (let t = from; t <= from + ms; t += step) {
    c.NOWOVR = t; c.CLOCK = t;
    if (WXPin) c.FORCEWX = Object.assign({}, WXPin);
    c.wetness = 0; c.splashes && (c.splashes.length = 0);
    const [g, cnt] = opG();
    try {
      c.draw(g, undefined);
      const [n, bad] = cnt(); out.steps++;
      out.bad += bad; if (n < out.minOps) out.minOps = n;
      if (c.lifeIndexOf(t) !== prevLife) { out.rollovers++; prevLife = c.lifeIndexOf(t); }
      if (c.curDis) out.disSteps++;
      if (c.cityPhase === 'apoc') out.apocSteps++;
    } catch (e) { out.ex = '@+' + (t - from) + ': ' + e.message; break; }
  }
  return out;
}
const CLEAR = { code: 0, cloud: 20, wind: 6, temp: 64, precip: 0, feels: 64, gust: 9 };
const RAIN = { code: 63, cloud: 98, wind: 14, temp: 52, precip: 2.4, feels: 50, gust: 26 };

// ---- 1. THREE WHOLE 1h LIVES in rain (rain everywhere exercises weather+pauses)
test('three whole 1h lives walked in rain: rollovers exact, no NaN, no exception', () => {
  const c = load(); c.applyConfig({ cycle: '1h', disasters: 'frequent' }); c.NOWOVR=1791250000000; c.CLOCK=1791250000000; c.setup('neon',{cw:853,ch:480,woff:582,ww:2269,pxk:6,quality:'performance'});
  const r = walk(c, 1791250000000, 3 * 3600000, 30000, RAIN);
  assert.strictEqual(r.ex, null, 'rain walk threw: ' + r.ex);
  assert.strictEqual(r.bad, 0, r.bad + ' non-finite canvas args across the walk');
  assert.strictEqual(r.rollovers, 3, 'expected exactly 3 life rollovers');
  assert.ok(r.minOps > 1000, 'a frame rendered only ' + r.minOps + ' ops');
});
// ---- 2. THE APOCALYPSE, for real: walk the death band (last ~4% of a 1h life) + the tail
test('the death band plays and the world rolls over', () => {
  const c = load(); c.applyConfig({ cycle: '1h' }); c.NOWOVR=1791250000000; c.CLOCK=1791250000000; c.setup('neon',{cw:853,ch:480,woff:582,ww:2269,pxk:6,quality:'performance'});
  const li0 = c.lifeIndexOf(1791250000000);
  let s = 1791250000000; while (c.lifeIndexOf(s) === li0) s += 600000;   // first rollover instant
  const band = Math.round(c.GROW_CYCLE * 0.05);
  const r = walk(c, s + Math.round(c.GROW_CYCLE * 0.95), band + 480000, 15000, CLEAR);
  assert.strictEqual(r.ex, null, 'apocalypse walk threw: ' + r.ex);
  assert.strictEqual(r.bad, 0, r.bad + ' non-finite canvas args during the ending');
  assert.strictEqual(r.rollovers, 1, 'the life must roll over exactly once after the death band');
  assert.ok(r.apocSteps > 0, 'cityPhase never reached "apoc" during the band');
});
// ---- 3. A DISASTER ACTUALLY PLAYS: FORCEDIS pins one deterministically; walk all four arc phases
// every step so warn→impact→ripple→recover each render, across clear+rain+snow+fog
test('every disaster type renders its whole arc in every weather, no NaN', () => {
  const c = load(); c.applyConfig({ cycle: '1h' }); c.setup('neon',{cw:853,ch:480,woff:582,ww:2269,pxk:6,quality:'performance'});
  const s = 1791700000000;
  let sawDis = null, badAll = 0, ex = null, steps = 0;
  const wxs = [CLEAR, RAIN, { code: 73, cloud: 90, wind: 10, temp: 22, precip: 2, feels: 14, gust: 18 }, { code: 45, cloud: 100, wind: 4, temp: 58, precip: 0, feels: 58, gust: 7 }];
  const ALLT = c.DIS_TYPES_ALL.concat(c.DIS_TYPES_NEW3);
  for (let i = 0; i < ALLT.length; i++) {
    for (let ph = 0; ph < 4; ph++) {
      const t = s + (i * 4 + ph) * 30000; c.NOWOVR = t; c.CLOCK = t;
      c.FORCEWX = Object.assign({}, wxs[(i + ph) % wxs.length]); c.wetness = 0; c.splashes && (c.splashes.length = 0);
      c.FORCEDIS = { type: ALLT[i], intensity: 3, xf: 0.5, w: 34, seed: 123, f: 0.0625 + ph * 0.25 };
      const [g, cnt] = opG();
      try { c.draw(g, undefined); const [n, bad] = cnt(); steps++; badAll += bad; if (c.curDis && !sawDis) sawDis = c.curDis; if (bad > 4) { ex = 'bad=' + bad + ' type=' + ALLT[i] + ' ph' + ph; break; } }
      catch (e) { ex = ALLT[i] + ' ph' + ph + ': ' + e.message; break; }
    }
    if (ex) break;
  }
  assert.ok(steps === ALLT.length * 4, 'walk aborted early: ' + steps + '/' + ALLT.length * 4 + ' steps' + (ex ? ' — ' + ex : ''));
  assert.strictEqual(badAll, 0, badAll + ' non-finite canvas args across the disaster sweep');
  assert.ok(sawDis, 'curDis never became non-null — FORCEDIS fed nothing?');
});
// ---- 4. FINALE DEMO: the death screen on demand (finaleDemo 60s loop)
test('finaleDemo replays the death screen on its loop', () => {
  const c = load(); c.applyConfig({ cycle: '1h', finaleDemo: 60 }); c.setup('neon',{cw:853,ch:480,woff:582,ww:2269,pxk:6,quality:'performance'});
  let sawApoc = null, ex = null;
  for (let i = 0; i < 130; i++) {
    const t = 1791250000000 + i * 60000; c.NOWOVR = t; c.CLOCK = t;
    c.wetness = 0; c.splashes && (c.splashes.length = 0);
    const [g, cnt] = opG();
    try { c.draw(g, undefined); const [n, bad] = cnt(); if (c.cityPhase === 'apoc' && !sawApoc) sawApoc = t; if (n < 500) { ex = 'thin frame at demo step ' + i; break; } }
    catch (e) { ex = 'demo step ' + i + ': ' + e.message; break; }
  }
  assert.strictEqual(ex, null, ex || '');
  assert.ok(sawApoc, 'finaleDemo never produced cityPhase==="apoc"');
});
// ---- 5. EGGS THROUGH THE CLOCK: pin an egg land, walk 20 minutes in rain
test('an egg land walks the clock in rain like any land', () => {
  const c = load(); c.applyConfig({ egg: 'rainv', cycle: '1h' }); c.setup('neon',{cw:853,ch:480,woff:582,ww:2269,pxk:6,quality:'performance'});
  const r = walk(c, 1791250000000, 20 * 60000, 30000, RAIN);
  assert.strictEqual(r.ex, null, 'egg walk threw: ' + r.ex);
  assert.strictEqual(r.bad, 0, r.bad + ' non-finite canvas args in the egg walk');
  assert.ok(r.minOps > 1000, 'a frame rendered only ' + r.minOps + ' ops');
});