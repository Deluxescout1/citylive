'use strict';
// WHO DREW THIS PIXEL — attribution for "what IS that thing on my screen?"
//
// Written for the third sighting of THE BLUE LINES, a bug that had survived two confident
// misattributions and months of guessing. It answers the question directly instead: it loads the
// engine into a node `vm`, hands it a Proxy canvas that records every fillRect landing in a screen
// box together with `new Error().stack`, and prints the drawing function and line number.
//
// 🔑 The companion move is to SAMPLE THE COLOUR out of the user's screenshot first and grep for it.
//    A colour is an index into the source; this tool then confirms the index.
// ⚠ Node is not the runtime — trust this for ATTRIBUTION (which function, which line), not for
//   pixel fidelity or timing. Re-render in the QML harness to judge the fix.
//
// Usage:
//   node desktop/tools/whodrew.js <x0> <y0> <x1> <y1> [key=value ...]
//   keys: egg= land= woff= age= clock= hour= variant= max=
//
// Example — the blue lines, at their reproducer (they do NOT exist at the harness default age 0.85):
//   node desktop/tools/whodrew.js 330 300 400 325 egg=plateau woff=1629 age=0.45 clock=1798740450000
const fs = require('fs'), path = require('path'), vm = require('vm');
const ENGINE = path.join(__dirname, '..', '..', 'org.citylive.wallpaper', 'contents', 'js', 'city.js');

const [X0, Y0, X1, Y1] = process.argv.slice(2, 6).map(Number);
if ([X0, Y0, X1, Y1].some((n) => !Number.isFinite(n))) {
  console.error('usage: node whodrew.js <x0> <y0> <x1> <y1> [egg=… land=… woff=… age=… clock=…]');
  process.exit(2);
}
const opt = {};
for (const a of process.argv.slice(6)) { const i = a.indexOf('='); if (i > 0) opt[a.slice(0, i)] = a.slice(i + 1); }

const CYC = 604800000, EPOCH = 1783972450746;
const age = opt.age !== undefined ? Number(opt.age) : 0.85;
const woff = opt.woff !== undefined ? Number(opt.woff) : 0;
const maxRows = opt.max !== undefined ? Number(opt.max) : 20;
let now;
if (opt.clock) now = Number(opt.clock);
else { const d = new Date(EPOCH + 44 * CYC + Math.round(0.45 * CYC));
  d.setHours(opt.hour !== undefined ? Number(opt.hour) : 13, 0, 0, 0);
  const b = d.getTime(); now = b - (b % 900000) + 450000; }

const sandbox = { Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
  isNaN, isFinite, parseInt, parseFloat, console,
  performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
  setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {} };
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), ctx, { filename: 'city.js' });
ctx.NOFETCH = true;
// ⚠ egg lands live in EGG_BIOMES and are unreachable via FORCEBIOME — they need FORCEEGG.
if (opt.egg) { ctx.FORCEEGG = opt.egg; ctx.FORCEBIOME = null; } else if (opt.land) ctx.FORCEBIOME = opt.land;
ctx.FORCEVARIANT = opt.variant !== undefined ? Number(opt.variant) : 0;
ctx.applyConfig({ lat: 41.5243, lon: -72.0759 });
// his real primary geometry, at zoom 1 (world px == canvas px, so the numbers printed are WORLD px)
ctx.setup('neon', { cw: 776, ch: 437, woff: woff, ww: 2269, pxk: 3, zoom: 1, taskbarWp: 17, quality: 'balanced', frameMs: 125 });
ctx.FORCEAGE = age; ctx.NOWOVR = ctx.CLOCK = now;

const seen = new Map();
let style = '#000', pass = '';
const canvas = new Proxy({}, {
  get(_t, p) {
    if (p === 'fillStyle' || p === 'strokeStyle') return style;
    if (p === 'measureText') return (s) => ({ width: String(s || '').length * 4 });
    if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => ({ addColorStop() {} });
    if (p === 'getImageData') return () => ({ data: [] });
    if (p === 'canvas') return { width: 776, height: 437 };
    if (p === 'fillRect') return (x, y, w, h) => {
      // ⚠ big background fills would drown the output — anything over 60px a side is terrain/sky.
      // 🚨 …AND THAT BLIND SPOT HAS NOW COST TIME TWICE. It hid the plains field (mid-size bars) and
      // then a 214px cinder cone sitting over the middle of the city — both "too big for detail, too
      // small for background", both invisible to this tool, both found only after hand-editing the
      // filter. `big=1` inverts it (keep the large class, drop the specks) and `cap=` moves the
      // threshold. A tool that cannot see the thing you are looking for should say so by being
      // adjustable, not by returning a confident empty answer.
      const CAP = opt.cap !== undefined ? Number(opt.cap) : 60;
      if (opt.big) { if (!(w > 0 && h > 0) || (w < 3 && h < 12)) return; }
      else if (!(w > 0 && h > 0 && w < CAP && h < CAP)) return;
      if (!(x < X1 && x + w > X0 && y < Y1 && y + h > Y0)) return;
      const st = new Error().stack.split('\n').slice(2, 7)
        .map((s) => (s.match(/at (\S+) \(city\.js:(\d+)/) || [, '?', '?']).slice(1).join(':'))
        .filter((s) => s !== '?:?').join(' < ');
      const k = pass + ' | ' + st;
      if (!seen.has(k)) seen.set(k, { n: 0, ex: [] });
      const r = seen.get(k); r.n++;
      if (r.ex.length < 3) r.ex.push(`${Math.round(x)},${Math.round(y)} ${w}x${h} ${style}`);
    };
    return () => {};
  },
  set(_t, p, v) { if (p === 'fillStyle' || p === 'strokeStyle') style = v; return true; }
});

for (const p of ['bg', 'sky', 'cloud', 'water', 'skyfast', 'city', 'fg', 'live']) {
  pass = p;
  try { ctx.draw(canvas, p); } catch (e) { console.log('THREW in ' + p + ': ' + e.message); }
}
console.log(`box ${X0},${Y0} → ${X1},${Y1}  land=${opt.egg || opt.land || 'roll'} woff=${woff} age=${age} clock=${now}`);
if (!seen.size) console.log('nothing drew here');
for (const [k, v] of [...seen].sort((a, b) => b[1].n - a[1].n).slice(0, maxRows))
  console.log(v.n, k, '\n     ', v.ex.join(' | '));
