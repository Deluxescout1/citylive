'use strict';
// THE PEOPLE — sim cache correctness + cost.
//
// Several call sites ask the citizen sim for DIFFERENT ticks in the same frame (the roster
// wants "now"; mayorState looks ahead to the term boundary). The cache used to hold ONE slot,
// so the look-ahead advanced it and the roster's rewind cold-folded the entire life EVERY
// frame — ~520 P_step calls, 77% of a frame, on every screen (2026-07-24 freeze diagnosis).
//
// These guard the multi-slot cache: interleaved requests must return exactly what an
// independent cold fold to the same tick returns (a slot must never alias another's state),
// and the steady state must not re-fold.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');

function loadEngine() {
  const sandbox = {
    Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    isNaN, isFinite, parseInt, parseFloat, console,
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {},
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), ctx, { filename: 'city.js' });
  ctx.NOFETCH = true;
  ctx.setup('neon', { cw: 427, ch: 240, woff: 0, ww: 427, pxk: 4, zoom: 1, quality: 'performance' });
  return ctx;
}

const LI = 270;                                   // an arbitrary but fixed life
const cyOf = (ctx, tick) => tick / ctx.P_LIFE_TICKS;

// Full observable state at a tick, as the shells actually consume it.
function sig(ctx, tick) {
  const r = ctx.peopleRoster(0, LI, cyOf(ctx, tick));
  const e = ctx.peopleElectionState(LI, cyOf(ctx, tick));
  return JSON.stringify({ roster: r, election: e });
}

// Reference: a FRESH engine per tick can only cold-fold, so it cannot be contaminated.
function coldSig(tick) { return sig(loadEngine(), tick); }

test('interleaved sim requests match independent cold folds', () => {
  const ctx = loadEngine();
  const A = 457, B = 520;                          // the real pair: roster tick + term look-ahead
  const expect = new Map();
  for (let f = 0; f < 4; f++) {
    for (const t of [A + f, B + f]) if (!expect.has(t)) expect.set(t, coldSig(t));
  }
  // replay the real per-frame call order: roster, look-ahead, roster again
  for (let f = 0; f < 4; f++) {
    const a = A + f, b = B + f;
    assert.strictEqual(sig(ctx, a), expect.get(a), `frame ${f}: roster tick ${a} diverged`);
    assert.strictEqual(sig(ctx, b), expect.get(b), `frame ${f}: look-ahead tick ${b} diverged`);
    assert.strictEqual(sig(ctx, a), expect.get(a), `frame ${f}: roster tick ${a} diverged on re-read`);
  }
});

test('slots do not alias — advancing one leaves the others intact', () => {
  const ctx = loadEngine();
  const lo = 300, hi = 800;
  const loSig = sig(ctx, lo);
  sig(ctx, hi);                                    // advance/fold a different slot
  assert.strictEqual(sig(ctx, lo), loSig, 'low-tick state changed after another slot advanced');
  assert.strictEqual(sig(ctx, lo), coldSig(lo), 'low-tick state no longer matches a cold fold');
});

test('rewinding to an earlier life is still correct', () => {
  const ctx = loadEngine();
  const t = 400;
  const a = sig(ctx, t);
  ctx.peopleRoster(0, LI + 1, cyOf(ctx, 600));     // different life evicts by key
  ctx.peopleRoster(0, LI + 2, cyOf(ctx, 200));
  ctx.peopleRoster(0, LI + 3, cyOf(ctx, 900));
  assert.strictEqual(sig(ctx, t), a, 'state for the original life changed after other lives were folded');
});

test('steady state does not re-fold the life every frame', () => {
  const ctx = loadEngine();
  let steps = 0;
  const orig = ctx.P_step;
  ctx.P_step = function (...a) { steps++; return orig.apply(this, a); };

  const A = 457, B = 520;
  for (let f = 0; f < 2; f++) {                    // let the slots settle
    ctx.peopleRoster(0, LI, cyOf(ctx, A + f));
    ctx.peopleElectionState(LI, cyOf(ctx, B + f));
    ctx.peopleRoster(0, LI, cyOf(ctx, A + f));
  }
  steps = 0;
  const FRAMES = 5;
  for (let f = 2; f < 2 + FRAMES; f++) {
    ctx.peopleRoster(0, LI, cyOf(ctx, A + f));
    ctx.peopleElectionState(LI, cyOf(ctx, B + f));
    ctx.peopleRoster(0, LI, cyOf(ctx, A + f));
  }
  const perFrame = steps / FRAMES;
  // one 1-tick advance per distinct tick = 2. Before the fix this was ~520.
  assert.ok(perFrame <= 8, `expected <=8 P_step calls per frame in steady state, got ${perFrame}`);
});
