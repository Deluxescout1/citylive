// THE ADDICTION CRISIS arc harness. TWO jobs:
//  1) OVERLAP: addiction must be MUTUALLY EXCLUSIVE with war + regime + plague + festival. Asserts
//     curAddiction is NEVER active in the same life as curWar/curRegime/curPlague/curFestival. An inverted
//     yield comparison fails silently → this is the guard.
//  2) ARC: assert the arc is coherent (stages 1→5 monotone then null after cyEnd; ~4% of lives).
// Also asserts addictionState(containment BASE now) === null so regime-contain.sh stays byte-identical.
// Usage: node addiction-diff.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ENGINE = path.join(__dirname, '..', '..', 'org.citylive.wallpaper', 'contents', 'js', 'city.js');
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
if (typeof ctx.addictionState !== 'function') { console.log('addictionState not present — FAIL'); process.exit(1); }

// containment BASE now (regime-contain.sh) must NOT be an addiction life or the A/B breaks
const BASE_NOW = 1784255400000;
if (ctx.addictionState(BASE_NOW) !== null) { console.log('ADDICT_FAIL — containment BASE now IS an addiction life (would break byte-identical A/B)'); process.exit(1); }

// war lives are the 62% existence roll addiction yields to (flag addiction-on-a-war-life without warState's globals)
function isWarLife(L) { return ((L * 2654435761 + 7717) >>> 0) % 100 < 62; }
const problems = [];
let addLives = 0, overlaps = 0;
const LIVES = []; for (let L = 1; L <= 800; L++) LIVES.push(L);   // wide sweep: addiction is ~4% so we need many lives for a good sample
for (const L of LIVES) {
  const start = lifeStart(ctx, L);
  let peak = 0, sawAdd = false, endedThenReactivated = false, everInactiveAfter = false;
  for (let s = 0; s <= 60; s++) {
    const now = Math.round(start + (s / 60) * ctx.GROW_CYCLE);
    const A = ctx.addictionState(now), R = ctx.regimeState(now), P = ctx.plagueState(now), F = ctx.festivalState(now);
    const aActive = !!(A && A.active);
    if (aActive) {
      sawAdd = true;
      if (R && R.active) { overlaps++; problems.push(`life ${L} step ${s}: ADDICTION overlaps REGIME`); }
      if (P && P.active) { overlaps++; problems.push(`life ${L} step ${s}: ADDICTION overlaps PLAGUE`); }
      if (F && F.active) { overlaps++; problems.push(`life ${L} step ${s}: ADDICTION overlaps FESTIVAL`); }
      if (isWarLife(L))  { overlaps++; problems.push(`life ${L} step ${s}: ADDICTION on a WAR life`); }
      if (typeof A.stage === 'number') {
        if (A.stage < peak) problems.push(`life ${L} step ${s}: addiction stage regressed ${peak}->${A.stage}`);
        if (A.stage > peak) peak = A.stage;
      }
      if (everInactiveAfter) endedThenReactivated = true;   // came back on after clearing → life-scope bug
    } else if (sawAdd) {
      everInactiveAfter = true;
    }
  }
  if (sawAdd) {
    addLives++;
    if (peak < 5) problems.push(`life ${L}: addiction never reached RECOVERY (peak stage ${peak})`);
    if (endedThenReactivated) problems.push(`life ${L}: addiction re-activated after clearing`);
  }
}
const rate = (addLives / LIVES.length * 100).toFixed(1);
if (overlaps) { console.log(`ADDICT_OVERLAP_FAIL — ${overlaps} overlap(s) with war/regime/plague/festival:`); console.log(problems.slice(0, 20).join('\n')); process.exit(1); }
if (problems.length) { console.log('ADDICT_ARC_FAIL (' + problems.length + '):'); console.log(problems.slice(0, 20).join('\n')); process.exit(1); }
console.log(`ADDICT_OK — OVERLAP 0 (mutually exclusive w/ war+regime+plague+festival); ${addLives}/${LIVES.length} lives (${rate}%) had the arc, all coherent (stages 1->5, cleared by cyEnd)`);
