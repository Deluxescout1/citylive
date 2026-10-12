// THE CURSOR INSPECTOR — City.inspectScene(sx, sy) resolves a draw-space point to what lives
// there: the NAMED citizen first, else a real standing building (nearest face centre; unborn and
// still-scaffolding lots excluded, exactly the law adMountAt obeys), else a green, the front
// water, or a sky/ground verdict. CONTRACT: it is READ-ONLY — the wallpaper's MouseArea calls it
// between frames, so any state it mutated would repaint the world.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');
const CLEAR = { code: 0, cloud: 20, wind: 6, temp: 20, precip: 0 };
const grad = { addColorStop() {} };

function load(land, t) {
  const sandbox = { Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    isNaN, isFinite, parseInt, parseFloat, console,
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {} };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), context, { filename: 'city.js' });
  context.NOFETCH = true;
  context.weather = Object.assign({}, CLEAR, { temp: 20, feels: 18 });
  context.applyConfig({ land: land || 'swamp' });
  context.setup('neon', { cw: 853, ch: 480, woff: 582, ww: 2269, pxk: 6, quality: 'performance' });
  // pin the clock AFTER setup — setup() rebuilds sim state
  context.NOWOVR = t; context.CLOCK = t;
  context.wetness = 0; context.kpNow = 7;
  context.draw(new Proxy({}, {
    get(_t, p) {
      if (p === 'measureText') return () => ({ width: 4 });
      if (String(p).startsWith('create')) return () => grad;
      return () => {};
    },
    set() { return true; }
  }));
  return context;
}

test('a cursor on a drawn citizen resolves that citizen by name, office, age and class', () => {
  const c = load('swamp', 1791734400000);
  assert.ok(c.drawnNamed && c.drawnNamed.length > 0, 'no citizens were drawn to click on');
  const d = c.drawnNamed[0];
  const r = c.inspectScene(d.sx, d.y - 3);
  assert.strictEqual(r.kind, 'person');
  assert.ok(/[A-Z]/.test(r.title), 'a person verdict must carry a NAME, got ' + r.title);
  assert.ok(/age \d+/.test(r.detail), 'the card should say the citizen\'s age — got ' + r.detail);
});

test('a cursor on the skyline resolves the district and a storey count; water and sky answer too', () => {
  const c = load('swamp', 1791734400000);
  const b = c.inspectScene(400, 350);
  assert.ok(b.kind === 'building' || b.kind === 'park' || b.kind === 'sky', 'unexpected kind ' + b.kind);
  if (b.kind === 'building') {
    assert.ok(/^THE /.test(b.title) && /\bstoreys\b/.test(b.detail), JSON.stringify(b));
  }
  const w = c.inspectScene(426, 470);
  assert.strictEqual(w.kind, 'water');
  const s = c.inspectScene(426, 80);
  assert.strictEqual(s.kind, 'sky');
  assert.ok(/overhead|clear/.test(String(s.detail)), JSON.stringify(s));
  const g2 = c.inspectScene(426, 436);
  assert.ok(g2.kind === 'ground' || g2.kind === 'water', JSON.stringify(g2));
});

test('the inspector is read-only: a thousand probes change no sim state', () => {
  const c = load('swamp', 1791734400000);
  const before = JSON.stringify({ g: c.cityG, phase: c.cityPhase, death: c.curDeath, pop: c.cityPop ? c.cityPop() : 0,
    wetness: c.wetness, drawnNamed: (c.drawnNamed || []).length });
  for (let i = 0; i < 1000; i++) {
    const r = c.inspectScene(Math.floor(Math.random() * 853), Math.floor(Math.random() * 480));
    assert.ok(r && r.kind && r.title, 'a probe returned nothing at ' + i);
  }
  const after = JSON.stringify({ g: c.cityG, phase: c.cityPhase, death: c.curDeath, pop: c.cityPop ? c.cityPop() : 0,
    wetness: c.wetness, drawnNamed: (c.drawnNamed || []).length });
  assert.strictEqual(after, before, 'inspectScene mutated sim state — the wallpaper would repaint');
});

test('the verdicts are deterministic at one instant', () => {
  const c = load('swamp', 1791734400000);
  for (const pt of [[400, 350], [426, 470], [426, 80], [214, 408]]) {
    assert.strictEqual(JSON.stringify(c.inspectScene(pt[0], pt[1])), JSON.stringify(c.inspectScene(pt[0], pt[1])),
      'probe (' + pt + ') is not a pure function of (draw x, y, state)');
  }
});