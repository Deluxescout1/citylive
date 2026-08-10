'use strict';
// HOW TALL IS THIS LAND'S LANDFORM, ACROSS LIVES — the probe the ALPINE retraction says should have
// come first and did not exist.
//
// 🚨🚨 THE MISTAKE IT PREVENTS: alpine was nominated as "the next map to fix" off ONE render, measured
// at 85px of relief against a 219px skyline, and written up as fact. `buildWorld` has
// `flatLife = (li!==0 && curBiome.k==="alpine" && mg()>=0.72)` → about 28% of alpine lives are
// DELIBERATELY flat, and that render was one of them. Measured across 24 lives the spread is
// 84…297 with a median of 205: the single lowest value there is.
// 🔑🔑 A LAND IS A DISTRIBUTION. Sample it before judging it, and quote the SPREAD, not the sample.
// 🔑 A cheap probe across many lives beats a careful measurement of one.
//
// It loads the engine into a node `vm`, wraps `fillRect`, attributes each fill by `new Error().stack`,
// and keeps the highest point any LANDFORM routine reached — per life, per land.
// ⚠ Node is not the runtime: trust this for GEOMETRY and RANKING, then re-render in the QML harness
//   before believing anything about how a land LOOKS.
//
// Usage: node desktop/tools/landform-relief.js [lives=16] [land=a,b,c] [egg=d,e,f] [age=0.85]
const fs = require('fs'), path = require('path'), vm = require('vm');
const ENGINE = path.join(__dirname, '..', '..', 'org.citylive.wallpaper', 'contents', 'js', 'city.js');
const SRC = fs.readFileSync(ENGINE, 'utf8');

const opt = {};
for (const a of process.argv.slice(2)) { const i = a.indexOf('='); if (i > 0) opt[a.slice(0, i)] = a.slice(i + 1); }
const LIVES = Number(opt.lives || 16);
const AGE = opt.age !== undefined ? Number(opt.age) : 0.85;
const BIOMES = (opt.land || 'forest,mesa,beach,alpine').split(',').filter(Boolean);
const EGGS = (opt.egg || 'core,fire,air,falls,orbit,plateau').split(',').filter(Boolean);
const CYC = 604800000, EPOCH = 1783972450746;

// every routine that paints the LAND itself — the backdrop the city stands in front of
const LANDFORM = /drawMountains|ridgeFill|drawGorge|drawDunes|drawKarst|drawPlateau|drawCliff|drawSpire|drawCloudSea|drawTerrain|drawBiomeDetail|drawBiomeLandmark|drawVolcanoSurface|drawSprawlDepth/;

function reliefOf(kind, key, lifeIdx) {
  const sandbox = { Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    isNaN, isFinite, parseInt, parseFloat, console: { log() {}, warn() {}, error() {} },
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {} };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(SRC, ctx, { filename: 'city.js' });
  ctx.NOFETCH = true;
  if (kind === 'egg') { ctx.FORCEEGG = key; ctx.FORCEBIOME = null; } else { ctx.FORCEBIOME = key; ctx.FORCEEGG = null; }
  ctx.FORCEVARIANT = 0;
  ctx.applyConfig({ lat: 41.5243, lon: -72.0759 });
  ctx.setup('neon', { cw: 776, ch: 437, woff: 0, ww: 2269, pxk: 3, zoom: 1, taskbarWp: 17, quality: 'balanced', frameMs: 125 });
  ctx.FORCEAGE = AGE;
  // a DIFFERENT LIFE each pass — this is the whole point of the tool
  const d = new Date(EPOCH + lifeIdx * CYC + Math.round(0.45 * CYC));
  d.setHours(13, 0, 0, 0);
  ctx.NOWOVR = ctx.CLOCK = d.getTime();

  let minY = Infinity, style = '#000';
  const rec = (x, y, w, h) => {
    if (!(w > 0 && h > 0)) return;
    if (w >= 700) return;                       // full-width sky/wash fills are not landform relief
    const st = new Error().stack || '';
    if (!LANDFORM.test(st)) return;
    if (y < minY) minY = y;
  };
  const canvas = new Proxy({}, { get(_t, p) {
    if (p === 'fillStyle' || p === 'strokeStyle') return style;
    if (p === 'measureText') return (s) => ({ width: String(s || '').length * 4 });
    if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => ({ addColorStop() {} });
    if (p === 'getImageData') return () => ({ data: [] });
    if (p === 'canvas') return { width: 776, height: 437 };
    if (p === 'fillRect') return rec;
    return () => {};
  }, set(_t, p, v) { if (p === 'fillStyle' || p === 'strokeStyle') style = v; return true; } });

  try { ctx.draw(canvas, 'bg'); ctx.draw(canvas, 'live'); } catch (e) { return { err: String(e).slice(0, 60) }; }
  const HOR = ctx.HORIZON;
  return { relief: minY === Infinity ? 0 : Math.max(0, Math.round(HOR - minY)), hor: HOR };
}

function stat(a) { const s = a.slice().sort((x, y) => x - y); return { min: s[0], med: s[s.length >> 1], max: s[s.length - 1] }; }

const rows = [];
for (const [kind, keys] of [['land', BIOMES], ['egg', EGGS]]) {
  for (const key of keys) {
    const vals = [];
    let err = null;
    for (let i = 0; i < LIVES; i++) {
      const r = reliefOf(kind, key, 3 + i * 5);
      if (r.err) { err = r.err; break; }
      vals.push(r.relief);
    }
    if (err) { rows.push({ key, err }); continue; }
    const s = stat(vals);
    rows.push({ key, kind, ...s, hor: reliefOf(kind, key, 3).hor, spread: s.max - s.min, vals });
  }
}
rows.filter((r) => !r.err).sort((a, b) => a.med - b.med);
console.log('LANDFORM RELIEF ACROSS ' + LIVES + ' LIVES (px above the horizon; HORIZON=' + (rows.find((r) => r.hor) || {}).hor + ')');
console.log('land       kind   min   med   max  spread   (median ascending = weakest landform first)');
for (const r of rows.filter((x) => !x.err).sort((a, b) => a.med - b.med))
  console.log(String(r.key).padEnd(10) + String(r.kind).padEnd(6) + String(r.min).padStart(5) + String(r.med).padStart(6) + String(r.max).padStart(6) + String(r.spread).padStart(7));
for (const r of rows.filter((x) => x.err)) console.log(String(r.key).padEnd(10) + ' ERROR ' + r.err);
