// The volcano scar is drawn in a flat land's vocabulary — and the test for "flat" is the land's
// RELIEF, not its name.
//
// 🚨 THIS BUG WAS FIXED ONCE AND STAYED BROKEN EVERYWHERE ELSE. Nick saw an enormous near-black dome
// in front of the town on Falador; the fix gated the smaller/ashier/faceted treatment on `curRs` —
// "the OSRS lands" — because that is where it had been seen. He then saw the identical dome on THE
// OPEN PLAINS (amp 0.46, steep 0.0), which is the same kind of land for the same reason: no tall rock
// anywhere to hide a big solid against. Naming the family instead of measuring it left plains,
// savanna, beach, swamp, salt, dunes, sprawl and dam all broken.
//
// 🔑 The property that decides whether a big solid reads as a hill or as a hole punched in the frame
// is RELIEF. This test pins that the gate asks the land, and that the two ends of the range land on
// the right side of it.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'city.js'), 'utf8');

// The shipped predicate, read out of the engine so the test cannot drift from it.
function flatRegPredicate() {
  const m = /var flatReg=!!curRs \|\| \(\(_rel\.amp\|\|0\)<([\d.]+) && \(_rel\.steep\|\|0\)<([\d.]+)\);/.exec(SRC);
  assert.ok(m, 'the relief-based flatReg gate is not in the engine — did it get reverted to a name list?');
  return { amp: parseFloat(m[1]), steep: parseFloat(m[2]) };
}

// Each land's own relief numbers, straight from the biome table.
function biomes() {
  const out = {};
  const re = /\{ k:"([a-z]+)",([^\n]*)/g;
  let m;
  while ((m = re.exec(SRC))) {
    if (out[m[1]]) continue;
    const line = m[2];
    const get = (n) => { const r = new RegExp(n + ':\\s*([0-9.]+)').exec(line); return r ? parseFloat(r[1]) : null; };
    out[m[1]] = { amp: get('amp'), steep: get('steep') };
  }
  return out;
}

const P = flatRegPredicate();
const B = biomes();
const isFlat = (k) => (B[k].amp || 0) < P.amp && (B[k].steep || 0) < P.steep;

test('the gate is the land\'s relief, not a list of land names', () => {
  assert.ok(/_rel\.amp/.test(SRC) && /_rel\.steep/.test(SRC),
    'flatReg must be derived from the biome\'s own amp/steep');
});

test('THE REPORTED LAND: the open plains gets the flat treatment', () => {
  assert.strictEqual(isFlat('plains'), true,
    'plains (amp ' + B.plains.amp + ', steep ' + B.plains.steep + ') is the land Nick reported');
});

test('every other low-relief land is covered too — that is the point of measuring instead of naming', () => {
  for (const k of ['savanna', 'beach', 'swamp', 'salt', 'dunes', 'sprawl', 'dam']) {
    assert.strictEqual(isFlat(k), true, k + ' is flat and must get the flat treatment');
  }
});

test('lands with real rock keep the full dramatic cone', () => {
  // Most of all the VOLCANO itself: a cinder cone on the volcano is the whole point of the feature.
  for (const k of ['volcano', 'alpine', 'karst', 'fjord', 'cliffs', 'mesa', 'canyon', 'hell']) {
    assert.strictEqual(isFlat(k), false, k + ' has relief to hide a solid in and must NOT be flattened');
  }
});

test('the OSRS lands still qualify, by name or by relief', () => {
  // They are also low-relief, so the `!!curRs` half is now belt-and-braces rather than the whole gate.
  for (const k of ['lumbridge', 'falador', 'ardougne', 'varrock']) {
    assert.strictEqual(isFlat(k), true, k + ' must remain covered even without the curRs check');
  }
});
