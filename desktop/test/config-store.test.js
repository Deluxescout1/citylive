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

test('unknown keys are still dropped, valid new keys survive alongside junk', () => {
  const out = store.sanitizeConfig({
    wallpaper: true, quality: 'performance', era: 'boston', disasters: 'rare',
    junk: 'x', evil: { a: 1 }
  });
  assert.deepStrictEqual(
    Object.keys(out).sort(),
    ['birthdays', 'cycle', 'disasters', 'era', 'quality', 'wallpaper']
  );
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

test('quality: valid values survive, invalid/absent drop', () => {
  assert.strictEqual(store.sanitizeConfig({ quality: 'spectacle' }).quality, 'spectacle');
  assert.strictEqual(store.sanitizeConfig({ quality: 'performance' }).quality, 'performance');
  for (const v of ['ultra', 'balanced', 42, '', null]) {
    assert.ok(!('quality' in store.sanitizeConfig({ quality: v })), `expected no key for ${JSON.stringify(v)}`);
  }
  assert.ok(!('quality' in store.sanitizeConfig({})));
});

test('era: "auto" and lowercase-alpha names survive, invalid/absent drop', () => {
  assert.strictEqual(store.sanitizeConfig({ era: 'auto' }).era, 'auto');
  assert.strictEqual(store.sanitizeConfig({ era: 'tokyo' }).era, 'tokyo');
  assert.strictEqual(store.sanitizeConfig({ era: 'neworleans' }).era, 'neworleans');
  for (const v of ['ERA!', 'Tokyo', 'a', 42, '', 'this-name-is-way-too-long-to-be-valid-here']) {
    assert.ok(!('era' in store.sanitizeConfig({ era: v })), `expected no key for ${JSON.stringify(v)}`);
  }
  assert.ok(!('era' in store.sanitizeConfig({})));
});

test('disasters: valid values survive, invalid/absent drop', () => {
  assert.strictEqual(store.sanitizeConfig({ disasters: 'rare' }).disasters, 'rare');
  assert.strictEqual(store.sanitizeConfig({ disasters: 'normal' }).disasters, 'normal');
  assert.strictEqual(store.sanitizeConfig({ disasters: 'frequent' }).disasters, 'frequent');
  for (const v of ['ultra', 42, '', null]) {
    assert.ok(!('disasters' in store.sanitizeConfig({ disasters: v })), `expected no key for ${JSON.stringify(v)}`);
  }
  assert.ok(!('disasters' in store.sanitizeConfig({})));
});

test('locationName survives sanitize only alongside a valid lat/lon pair', () => {
  const withCoords = store.sanitizeConfig({ lat: 41.5, lon: -72.1, locationName: 'Norwich, CT' });
  assert.strictEqual(withCoords.locationName, 'Norwich, CT');

  const noCoords = store.sanitizeConfig({ locationName: 'Norwich, CT' });
  assert.ok(!('locationName' in noCoords));

  const badCoords = store.sanitizeConfig({ lat: 999, lon: -72.1, locationName: 'Norwich, CT' });
  assert.ok(!('locationName' in badCoords));
});

test('locationName is sanitized: control chars stripped, whitespace collapsed, length capped', () => {
  const out = store.sanitizeConfig({
    lat: 41.5, lon: -72.1,
    locationName: '  Nor\x00wich,   CT  ' + 'x'.repeat(80)
  });
  assert.strictEqual(out.locationName.length, 60);
  assert.ok(!/[\x00-\x1F\x7F]/.test(out.locationName));
  assert.ok(!/\s\s/.test(out.locationName));
  assert.strictEqual(out.locationName.indexOf('Norwich, CT'), 0);
});

test('an empty/whitespace-only locationName drops even with valid lat/lon', () => {
  const out = store.sanitizeConfig({ lat: 41.5, lon: -72.1, locationName: '   ' });
  assert.ok(!('locationName' in out));
});

test('write → read round-trip persists locationName alongside lat/lon', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'citylive-cfg-'));
  const file = path.join(dir, 'config.json');
  try {
    store.writeConfig(file, { birthdays: [], cycle: '1w', lat: 41.5243, lon: -72.0759, locationName: 'Norwich, CT' });
    const back = store.readConfig(file);
    assert.strictEqual(back.locationName, 'Norwich, CT');
    assert.strictEqual(back.lat, 41.5243);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('write → read round-trip persists quality / era / disasters', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'citylive-cfg-'));
  const file = path.join(dir, 'config.json');
  try {
    store.writeConfig(file, {
      birthdays: [], cycle: '1w',
      quality: 'performance', era: 'boston', disasters: 'frequent'
    });
    const back = store.readConfig(file);
    assert.strictEqual(back.quality, 'performance');
    assert.strictEqual(back.era, 'boston');
    assert.strictEqual(back.disasters, 'frequent');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('finale: "auto" and the 11 exact apocalypse names survive, invalid/absent drop', () => {
  const NAMES = ['meteors', 'nuke', 'sunburst', 'ai', 'bh', 'alienwar', 'frost', 'kaiju', 'flood', 'kaijuwar', 'pollution'];
  assert.strictEqual(store.sanitizeConfig({ finale: 'auto' }).finale, 'auto');
  NAMES.forEach((n) => {
    assert.strictEqual(store.sanitizeConfig({ finale: n }).finale, n);
  });
  for (const v of ['METEORS', 'zombies', 'Nuke', 42, '', null, 'auto ', 'KAIJUWAR', 'Pollution', 'kaiju war', 'pollution ']) {
    assert.ok(!('finale' in store.sanitizeConfig({ finale: v })), `expected no key for ${JSON.stringify(v)}`);
  }
  assert.ok(!('finale' in store.sanitizeConfig({})));
});

test('worldRestartAt: finite positive integers (coerced/floored) survive, junk drops', () => {
  assert.strictEqual(store.sanitizeConfig({ worldRestartAt: 1234567890123 }).worldRestartAt, 1234567890123);
  assert.strictEqual(store.sanitizeConfig({ worldRestartAt: 1234567890123.9 }).worldRestartAt, 1234567890123);
  assert.strictEqual(store.sanitizeConfig({ worldRestartAt: '1700000000000' }).worldRestartAt, 1700000000000);
  for (const v of [0, -5, NaN, Infinity, -Infinity, 'not a number', null, undefined, {}, []]) {
    assert.ok(!('worldRestartAt' in store.sanitizeConfig({ worldRestartAt: v })), `expected no key for ${JSON.stringify(v)}`);
  }
  assert.ok(!('worldRestartAt' in store.sanitizeConfig({})));
});

test('worldRestartMode: only apoc|fresh survive, invalid/absent drop', () => {
  assert.strictEqual(store.sanitizeConfig({ worldRestartMode: 'apoc' }).worldRestartMode, 'apoc');
  assert.strictEqual(store.sanitizeConfig({ worldRestartMode: 'fresh' }).worldRestartMode, 'fresh');
  for (const v of ['APOC', 'auto', 42, '', null]) {
    assert.ok(!('worldRestartMode' in store.sanitizeConfig({ worldRestartMode: v })), `expected no key for ${JSON.stringify(v)}`);
  }
  assert.ok(!('worldRestartMode' in store.sanitizeConfig({})));
});

test('worldRestartAt/worldRestartMode persist independently of finale', () => {
  const onlyRestart = store.sanitizeConfig({ worldRestartAt: 1700000000000, worldRestartMode: 'fresh' });
  assert.ok(!('finale' in onlyRestart));
  assert.strictEqual(onlyRestart.worldRestartAt, 1700000000000);
  assert.strictEqual(onlyRestart.worldRestartMode, 'fresh');

  const onlyFinale = store.sanitizeConfig({ finale: 'kaiju' });
  assert.ok(!('worldRestartAt' in onlyFinale));
  assert.ok(!('worldRestartMode' in onlyFinale));
  assert.strictEqual(onlyFinale.finale, 'kaiju');

  const both = store.sanitizeConfig({ finale: 'flood', worldRestartAt: 1700000000000, worldRestartMode: 'apoc' });
  assert.strictEqual(both.finale, 'flood');
  assert.strictEqual(both.worldRestartAt, 1700000000000);
  assert.strictEqual(both.worldRestartMode, 'apoc');
});

test('write → read round-trip persists finale / worldRestartAt / worldRestartMode', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'citylive-cfg-'));
  const file = path.join(dir, 'config.json');
  try {
    store.writeConfig(file, {
      birthdays: [], cycle: '1w',
      finale: 'nuke', worldRestartAt: 1700000000000, worldRestartMode: 'apoc'
    });
    const back = store.readConfig(file);
    assert.strictEqual(back.finale, 'nuke');
    assert.strictEqual(back.worldRestartAt, 1700000000000);
    assert.strictEqual(back.worldRestartMode, 'apoc');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
