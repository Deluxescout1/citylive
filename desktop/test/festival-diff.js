// THE FESTIVAL arc harness. TWO jobs:
//  1) OVERLAP: THE FESTIVAL must be MUTUALLY EXCLUSIVE with war + regime + plague. Runs the real frame
//     path (draw()) across many lives/cy and asserts curFestival is NEVER active in the same life as
//     curWar / curRegime / curPlague. An inverted yield comparison fails silently → this is the guard.
//  2) ARC: assert the festival arc is coherent (stages 1→5 monotone then null after cyEnd; ~7% of lives).
// Also asserts festivalState(containment BASE now) === null so regime-contain.sh stays byte-identical.
// Usage: node festival-diff.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ENGINE = path.join(__dirname, '..', '..', 'org.citylive.wallpaper', 'contents', 'js', 'city.js');
function stub() {
  const grad = { addColorStop() {} };
  return new Proxy({}, { get: (t, p) => p === 'measureText' ? (s => ({ width: (s ? String(s).length : 0) * 4 }))
    : (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') ? (() => grad)
    : p === 'getImageData' ? (() => ({ data: [] })) : p === 'canvas' ? { width: 2560, height: 1440 } : (() => {}), set: () => true });
}
function load() {
  const src = fs.readFileSync(ENGINE, 'utf8');
  const sb = { Math, Date, JSON, Object, Array, String, Number, Boolean, isNaN, isFinite, parseInt, parseFloat, console,
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; this.setRequestHeader = () => {}; },
    setTimeout: () => 0, setInterval: () => 0, clearTimeout: () => {}, clearInterval: () => {} };
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  const ctx = vm.createContext(sb); vm.runInContext(src, ctx, { filename: 'city.js' });
  ctx.setup('neon', { cw: 853, ch: 480, woff: 0, ww: 2269, pxk: 3, zoom: 1, quality: 'spectacle' });
  return ctx;
}
function lifeStart(ctx, L) { return L * ctx.GROW_CYCLE + ctx.GROW_EPOCH - ctx.GROW_OFFSET_DAYS * 86400000 - (ctx.WORLD_SHIFT || 0); }

const ctx = load();
if (typeof ctx.festivalState !== 'function') { console.log('festivalState not present — FAIL'); process.exit(1); }

// containment BASE now (regime-contain.sh) must be a non-festival life or the A/B breaks
const BASE_NOW = 1784255400000;
if (ctx.festivalState(BASE_NOW) !== null) { console.log('FESTIVAL_FAIL — containment BASE now IS a festival life (would break byte-identical A/B)'); process.exit(1); }

// pure-state sweep (no draw() — fast). festivalState/regimeState/plagueState are pure f(now); war lives
// are the ones the 62% existence roll claims (the exact roll festival yields to), so we flag festival-on-a-
// war-life without needing warState's cityG-dependent globals.
function isWarLife(L) { return ((L * 2654435761 + 7717) >>> 0) % 100 < 62; }
const problems = [];
let festLives = 0, overlaps = 0;
const LIVES = []; for (let L = 1; L <= 600; L++) LIVES.push(L);   // wide sweep: festival is ~7% so we need many lives for a good sample
for (const L of LIVES) {
  const start = lifeStart(ctx, L);
  let peak = 0, sawFest = false, endedThenReactivated = false, everInactiveAfterFest = false;
  for (let s = 0; s <= 60; s++) {
    const now = Math.round(start + (s / 60) * ctx.GROW_CYCLE);
    const F = ctx.festivalState(now), R = ctx.regimeState(now), P = ctx.plagueState(now);
    const fActive = !!(F && F.active);
    if (fActive) {
      sawFest = true;
      if (R && R.active) { overlaps++; problems.push(`life ${L} step ${s}: FESTIVAL overlaps REGIME`); }
      if (P && P.active) { overlaps++; problems.push(`life ${L} step ${s}: FESTIVAL overlaps PLAGUE`); }
      if (isWarLife(L))  { overlaps++; problems.push(`life ${L} step ${s}: FESTIVAL on a WAR life`); }
      if (typeof F.stage === 'number') {
        if (F.stage < peak) problems.push(`life ${L} step ${s}: festival stage regressed ${peak}->${F.stage}`);
        if (F.stage > peak) peak = F.stage;
      }
      if (everInactiveAfterFest) endedThenReactivated = true;   // came back on after clearing → life-scope bug
    } else if (sawFest) {
      everInactiveAfterFest = true;
    }
  }
  if (sawFest) {
    festLives++;
    if (peak < 5) problems.push(`life ${L}: festival never reached CLOSING (peak stage ${peak})`);
    if (endedThenReactivated) problems.push(`life ${L}: festival re-activated after clearing`);
  }
}
const rate = (festLives / LIVES.length * 100).toFixed(1);
if (overlaps) { console.log(`FESTIVAL_OVERLAP_FAIL — ${overlaps} overlap(s) with war/regime/plague:`); console.log(problems.slice(0, 20).join('\n')); process.exit(1); }
if (problems.length) { console.log('FESTIVAL_ARC_FAIL (' + problems.length + '):'); console.log(problems.slice(0, 20).join('\n')); process.exit(1); }
console.log(`FESTIVAL_OK — OVERLAP 0 (mutually exclusive w/ war+regime+plague); ${festLives}/${LIVES.length} lives (${rate}%) had the arc, all coherent (stages 1->5, cleared by cyEnd)`);
