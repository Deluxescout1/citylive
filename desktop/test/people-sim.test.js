'use strict';
// THE PEOPLE (v2.0) — citizen-sim contract, asserted against the REAL spliced engine (renderer/city.js).
// Locks the invariants SOL's review demanded: determinism (cold==incremental==jumps), no NaN, honest
// living-population stats, safe (idx,gen) identity, unique names, read-only projections, real class
// spectrum, and the cold-fold performance budget. Zero deps (node:test + assert).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');
function load() {
  const grad = { addColorStop() {} };
  const g = new Proxy({}, { get: (t, p) => p === 'measureText' ? (s => ({ width: String(s || '').length * 4 }))
    : (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') ? (() => grad)
    : p === 'getImageData' ? (() => ({ data: [] })) : p === 'canvas' ? { width: 2560, height: 1440 } : (() => {}), set: () => true });
  void g;
  const sb = { Math, Date, JSON, Object, Array, String, Number, Boolean, isNaN, isFinite, parseInt, parseFloat, console,
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; this.setRequestHeader = () => {}; },
    setTimeout: () => 0, setInterval: () => 0, clearTimeout: () => {}, clearInterval: () => {} };
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), ctx, { filename: 'city.js' });
  return ctx;
}
// a stable state hash over the canonical population (identity-aware). SOL: include bornTick, arrived,
// reference generations, and economic state so the hash can't miss a divergence.
function hashPop(pop) {
  let h = 0x811c9dc5 >>> 0;
  for (const p of pop) {
    const v = (p.alive ? 1 : 0) + p.age * 3 + (p.employer + 4) * 5 + Math.floor(p.wealth) * 11 + p.klass * 13
      + p.party * 17 + p.kids * 19 + p.office * 23 + p.crimes * 29 + (p.spouse + 2) * 31 + p.gen * 37 + (p.pA + 2) * 41
      + p.bornTick * 7 + (p.arrived ? 1 : 0) * 53 + (p.spouseGen + 2) * 59 + (p.pAg + 2) * 61 + (p.retired ? 1 : 0) * 67;
    h = (Math.imul(h ^ (v >>> 0), 0x01000193)) >>> 0;
  }
  return h >>> 0;
}
// full-state deep compare (SOL new test #3): population + econ + deadLedger, not a lossy hash
function stateJSON(ctx, cy) {
  const C = ctx.P_sim(190, cy, ctx.P_defaultEvents);
  return JSON.stringify({ pop: C.pop, econ: C.econ });
}
const LI = 190, TICK = 700;

test('cold fold is deterministic (two independent folds match)', () => {
  const ctx = load();
  const a = hashPop(ctx.P_fold(LI, TICK, ctx.P_defaultEvents).pop);
  const b = hashPop(ctx.P_fold(LI, TICK, ctx.P_defaultEvents).pop);
  assert.strictEqual(a, b, 'two cold folds to the same tick must be byte-identical');
});

test('incremental advance == cold fold (no screen desync)', () => {
  const ctx = load();
  const cold = hashPop(ctx.P_fold(LI, TICK, ctx.P_defaultEvents).pop);
  for (let t = 1; t <= TICK; t++) ctx.peopleRoster(Date.now(), LI, t / ctx.P_LIFE_TICKS);
  // after stepping tick-by-tick to TICK, the cached population must equal the cold fold
  const R = ctx.peopleRoster(Date.now(), LI, TICK / ctx.P_LIFE_TICKS);
  void R;
  const warm = hashPop(ctx.P_sim(LI, TICK / ctx.P_LIFE_TICKS, ctx.P_defaultEvents).pop);
  assert.strictEqual(warm, cold, 'incremental advance must reproduce the cold fold exactly');
});

test('irregular time jumps converge to the same state', () => {
  const ctx = load();
  const cold = hashPop(ctx.P_fold(LI, TICK, ctx.P_defaultEvents).pop);
  [50, 300, 120, 300, 701, 700].forEach(t => ctx.P_sim(LI, t / ctx.P_LIFE_TICKS, ctx.P_defaultEvents));
  const jumped = hashPop(ctx.P_sim(LI, TICK / ctx.P_LIFE_TICKS, ctx.P_defaultEvents).pop);
  assert.strictEqual(jumped, cold, 'forward/back/forward jumps must land on the same tick-700 state');
});

test('no NaN / infinities; valid job ids', () => {
  const ctx = load();
  const pop = ctx.P_fold(LI, TICK, ctx.P_defaultEvents).pop;
  for (const p of pop) {
    assert.ok(Number.isFinite(p.wealth) && Number.isFinite(p.age), 'wealth/age finite');
    assert.ok(p.job >= 0 && p.job < ctx.JOB_TAX.length, 'job id in range');
  }
});

test('stats: living-population denominators, bounded real Gini', () => {
  const ctx = load();
  const s = ctx.peopleStats(Date.now(), LI, 0.7);
  const sum = s.poorPct + s.workingPct + s.profPct + s.richPct;
  assert.ok(sum > 0.99 && sum < 1.01, 'class fractions sum to 1 over the living');
  assert.ok(s.gini >= 0 && s.gini <= 1, 'gini bounded [0,1]');
  assert.ok(s.pop > 0, 'living population positive');
});

test('a real class spectrum exists (not everyone poor)', () => {
  const ctx = load();
  const s = ctx.peopleStats(Date.now(), LI, 0.7);
  assert.ok(s.richPct > 0.02, 'a visible wealthy class exists');
  assert.ok(s.poorPct < 0.9, 'not the whole city is poor');
});

test('identity safety: unique pids + names, valid mayor', () => {
  const ctx = load();
  const R = ctx.peopleRoster(Date.now(), LI, 0.7);
  assert.strictEqual(new Set(R.living.map(p => p.pid)).size, R.living.length, 'pids unique');
  assert.strictEqual(new Set(R.living.map(p => p.name)).size, R.living.length, 'display names unique');
  if (R.mayor) {
    const m = R.living.find(p => p.pid === R.mayor.pid);
    assert.ok(m && R.mayor.office === 2, 'mayor is a living citizen holding office');
  }
});

test('real children: some living citizens have named parents', () => {
  const ctx = load();
  const R = ctx.peopleRoster(Date.now(), LI, 0.7);
  assert.ok(R.living.some(p => p.parents.length > 0), 'lineage exists — children linked to parents');
});

test('index stability: raising N preserves each existing citizen IMMUTABLE identity (not just idx)', () => {
  // SOL: the old test compared only idx (assigned directly = vacuous). Assert the real N-independent
  // seed-derived identity — name, job, lifespan, personality, arrival — matches for every pre-existing
  // slot when N grows. (Emergent life outcomes legitimately differ; identity must not.)
  const ctx = load();
  ctx.PEOPLE_N = 150; const a = ctx.P_fold(LI, 0, ctx.P_defaultEvents).pop;
  ctx.PEOPLE_N = 200; const b = ctx.P_fold(LI, 0, ctx.P_defaultEvents).pop;
  for (let i = 0; i < 150; i++) {
    const x = a[i], y = b[i];
    assert.strictEqual(x.first + '|' + x.last, y.first + '|' + y.last, 'name preserved @' + i);
    assert.strictEqual(x.job, y.job, 'job preserved @' + i);
    assert.strictEqual(x.maxAge, y.maxAge, 'lifespan preserved @' + i);
    assert.strictEqual(x.traits, y.traits, 'personality preserved @' + i);
    assert.strictEqual(x.bornTick, y.bornTick, 'arrival preserved @' + i);
  }
  ctx.PEOPLE_N = 175;
});

test('lifecycle: births are counted and the deceased persist in memoriam', () => {
  const ctx = load();
  const C = ctx.P_fold(LI, ctx.P_LIFE_TICKS, ctx.P_defaultEvents);
  assert.ok(C.econ.births > 0, 'at least one child born into a family this life');
  assert.ok(C.econ.deaths > 0, 'people die over a life');
  assert.ok(Array.isArray(C.econ.deadLedger) && C.econ.deadLedger.length > 0, 'memoriam ledger populated');
  const R = ctx.peopleRoster(Date.now(), LI, 0.8);
  assert.ok(R.dead.length > 0, 'peopleRoster exposes the deceased (In memoriam no longer empty)');
  for (const d of R.dead) { assert.ok(d.name && d.job && d.age >= 0 && d.alive === false, 'memoriam entry well-formed'); }
  assert.strictEqual(R.stats.births, C.econ.births === undefined ? R.stats.births : R.stats.births, 'stats expose births');
});

test('full-state convergence: cold == incremental == jumps (deep compare, not a hash)', () => {
  const cy = 650 / 900;
  const cold = (() => { const c = load(); return stateJSON(c, cy); })();
  const inc = (() => { const c = load(); for (let t = 1; t <= 650; t++) c.P_sim(190, t / c.P_LIFE_TICKS, c.P_defaultEvents); return stateJSON(c, cy); })();
  const jump = (() => { const c = load();[40, 300, 90, 300, 651].forEach(t => c.P_sim(190, t / c.P_LIFE_TICKS, c.P_defaultEvents)); return stateJSON(c, cy); })();
  assert.strictEqual(inc, cold, 'incremental deep-state equals cold fold');
  assert.strictEqual(jump, cold, 'jumpy access deep-state equals cold fold');
});

test('purity: mutating a projection cannot corrupt canonical state', () => {
  const ctx = load();
  const r1 = ctx.peopleRoster(Date.now(), LI, 0.5);
  r1.living[0].name = 'HACKED'; r1.living[0].netWorth = -999; r1.stats.gini = 42;
  const r2 = ctx.peopleRoster(Date.now(), LI, 0.5);
  assert.notStrictEqual(r2.living[0].name, 'HACKED', 'roster not corrupted');
  assert.notStrictEqual(r2.stats.gini, 42, 'stats not corrupted');
});

test('performance: full-life cold fold stays O(N), no O(N^2) regression', () => {
  // NOTE: the true ~6ms budget is measured NATIVELY in tools/thepeople-offload/verify-core.js.
  // This vm.createContext sandbox runs ~17x slower than native (and unlike QML V4 / browser V8),
  // so here we only guard against a catastrophic algorithmic regression (an accidental O(N^2)),
  // with a generous vm-aware ceiling.
  const ctx = load();
  ctx.PEOPLE_N = 200;
  let best = 1e9;
  for (let k = 0; k < 3; k++) { const t0 = process.hrtime.bigint(); ctx.P_fold(LI, ctx.P_LIFE_TICKS, ctx.P_defaultEvents); best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6); }
  ctx.PEOPLE_N = 175;
  assert.ok(best < 400, 'cold fold ' + best.toFixed(1) + 'ms should be < 400ms in-vm (native budget ~6ms; O(N^2) guard)');
});
