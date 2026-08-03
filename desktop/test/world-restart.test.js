// A NEW WORLD MUST BE A NEW WORLD, AND A SAVE MUST NOT UNDO ONE.
//
// Micah, on v3.31.0, both symptoms of two different bugs in the same path:
//   "can I just keep pressing 'new world' until I get the one I want? … it just resets to the same
//    one im at"      → the restart moved the PHASE and never the life INDEX, so the land, the city
//                       and the name were whatever the current real-world week says, for ever.
//   "I just started a fresh one and pressed save and it reset to my dead city"
//                    → the settings form builds its payload from its own fields, so every Save
//                       dropped `worldRestartAt` and the shift fell back to 0.
//
// This pins the first from both sides — the identity MUST change, the phase MUST NOT — because the
// two are easy to fix in a way that breaks the other, and neither is visible in a single frame.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'city.js'), 'utf8');
const CYCLE = 7 * 24 * 3600 * 1000;

// lift the real implementation out of the engine rather than restating it
const fnSrc = SRC.slice(SRC.indexOf('function worldShiftFrom('));
const body = fnSrc.slice(0, fnSrc.indexOf('\n}\n') + 3);
const worldShiftFrom = new Function('GROW_EPOCH', 'GROW_OFFSET_DAYS', 'GROW_CYCLE', 'APOC_AT',
  body + '; return worldShiftFrom;')(0, 0, CYCLE, 0.98);

const lifeIndex = (now, shift) => Math.floor((now + shift) / CYCLE);
const phase = (now, shift) => ((((now + shift) % CYCLE) + CYCLE) % CYCLE) / CYCLE;

test('a fresh restart lands the world newborn', () => {
  const t = 1785000000000;
  const s = worldShiftFrom(t, 'fresh');
  assert.ok(Math.abs(phase(t, s) - 0.0005) < 1e-6, 'phase should be newborn, got ' + phase(t, s));
});

test('an apoc restart lands the world AT detonation', () => {
  const t = 1785000000000;
  const s = worldShiftFrom(t, 'apoc');
  assert.ok(Math.abs(phase(t, s) - 0.98) < 1e-6, 'phase should be APOC_AT, got ' + phase(t, s));
});

test('pressing new world again gives a DIFFERENT world', () => {
  const t = 1785000000000;
  const seen = new Set();
  for (let i = 0; i < 8; i++) {
    const at = t + i * 2000;                       // presses two seconds apart
    seen.add(lifeIndex(at, worldShiftFrom(at, 'fresh')));
  }
  assert.strictEqual(seen.size, 8,
    'eight presses should give eight worlds, got ' + seen.size + ' — the restart is not moving the life index');
});

test('…and every one of them is still newborn', () => {
  const t = 1785000000000;
  for (let i = 0; i < 8; i++) {
    const at = t + i * 2000;
    const p = phase(at, worldShiftFrom(at, 'fresh'));
    assert.ok(Math.abs(p - 0.0005) < 1e-6, 'press ' + i + ' phase ' + p + ' — identity moved but so did the age');
  }
});

test('the shift stays inside safe integer range', () => {
  for (let i = 0; i < 200; i++) {
    const at = 1785000000000 + i * 97_000;
    assert.ok(Math.abs(worldShiftFrom(at, 'fresh')) < Number.MAX_SAFE_INTEGER / 16,
      'shift is large enough to lose precision');
  }
});

test('the settings form carries worldRestartAt through a save', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'settings.html'), 'utf8');
  // ⚠ slice to the function's own `return cfg;` — an earlier attempt cut at 'bdayAdd', which appears
  // as an element id in the markup long before the script, so the slice was EMPTY and the assertion
  // was testing nothing. A test that reads the wrong region passes for the wrong reason.
  const gStart = html.indexOf('function gatherCity');
  const gather = html.slice(gStart, html.indexOf('return cfg;', gStart));
  assert.ok(/worldRestartAt/.test(gather),
    'gatherCity() must re-emit worldRestartAt or every Save silently discards the restart');
  assert.ok(/worldRestartMode/.test(gather), 'gatherCity() must re-emit worldRestartMode too');
});
