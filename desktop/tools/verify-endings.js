'use strict';
// ✅ DOES EVERY ENDING ACTUALLY DRAW? — the release gate for the end-times work.
//
// 43 endings were built over several days and the log records three separate occasions where one was
// SHIPPED DRAWING NOTHING: ragnarok had no `apocHit` branch and no `APOC_SWEEP` row so the skyline
// stood intact through the end of the world; the blood layer was switched off for every apocalypse at
// once; and the titans' body pass sat commented out for two commits with a whole rank missing. None
// of those were caught by looking at one frame of one ending.
// 🔑 A COUNT OF FILLS IS NOT BEAUTY, BUT ZERO FILLS IS A BUG EVERY TIME. This asks the cheap question
// of all of them at once: at three points on its arc, does this ending put anything on the screen,
// does its front demolish, and does it ever finish?
//
// Usage: node desktop/tools/verify-endings.js [land=plains]
const fs = require('fs'), path = require('path'), vm = require('vm');
const ENGINE = path.join(__dirname, '..', '..', 'org.citylive.wallpaper', 'contents', 'js', 'city.js');
const SRC = fs.readFileSync(ENGINE, 'utf8');
const opt = {};
for (const a of process.argv.slice(2)) { const i = a.indexOf('='); if (i > 0) opt[a.slice(0, i)] = a.slice(i + 1); }
const LAND = opt.land || 'plains';
const CYC = 604800000, EPOCH = 1783972450746;

function ctxFor() {
  const sb = { Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, isNaN, isFinite,
    parseInt, parseFloat, console: { log() {}, warn() {}, error() {} },
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {} };
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  vm.runInContext(SRC, ctx, { filename: 'city.js' });
  ctx.NOFETCH = true;
  ctx.applyConfig({ lat: 41.5243, lon: -72.0759, cycle: '1w' });
  return ctx;
}

const probe = ctxFor();
// 🚨🔑 `DEATHS` IS NOT THE LIST OF ENDINGS AND HAS NOT BEEN FOR A LONG TIME. It holds the ORIGINAL
// twelve, and everything added since deliberately stayed out of it — appending to `DEATHS` re-maps
// `h % DEATHS.length` and rewrites the fate of every life that has already happened (the ninetails
// finding). So the real roster is the UNION of every table that describes an ending, and a verifier
// that trusts one of them checks a quarter of the game and reports a clean bill.
const OSRS = ['massacre', 'logout', 'wilderness', 'godwars', 'banwave', 'ninetails'];
const seen = new Set();
const DEATHS = [];
for (const src of [probe.DEATHS || [], Object.keys(probe.APOC_STRIKE_AP || {}),
                   Object.keys(probe.APOC_X || {}), Object.keys(probe.APOC_SWEEP || {}), OSRS])
  for (const k of src) if (k && !seen.has(k)) { seen.add(k); DEATHS.push(k); }
if (!DEATHS.length) { console.error('could not read any ending table from the engine'); process.exit(2); }

function run(death, ap) {
  const ctx = ctxFor();
  ctx.FORCEBIOME = LAND; ctx.FORCEEGG = null;
  ctx.setup('city', { cw: 776, ch: 437, woff: 776, ww: 2269, pxk: 3, zoom: 1,
                      taskbarWp: 17, quality: 'balanced', frameMs: 125 });
  const d = new Date(EPOCH + 62 * CYC + Math.round(0.38 * CYC)); d.setHours(13, 10, 0, 0);
  ctx.NOWOVR = ctx.CLOCK = d.getTime();
  ctx.FORCEAGE = 0.85;
  ctx.FORCEDEATH = death;
  ctx.FORCEAPOCMS = Math.round(ap * 0.02 * CYC);
  let fills = 0, style = '#000';
  const canvas = new Proxy({}, { get(_t, p) {
    if (p === 'fillStyle' || p === 'strokeStyle') return style;
    if (p === 'measureText') return (s) => ({ width: String(s || '').length * 4 });
    if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => ({ addColorStop() {} });
    if (p === 'getImageData') return () => ({ data: [] });
    if (p === 'canvas') return { width: 776, height: 437 };
    if (p === 'fillRect') return (x, y, w, h) => { if (w > 0 && h > 0) fills++; };
    return () => {};
  }, set(_t, p, v) { if (p === 'fillStyle' || p === 'strokeStyle') style = v; return true; } });
  let err = null;
  try { ctx.draw(canvas, 'bg'); ctx.draw(canvas, 'live'); } catch (e) { err = String(e.message || e).slice(0, 70); }
  let hit = false, full = false;
  try { hit = !!ctx.apocHit(776 + 300); full = !!ctx.apocFull(); } catch (e) {}
  return { fills, err, hit, full, sweep: ctx.APOC_SWEEP ? ctx.APOC_SWEEP[death] : undefined };
}

const BASE = run('logout', 0.0).fills;   // a living-ish frame, for scale
const rows = [];
for (const d of DEATHS) {
  const a = run(d, 0.20), b = run(d, 0.55), c = run(d, 0.90);
  rows.push({ d, a, b, c });
}
console.log('VERIFY ENDINGS — ' + DEATHS.length + ' of them, land=' + LAND + '  (fills at ap 0.20 / 0.55 / 0.90)');
console.log('ending          ap.20   ap.55   ap.90   hit@.55  full@.90  notes');
let bad = 0;
for (const r of rows) {
  const errs = [r.a.err, r.b.err, r.c.err].filter(Boolean);
  const notes = [];
  if (errs.length) notes.push('THREW: ' + errs[0]);
  if (r.c.fills < 200) notes.push('DRAWS ALMOST NOTHING');
  if (r.a.fills === r.b.fills && r.b.fills === r.c.fills) notes.push('IDENTICAL ACROSS THE ARC');
  if (notes.length) bad++;
  console.log(r.d.padEnd(14)
    + String(r.a.fills).padStart(7) + String(r.b.fills).padStart(8) + String(r.c.fills).padStart(8)
    + String(r.b.hit).padStart(9) + String(r.c.full).padStart(10) + '  ' + notes.join(' · '));
}
console.log('');
console.log(bad === 0 ? '✅ ALL ' + DEATHS.length + ' ENDINGS DRAW ACROSS THEIR ARC'
                      : '❌ ' + bad + ' of ' + DEATHS.length + ' NEED LOOKING AT');
process.exit(bad === 0 ? 0 : 1);
