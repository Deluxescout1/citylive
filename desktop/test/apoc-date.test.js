// Micah: "Is there a way to put a 'planned date of apocalypse' on there?" The settings offered a clock
// HOUR, which on a week-long life can say 10 AM but not WHICH 10 AM.
//
// A life ends when `lifeIndexOf` ticks over, so pinning that boundary to an exact instant is the same
// alignment `apocHour` already performs, with a full timestamp. This locks the contract that matters:
// THE CHOSEN MOMENT IS A LIFE BOUNDARY — on every cycle we offer, including the ones the hour picker
// legitimately cannot serve.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

function loadEngine() {
  const fs = require('fs');
  const src = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'city.js'), 'utf8');
  const sandbox = { console, Date, Math, JSON, isFinite, parseInt, parseFloat, setTimeout, clearTimeout };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  require('vm').createContext(sandbox);
  new (require('vm').Script)(src + '\n;this.__api={applyConfig:applyConfig,lifeIndexOf:lifeIndexOf,' +
    'get GROW_CYCLE(){return GROW_CYCLE},get GROW_ALIGN(){return GROW_ALIGN},get APOC_AT_MS(){return APOC_AT_MS}};')
    .runInContext(sandbox);
  return sandbox.__api;
}

const CYCLES = { '1h': 3600000, '12h': 43200000, '1d': 86400000, '3d': 259200000,
                 '1w': 604800000, '2w': 1209600000, '3w': 1814400000 };

test('the chosen instant IS a life boundary, on every cycle', () => {
  const c = loadEngine();
  // a deliberately awkward moment: not on the hour, not on a day boundary, not UTC-aligned
  const chosen = new Date('2026-11-17T13:47:00Z').getTime();
  for (const [name, ms] of Object.entries(CYCLES)) {
    c.applyConfig({ cycle: name, apocAt: chosen });
    const before = c.lifeIndexOf(chosen - 1);
    const at     = c.lifeIndexOf(chosen);
    assert.strictEqual(at, before + 1,
      `${name}: the world must roll over exactly AT the chosen moment (got ${before} -> ${at})`);
  }
});

test('and every whole cycle after it is also a boundary', () => {
  const c = loadEngine();
  const chosen = new Date('2027-01-02T04:05:00Z').getTime();
  c.applyConfig({ cycle: '1w', apocAt: chosen });
  const cyc = c.GROW_CYCLE;
  for (let k = 1; k <= 4; k++) {
    const t = chosen + k * cyc;
    assert.strictEqual(c.lifeIndexOf(t), c.lifeIndexOf(t - 1) + 1, `boundary ${k} cycles later`);
  }
});

test('an exact date OUTRANKS the hour picker', () => {
  const c = loadEngine();
  const chosen = new Date('2026-09-09T09:09:00Z').getTime();
  // both set at once: the specific answer must win, whichever order they arrive in
  c.applyConfig({ cycle: '1d', apocHour: 20, apocAt: chosen });
  assert.strictEqual(c.lifeIndexOf(chosen), c.lifeIndexOf(chosen - 1) + 1,
    'apocAt must decide the boundary while apocHour is also set');
});

test('clearing the date falls back to the hour, and then to unaligned', () => {
  const c = loadEngine();
  c.applyConfig({ cycle: '1d', apocHour: 20, apocAt: new Date('2026-09-09T09:09:00Z').getTime() });
  const pinned = c.GROW_ALIGN;
  c.applyConfig({ cycle: '1d', apocHour: 20, apocAt: 0 });
  assert.notStrictEqual(c.GROW_ALIGN, pinned, 'clearing the date must release the pin');
  c.applyConfig({ cycle: '1d', apocHour: -1, apocAt: 0 });
  assert.strictEqual(c.GROW_ALIGN, 0, 'neither set → no shift at all');
});
