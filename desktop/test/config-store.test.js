'use strict';
// Unit tests for the settings store. Zero dependencies (node:test + assert), matching
// config-store.js's no-dependency discipline. All data here is synthetic.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../config-store');

test('wallpaper:true survives sanitize', () => {
  const out = store.sanitizeConfig({ wallpaper: true });
  assert.strictEqual(out.wallpaper, true);
});

test('tri-state: explicit false survives, other falsy junk drops', () => {
  const out = store.sanitizeConfig({ wallpaper: false });
  assert.strictEqual(out.wallpaper, false);

  for (const v of [0, null, undefined, '']) {
    const undecided = store.sanitizeConfig({ wallpaper: v });
    assert.ok(!('wallpaper' in undecided), `expected no key for ${JSON.stringify(v)}`);
  }
  assert.ok(!('wallpaper' in store.sanitizeConfig({})));
});

test('unknown keys are still dropped (wallpaper is the only new key)', () => {
  const out = store.sanitizeConfig({ wallpaper: true, junk: 'x', evil: { a: 1 } });
  assert.deepStrictEqual(Object.keys(out).sort(), ['birthdays', 'cycle', 'wallpaper']);
});

test('birthdays / cycle / lat-lon sanitize behavior is preserved (regression net)', () => {
  const out = store.sanitizeConfig({
    cycle: 'weekly',                                  // legacy alias → 1w
    birthdays: [
      { m: 3, d: 4, label: 'a party!', pink: true },  // label uppercased + stripped
      { m: 99, d: 1, label: 'BAD' },                  // out-of-range month → dropped
      'not an object'                                 // junk → dropped
    ],
    lat: 41.5, lon: -72.1
  });
  assert.strictEqual(out.cycle, '1w');
  assert.strictEqual(out.birthdays.length, 1);
  assert.deepStrictEqual(out.birthdays[0], { m: 3, d: 4, label: 'A PARTY', pink: true });
  assert.strictEqual(out.lat, 41.5);
  assert.strictEqual(out.lon, -72.1);
});

test('write → read round-trip persists the wallpaper flag', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'citylive-cfg-'));
  const file = path.join(dir, 'config.json');
  try {
    store.writeConfig(file, { wallpaper: true, cycle: '2w', birthdays: [] });
    const back = store.readConfig(file);
    assert.strictEqual(back.wallpaper, true);
    assert.strictEqual(back.cycle, '2w');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a Settings-panel-shaped save (no wallpaper key) clears the flag — documents why main.js must re-overlay it', () => {
  // The renderer's gather() builds only { birthdays, cycle, lat?, lon? }. Sanitizing that
  // yields no wallpaper key, so a naive save would turn wallpaper mode off on disk. main.js
  // must overlay { wallpaper:true } when live, which this asserts is the correct mechanism.
  const panelSave = { birthdays: [], cycle: '1w' };
  assert.ok(!('wallpaper' in store.sanitizeConfig(panelSave)));
  assert.ok('wallpaper' in store.sanitizeConfig(Object.assign({}, panelSave, { wallpaper: true })));
});

test('write → read round-trip persists an explicit wallpaper:false opt-out', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'citylive-cfg-'));
  const file = path.join(dir, 'config.json');
  try {
    store.writeConfig(file, { wallpaper: false, cycle: '1w', birthdays: [] });
    const back = store.readConfig(file);
    assert.strictEqual(back.wallpaper, false);
    assert.strictEqual(back.cycle, '1w');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a Settings-panel-shaped save merged with an explicit wallpaper decision preserves it either way', () => {
  // Same panel shape as gather() would produce, but simulating main.js overlaying the
  // user's last explicit wallpaper decision before persisting.
  const panelSave = { birthdays: [], cycle: '1w' };
  assert.strictEqual(
    store.sanitizeConfig(Object.assign({}, panelSave, { wallpaper: false })).wallpaper,
    false
  );
  assert.strictEqual(
    store.sanitizeConfig(Object.assign({}, panelSave, { wallpaper: true })).wallpaper,
    true
  );
});
