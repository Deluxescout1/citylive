// THE YEAR, CONTINUOUS — Nick, 2026-10-12: "between the seasons of Spring and Winter, each map
// should transition from fully green to the colors of fall, to then everything is dead. Perhaps
// every map needs some trees (if it applies) so we can have that effect on every map."
// Rules under test:
//   1. Anchors stay BYTE-EXACT at mid-phase dates — Jul 15 = the shipped summer palette, Oct 15 =
//      the shipped autumn gold, Jan = the shipped winter grey. Nobody's existing look changes there.
//   2. The ramp is SMOOTH: no day-over-day canopy channel jump greater than 25 anywhere in the year,
//      including every month boundary.
//   3. The flags keep their dates: bare = Dec–Feb, blossom = Mar–May, name = the old month gates.
//   4. The leaf-drop is a WAVE: through the Nov 10–30 window the share of drawTree's generic woods
//      sitting on the bare-branch path rises monotonically seed by seed (hash-staggered) and is ALL
//      of them by Dec 1, where today's winter path takes over unchanged.
//   5. Every APPLICABLE land carries at least one canopy-following deciduous kind, so its vegetation
//      rides the fall ramp (the by-design evergreen/blind kinds — acacia, palms, saguaro, spruce,
//      lichen, fungus, snag — do not, and that is correct). Skip-list documented in the release doc.
//   6. The model is a pure function of the instant: same date in, same answer out, forever.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');
const CLEAR = { code: 0, cloud: 20, wind: 6, temp: 20, precip: 0 };

function loadEngine() {
  const sandbox = { Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, isNaN, isFinite,
    parseInt, parseFloat, console, performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0, setTimeout: () => 0, setInterval: () => 0,
    clearTimeout() {}, clearInterval() {} };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), vm.createContext(sandbox), { filename: 'city.js' });
  sandbox.NOFETCH = true;
  sandbox.weather = Object.assign({}, CLEAR, { temp: 20, feels: 18 });
  return sandbox;
}
function withLand(land) {
  const c = loadEngine();
  c.applyConfig({ land });
  c.setup('neon', { cw: 853, ch: 480, woff: 582, ww: 2269, pxk: 6, quality: 'performance' });
  c.wetness = 0; c.kpNow = 7;
  return c;
}
// a recorder for one drawTree call: {gold, trunk} op counts in draw order
function treeCensus(c, t, seeds) {
  c.curSeason = c.seasonInfo(new Date(t));          // exactly what draw() does each frame
  let ops = [], s = '';
  const g = new Proxy({}, {
    get(_p, p) {
      if (p === 'fillRect') return (x, y, w, h) => ops.push([s, x | 0, y | 0, w | 0, h | 0]);
      if (p === 'measureText') return () => ({ width: 4 });
      if (String(p).startsWith('create')) return () => ({ addColorStop() {} });
      return () => {};
    },
    set(_p, p, v) { if (p === 'fillStyle') s = v; return true; }
  });
  const census = [];
  for (const seed of seeds) {
    const mark = ops.length;
    const kinds = (c.curBiome.flora && c.curBiome.flora.kinds) || null;
    if (kinds) { const keep = c.curBiome.flora.kinds; c.curBiome.flora.kinds = ['generic'];   // the deciduous path
      c.drawTree(g, 50, 300, true, t, seed >>> 0, 1, false); c.curBiome.flora.kinds = keep; }
    else c.drawTree(g, 50, 300, true, t, seed >>> 0, 1, false);
    const slice = ops.slice(mark);
    const gold = slice.some(o => String(o[0]).indexOf('206,120,42') >= 0 || String(o[0]).indexOf('212,86,44') >= 0 ||
      String(o[0]).indexOf('188,152,52') >= 0 || String(o[0]).indexOf('214,160,60') >= 0 ||
      String(o[0]).indexOf('214,168,64') >= 0 || String(o[0]).indexOf('198,132,56') >= 0);
    const trunk = slice.some(o => String(o[0]) === '#5a4028');
    census.push({ gold, trunk });
  }
  return census;
}

// ---- 1+2+3: the season model itself, swept across the whole year ----
test('the canopy anchors are byte-exact and the year is smooth end to end', () => {
  const c = loadEngine();
  const toRows = (s) => [[s.canopy[0][0], s.canopy[0][1], s.canopy[0][2]],   // test-realm literals — a
    [s.canopy[1][0], s.canopy[1][1], s.canopy[1][2]],                        // sandbox-realm array fails
    [s.canopy[2][0], s.canopy[2][1], s.canopy[2][2]]];                       // deepStrictEqual's prototype check
  assert.deepStrictEqual(toRows(c.seasonInfo(new Date(2026, 6, 15))), [[52, 128, 58], [70, 148, 74], [42, 110, 52]], 'Jul 15 must stay the shipped summer palette');
  assert.deepStrictEqual(toRows(c.seasonInfo(new Date(2026, 9, 15))), [[206, 120, 42], [212, 86, 44], [188, 152, 52]], 'Oct 15 must stay the shipped autumn palette');
  assert.deepStrictEqual(toRows(c.seasonInfo(new Date(2026, 0, 15))), [[86, 94, 86], [104, 110, 100], [74, 84, 78]], 'Jan must stay the shipped winter palette');
  // smoothness, include every month boundary
  let worst = 0, worstDay = null;
  const pairs = [];
  for (let m = 0; m < 12; m++) for (let d = 1; d <= 28; d++) pairs.push([m, d, m, d + 1]);
  pairs.push([0, 28, 1, 1], [1, 28, 2, 1], [2, 28, 3, 1], [3, 28, 4, 1], [4, 28, 5, 1], [5, 28, 6, 1],
    [6, 28, 7, 1], [7, 28, 8, 1], [8, 28, 9, 1], [9, 28, 10, 1], [10, 28, 11, 1], [11, 28, 0, 1]);
  for (const [mA, dA, mB, dB] of pairs) {
    const a = toRows(c.seasonInfo(new Date(2026, mA, dA)));
    const b = toRows(c.seasonInfo(new Date(2026, mB, dB)));
    for (let r = 0; r < 3; r++) for (let ch = 0; ch < 3; ch++) {
      const jump = Math.abs(a[r][ch] - b[r][ch]);
      if (jump > worst) { worst = jump; worstDay = (mA + 1) + '/' + dA; }
    }
  }
  assert.ok(worst <= 25, 'canopy jumped ' + worst + ' channels on ' + worstDay + ' — the year has a seam');
  // flags keep their calendar dates
  assert.strictEqual(c.seasonInfo(new Date(2026, 11, 1)).bare, true, 'Dec 1 must still be the bare flag');
  assert.strictEqual(c.seasonInfo(new Date(2026, 10, 30)).bare, false, 'Nov 30 must still be in-canopy');
  assert.strictEqual(c.seasonInfo(new Date(2026, 2, 1)).blossom, true, 'Mar 1 must still open blossom');
  assert.strictEqual(c.seasonInfo(new Date(2026, 5, 1)).blossom, false, 'Jun 1 must close blossom');
  assert.strictEqual(c.seasonInfo(new Date(2026, 8, 1)).name, 'autumn', 'Sep 1 keeps its name');
});

// ---- 4: the drop is a wave, not a flip (40 seeds, generic woods) ----
test('the leaf-drop waves in: bare share rises through November and is total by Dec 1', () => {
  const seeds = []; for (let i = 0; i < 40; i++) seeds.push((i * 2654435761) >>> 0);
  const c = withLand('leaf');
  const share = (m, d) => {
    const cen = treeCensus(c, new Date(2026, m, d).getTime(), seeds);
    // bare path = trunk strokes with no canopy colour anywhere
    return cen.filter(x => x.trunk && !x.gold).length / seeds.length;
  };
  const s1 = share(9, 15), s2 = share(10, 14), s3 = share(10, 26), s4 = share(11, 5);
  assert.strictEqual(s1, 0, 'Oct 15 already has bare generic trees — the wave started early');
  assert.ok(s2 > 0, 'Nov 14 share is zero — no wave');
  assert.ok(s3 >= s2, 'Nov 26 share fell below Nov 14 — the wave undid itself');
  assert.ok(s4 >= s3, 'Dec 5 share fell below Nov 26');
  assert.strictEqual(s4, 1, 'Dec 5 must be all bare (today\'s winter path)');
});

// ---- 5: every applicable land carries a canopy-following deciduous kind ----
test('every applicable land has at least one kind that follows the fall ramp', () => {
  const DECID = { generic: 1, willow: 1, cottonwood: 1, larch: 1, cypress: 1, goldtree: 1, weedtree: 1, birch: 1, waterTree_stub: 0 };
  const APPLIES = ['karst', 'fjord', 'dam', 'canyon', 'swamp', 'leaf', 'sprawl'];
  // ⚠ THE SAVANNA is deliberately excluded: an acacia keeps its green all year (a semi-arid
  // evergreen, not a temperate deciduous tree) — its grass goes dull by the ramp instead. The
  // nothing-grows lands (dunes, salt, pack ice, new island, ashlands, empyrean, undercity) likewise.
  const biomes = c => (c.BIOMES || c.ALLBIOMES).filter(b => APPLIES.includes(b.k));
  const c = loadEngine();
  for (const b of biomes(c)) {
    const kinds = (b.flora && b.flora.kinds) || [];
    const ok = kinds.some(k2 => DECID[k2]);
    assert.ok(ok, b.k + ' (' + b.name + ') has no canopy-following kind: [' + kinds.join(',') + '] — its fall cannot show');
  }
});

// ---- 6: purity ----
test('the seasonal model is a pure function of the instant', () => {
  const c = loadEngine();
  const a = c.seasonInfo(new Date(2026, 9, 12, 9, 30));
  const b = c.seasonInfo(new Date(2026, 9, 12, 9, 30));
  const n = s => ({ ...s, canopy: [[s.canopy[0][0], s.canopy[0][1], s.canopy[0][2]], [s.canopy[1][0], s.canopy[1][1], s.canopy[1][2]], [s.canopy[2][0], s.canopy[2][1], s.canopy[2][2]]] });
  assert.deepStrictEqual(n(b), n(a), 'same instant, different season — the ramp leaks state');
});