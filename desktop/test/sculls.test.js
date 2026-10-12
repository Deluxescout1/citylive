// THE CREW SCULLS — dawn practice on the front water. An 8+ shell crosses the world on the clock:
// pure function of (world x, clock), so the three monitors agree mid-bezel. The crews are out only
// in the 05:00–09:00 local window, stay ashore in heavy rain, and the whole shell rides inside the
// front water band.
// Detection: every op of the shell carries a STYLE UNIQUE TO drawSculls in this engine — the hull
// pair, the crew dress and the oar brown. The test counts all of them together (a hull alone is
// one fillRect; a fully-visible shell is ~35+ ops), so "one visible hull sliver" can never
// substitute for a real crew on screen.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');
const CLEAR = { code: 0, cloud: 20, wind: 6, temp: 20, precip: 0 };
const RAIN = { code: 63, cloud: 98, wind: 14, temp: 20, precip: 2.4 };

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
  // ⚠ pin the clock AFTER setup — setup() rebuilds sim state; before, "dawn" frames ran at "now"
  context.NOWOVR = t; context.CLOCK = t;
  context.wetness = 0; context.kpNow = 7;
  return context;
}

const STYLES = ['rgba(30,36,46,0.95)', 'rgba(9,11,15,0.95)',      // hull day / night
                '#2c3138', '#15181e',                             // crew dress day / night
                'rgba(120,92,50,0.9)', 'rgba(52,40,26,0.9)'];     // oars day / night

function scullFrame(land, t, wx) {
  const c = load(land, t, wx);
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
  const shell = ops.filter(o => STYLES.indexOf(o[0]) >= 0);
  return { c, shell, all: ops };
}

test('the shell palette stays unique to the sculls', () => {
  const src = fs.readFileSync(ENGINE, 'utf8');
  const lines = src.split('\n').filter(l => STYLES.some(st => l.indexOf(st) >= 0));
  const inRange = lines.length;
  // every one of these six literals may appear only inside drawSculls itself (lines ~18.45k)
  assert.ok(lines.every(l => l.indexOf('drawSculls') >= 0 || (l.indexOf('hull=') >= 0 || l.indexOf('body=') >= 0 || l.indexOf('day?') >= 0)),
    'a shell style literal leaked outside drawSculls — the count test would count someone else');
});

test('a full crew is on the water at a dawn, inside the water band, no NaN', () => {
  const d = new Date(); d.setHours(6, 30, 0, 0);
  let found = null;
  for (const land of ['swamp', 'karst']) {
    for (let i = 0; i < 40 && !found; i++) {
      const f = scullFrame(land, d.getTime() + i * 86400000 * 1.05);
      if (f.shell.length >= 24) {
        found = f;
        assert.ok(f.shell.every(o => !o[5]), land + ': a scull rect drew NaN');
        // the shell rides the FRONT band: below the skyline, on the water
        const seaY = f.c.SEA_Y, botY = f.c.SH - (f.c.TASKBAR_WP || 0);
        assert.ok(f.shell.every(o => o[2] >= seaY - 8), land + ': the shell painted above its own water');
        assert.ok(f.shell.every(o => o[2] <= botY), land + ': the shell drew into the taskbar allowance');
        // a REAL crew: eight rowers means eight head pixels, not a hull and a prayer
        assert.ok(f.shell.filter(o => String(o[0]).charAt(0) === '#').length >= 8,
          land + ': only ' + f.shell.filter(o => String(o[0]).charAt(0) === '#').length + ' crew pixels — not an eight');
      }
    }
  }
  assert.ok(found, 'no dawn in 40 days had a full crew visible on either front-river land');
});

test('the crews are ashore at noon and in heavy rain', () => {
  const noon = new Date(); noon.setHours(13, 0, 0, 0);
  let noonHits = 0;
  for (let i = 0; i < 30; i++) {
    const f = scullFrame('swamp', noon.getTime() + i * 86400000);
    if (f.shell.length > 0) noonHits++;
  }
  assert.strictEqual(noonHits, 0, 'a crew launched during the day');
  const d = new Date(); d.setHours(6, 30, 0, 0);
  let rainHits = 0;
  for (let i = 0; i < 12; i++) {
    const f = scullFrame('swamp', d.getTime() + i * 86400000, RAIN);
    if (f.shell.length > 0) rainHits++;
  }
  assert.strictEqual(rainHits, 0, 'a crew launched into heavy rain');
});

test('the shells are deterministic', () => {
  const d = new Date(); d.setHours(6, 30, 0, 0);
  const a = scullFrame('swamp', d.getTime()).shell.length;
  const b = scullFrame('swamp', d.getTime()).shell.length;
  assert.strictEqual(a, b, 'same instant, different crew — the shell is not a pure function');
});