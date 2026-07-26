'use strict';
// The home/work binding cache (peopleHomeWork) is a pure-performance change: it must not move a
// single pixel. peoplePick is a linear scan with two hashes per candidate run per citizen per
// frame, and caching it was 63-70% of the street-life pass — but a citizen who re-binds a frame
// late stands in the wrong doorway, so "faster" is only acceptable if it is also identical.
//
// This A/Bs the cached implementation against the ORIGINAL uncached one inside the same engine
// instance, comparing the whole canvas command stream frame by frame. Both the clock and
// Math.random are pinned (on a COPY of Math — never the host's), because draw() derives motion
// from the wall clock and the ambient particles roll random: unpinned, two runs never match and
// it looks like a regression. See docs/PERF-freeze-diagnosis-20260724.md.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'city.js'), 'utf8');

function makeEngine() {
  // a seeded PRNG on a COPY of Math, so the host's Math.random is untouched
  let s = 0x2545f491;
  const M = Object.create(Math);
  M.random = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const sandbox = { console, Math: M, Date, JSON, Object, Array, String, Number, isNaN, parseInt, parseFloat, setTimeout, clearTimeout };
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'city.js' });
  return sandbox;
}

function recorder(log) {
  const gradient = { addColorStop(...a) { log.push('grad.stop|' + a.join(',')); } };
  return new Proxy({}, {
    get(_t, p) {
      if (p === 'measureText') return (s) => ({ width: String(s || '').length * 4 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') {
        return (...a) => { log.push(p + '|' + a.join(',')); return gradient; };
      }
      if (p === 'getImageData') return () => ({ data: [] });
      if (p === 'canvas') return { width: 1552, height: 874 };
      if (typeof p !== 'string') return () => {};
      return (...a) => { log.push(p + '|' + a.join(',')); };
    },
    set(_t, p, v) { log.push('SET ' + String(p) + '=' + String(v)); return true; }
  });
}

// the pre-cache implementation, rebuilt from the engine's own still-exported pieces
function uncachedHomeWork(E) {
  return function (near, seed, jobBuilding, commutes, cityG) {
    const reg = E.peopleBuildRegistry(near);
    if (!reg) return { homeB: -1, workB: -1 };
    const homeB = E.peoplePick(near, reg.homes, seed, 0x484F4D45, cityG);
    const workB = (commutes === false) ? -2 : E.peoplePick(near, E.workPool(reg, jobBuilding), seed, 0x574F524B, cityG);
    return { homeB: homeB, workB: workB };
  };
}

const CYC = 604800000, EPOCH = 1783972450746;

function render(useCache, life, age, frames) {
  const E = makeEngine();
  E.NOFETCH = true;
  E.GROW_CYCLE = CYC;
  E.NOWOVR = EPOCH + life * CYC + Math.round(0.45 * CYC);
  E.CLOCK = E.NOWOVR;
  E.setup('neon', { cw: 1552, ch: 874, woff: 0, ww: 4656, pxk: 3, zoom: 1, quality: 'balanced', frameMs: 200 });
  E.FORCEAGE = age;
  E.weather.wind = 14;
  E.weather.temp = 62;
  if (!useCache) E.peopleHomeWork = uncachedHomeWork(E);
  const log = [];
  const g = recorder(log);
  for (let i = 0; i < frames; i++) {
    E.NOWOVR = E.CLOCK = EPOCH + life * CYC + Math.round(0.45 * CYC) + i * 200;
    E.draw(g, 'fg');
  }
  return log;
}

// Ages either side of the growth curve, and lands with very different building stock.
// 0.30 is a young town (few buildings standing → pools change shape), 0.85 a mature city.
for (const [life, label] of [[76, 'forest'], [3, 'core'], [8, 'beach'], [21, 'hell']]) {
  for (const age of [0.30, 0.85]) {
    test(`home/work cache draws an identical frame — ${label} @ age ${age}`, () => {
      const withCache = render(true, life, age, 12);
      const without = render(false, life, age, 12);
      assert.ok(withCache.length > 0, 'the pass drew nothing — the comparison would be vacuous');
      const at = withCache.findIndex((v, i) => v !== without[i]);
      assert.strictEqual(at, -1,
        `command stream diverges at op ${at}:\n  cached:   ${withCache[at]}\n  uncached: ${without[at]}`);
      assert.strictEqual(withCache.length, without.length, 'different number of canvas ops');
    });
  }
}

// The cache generation must actually react to the city changing, or a citizen keeps a demolished
// address forever. Growing the city changes which buildings are standing → a new signature.
test('the standing signature changes when the city grows', () => {
  const E = makeEngine();
  E.NOFETCH = true;
  E.GROW_CYCLE = CYC;
  E.NOWOVR = EPOCH + 76 * CYC + Math.round(0.45 * CYC);
  E.setup('neon', { cw: 1552, ch: 874, woff: 0, ww: 4656, pxk: 3, zoom: 1, quality: 'balanced', frameMs: 200 });
  const sigs = new Set();
  for (const g of [0.25, 0.4, 0.55, 0.7, 0.85, 1.0]) sigs.add(E.peopleStandingSig(E.near, g));
  assert.ok(sigs.size > 1, 'the signature never changed as the city grew — the cache would go stale');
});
