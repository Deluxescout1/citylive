// Per-call cost of the functions moved out of the 0.5fps backdrop.
// Added cost = per-call ms x (8 - 0.5) extra calls/second, per screen.
// ⚠ node is not the QML V4 runtime, so treat these as RELATIVE magnitudes, not absolute desktop CPU.
// They are still the right instrument for "is this cheap or expensive", which is the open question.
const fs = require('fs'), vm = require('vm');
function engine(path) {
  const ctx = { console, Date, Math, JSON, setTimeout, clearTimeout,
    XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path, 'utf8'), ctx);
  return ctx;
}
const noop = () => {};
function fakeCtx() {
  return new Proxy({}, { get: (o, k) => {
    if (k === 'canvas') return { width: 1552, height: 874 };
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
    if (k === 'measureText') return () => ({ width: 4 });
    if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
    return noop;
  }, set: () => true });
}

const ENGINE = '/home/deluxescout/CityLive/desktop/renderer/city.js';
// each function is timed on a land where it actually DOES something — timing drawVolcano on a
// plain measures an early return, which would report "free" and be a lie.
const CASES = [
  { land: 'volcano', egg: false, fns: ['drawVolcano'] },
  { land: 'plains',  egg: false, fns: ['drawPlainsSky'] },
  { land: 'alpine',  egg: false, fns: ['drawGondola', 'drawClimbers'] },
  { land: 'falls',   egg: true,  fns: ['drawCascades'] }
];
const CYC = 604800000, EPOCH = 1783972450746, REPS = 400;

console.log('function          land      ms/call    extra %core/screen at 0.5->8fps');
for (const C of CASES) {
  const ctx = engine(ENGINE);
  ctx.GROW_CYCLE = CYC; ctx.NOFETCH = true;
  ctx.FORCEEGG = C.egg ? C.land : null;
  if (!C.egg) { ctx.FORCEBIOME = C.land; ctx.FORCEVARIANT = 0; }
  const t0 = EPOCH + 44 * CYC + Math.round(0.45 * CYC);
  ctx.NOWOVR = ctx.CLOCK = t0;
  ctx.setup('neon', { cw: 1552, ch: 874, woff: 0, ww: 2269, pxk: 3, zoom: 2,
                      taskbarWp: 0, quality: 'balanced', frameMs: 125 });
  ctx.FORCEAGE = 0.85;
  ctx.weather.code = 95; ctx.weather.wind = 14; ctx.weather.temp = 78;
  const g = fakeCtx();
  ctx.draw(g, 'bg');                       // warm — builds mtsCache, which these read
  const nd = new Date(t0);
  for (const name of C.fns) {
    const fn = ctx[name];
    if (typeof fn !== 'function') { console.log('  MISSING ' + name); continue; }
    const wfx = ctx.wfx ? ctx.wfx() : undefined;
    for (let i = 0; i < 30; i++) fn(g, 1, t0, nd, wfx);      // discard cold calls
    const s = process.hrtime.bigint();
    for (let r = 0; r < REPS; r++) fn(g, 1, t0 + r * 125, nd, wfx);
    const ms = Number(process.hrtime.bigint() - s) / 1e6 / REPS;
    console.log('  ' + name.padEnd(16) + C.land.padEnd(9) +
      ms.toFixed(4).padStart(8) + '   +' + (ms * 7.5 / 10).toFixed(3) + '%');
  }
}
console.log('\n(x7.5 extra calls/sec from 0.5fps -> 8fps; /10 converts ms/s into % of one core)');
console.log('A land triggers at most one of these, so the per-land cost is a single line above.');
