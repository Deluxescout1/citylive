// THE BIG WHEEL — a per-life landmark on the front shore. ~2 lives in 5 build one at a hashed
// promenade position; it exists only once the town has grown (the RECOMPUTED cityG, not a pin —
// draw() derives cityG from the clock every frame), turns at a fixed angular speed, runs faster on
// the city's own festival days, and burns a warm rim after dark. It is gone at the apocalypse.
// Detection: the legs and the night hub paint colour literals (#3a4046 / #14181c / #101317) that
// occur on exactly ONE line of the engine — so the test counts wheel structure, not house paint.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');
const CLEAR = { code: 0, cloud: 20, wind: 6, temp: 20, precip: 0 };
const UNIQ = ['#3a4046', '#14181c', '#101317'];

function load(land, t, wx) {
  const sandbox = { Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    isNaN, isFinite, parseInt, parseFloat, console,
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {} };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), context, { filename: 'city.js' });
  context.NOFETCH = true;
  context.weather = Object.assign({}, CLEAR, { temp: 20, feels: 18 }, wx || {});
  context.applyConfig({ land });
  context.setup('neon', { cw: 853, ch: 480, woff: 582, ww: 2269, pxk: 6, quality: 'performance' });
  // ⚠ pin the clock AFTER setup — setup() rebuilds sim state
  context.NOWOVR = t; context.CLOCK = t;
  context.wetness = 0; context.kpNow = 7;
  return context;
}

function wheelFrame(land, t) {
  const c = load(land, t);
  const ops = [];
  let s = '';
  const g = new Proxy({}, {
    get(_t, p) {
      if (p === 'measureText') return () => ({ width: 4 });
      if (String(p).startsWith('create')) return () => { ops.push(['GRAD']); return { addColorStop() {} }; };
      if (p === 'getImageData') return () => ({ data: [] });
      if (p === 'fillRect') return (x, y, w, h) => {
        ops.push([s, x | 0, y | 0, w | 0, h | 0,
          Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(w) || Number.isNaN(h)]);
      };
      return () => {};
    },
    set(_t, p, v) { if (p === 'fillStyle') s = v; return true; }
  });
  c.draw(g, undefined);
  return { c, legs: ops.filter(o => UNIQ.indexOf(o[0]) >= 0) };
}

test('the wheel structure colours stay unique', () => {
  const src = fs.readFileSync(ENGINE, 'utf8');
  const lines = src.split('\n').filter(l => UNIQ.some(u => l.indexOf(u) >= 0));
  assert.ok(lines.length >= 2 && lines.length <= 3, 'the big wheel lost or shared its structural colours (' + lines.length + ' lines)');
  assert.ok(lines.every(l => l.indexOf('legC') >= 0 || l.indexOf('hubY') >= 0 || l.indexOf('#2c3138') >= 0 || l.indexOf('g.fillStyle=day?') >= 0),
    'a wheel colour literal appears outside the wheel renderer');
});

test('a grown coastal life that rolled a wheel stands one, and the town gate holds', () => {
  const base = new Date(1791734400000);
  let wheelDay = null;
  const days = [];
  for (let i = 0; i < 120 && !(wheelDay && days.length > 2); i++) {
    const t = base.getTime() + i * 86400000;
    const f = wheelFrame('beach', t);
    days.push({ t: t, cityG: f.c.cityG, legs: f.legs.length, nan: f.legs.some ? f.legs.some(o => o[5]) : false });
    if (f.legs.length >= 40 && !wheelDay) wheelDay = t;
  }
  assert.ok(wheelDay, 'no wheel-life day in 120 days had a wheel on screen — the roll, the position hash or the gates froze');
  for (const d of days) {
    if (d.nan) assert.fail('the wheel drew a NaN rect at ' + new Date(d.t));
    // ⚠ the gate reads the DERIVED cityG — a wheel day must be a grown day, and conversely a
    // wheel never stands in a barely-grown town
    if (d.legs > 0 && d.cityG < 0.28) assert.fail('the wheel stood in a town of cityG=' + d.cityG.toFixed(2));
  }
});

test('the wheel turns: the gondola positions move with the clock inside one life', () => {
  const base = new Date(1791734400000);
  let found = null;
  for (let i = 0; i < 120 && !found; i++) {
    const t = base.getTime() + i * 86400000;
    if (wheelFrame('beach', t).legs.length >= 40) found = t;
  }
  assert.ok(found, 'no wheel-life day found for the rotation probe');
  // rotation lives in the SPOKES and the gondolas (the legs are the static A-frame, identical by
  // design). The spoke ink is the rim colour; assert its pixel pattern steps between two instants.
  const shell = (t) => {
    const c = load('beach', t);
    const ops = [];
    let s = '';
    const g = new Proxy({}, {
      get(_t, p) {
        if (p === 'measureText') return () => ({ width: 4 });
        if (String(p).startsWith('create')) return () => { ops.push(['GRAD']); return { addColorStop() {} }; };
        if (p === 'getImageData') return () => ({ data: [] });
        if (p === 'fillRect') return (x, y, w, h) => { ops.push([s, x | 0, y | 0]); };
        return () => {};
      },
      set(_t, p, v) { if (p === 'fillStyle') s = v; return true; }
    });
    c.draw(g, undefined);
    return ops.filter(o => UNIQ.indexOf(o[0]) >= 0 || String(o[0]).indexOf('52,58,66') >= 0 ||
               ['#d23b3b', '#2f6bb0', '#d9a72b', '#b0508a', '#3a9a5f'].indexOf(o[0]) >= 0);
  };
  const A = shell(found + 30000), B = shell(found + 33000);
  assert.ok(A.length > 0, 'the wheel painted nothing to compare');
  assert.ok(!frozen(A, B), 'the wheel is frozen — spoke positions did not move in three seconds of clock');
  function frozen(p, q) { return p.length === q.length && p.every((o, i) => o[1] === q[i][1] && o[2] === q[i][2]); }
});

test('a non-coastal land never grows a wheel', () => {
  let hits = 0;
  for (let i = 0; i < 40; i++) { if (wheelFrame('mesa', 1791734400000 + i * 86400000).legs.length > 0) hits++; }
  assert.strictEqual(hits, 0, 'the flats grew a ferris wheel');
});