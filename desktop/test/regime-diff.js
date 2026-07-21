// Regime regression + arc harness. TWO jobs:
//  1) REGRESSION: dump the ticker + mayor stream for many lives across cy. Non-regime lives MUST be
//     byte-identical between main and the regime branch (the regime change is invisible to ~6/7 of lives).
//     Usage: `node regime-diff.js baseline > /tmp/base.txt` on main-equivalent, then again on the branch and `diff`.
//  2) ARC: assert the regime arc is coherent (stages 1→6 monotone then null after cyEnd; stable leader/path;
//     ~1/7 of lives get it; return-to-normal). Usage: `node regime-diff.js` (checks + summary).
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

// per-life stream: ticker + mayor identity at each cy step (the observable state)
function stream(ctx, L, steps) {
  const g = stub(), start = lifeStart(ctx, L), out = [];
  for (let s = 0; s <= steps; s++) {
    const now = Math.round(start + (s / steps) * ctx.GROW_CYCLE);
    ctx.NOWOVR = now; ctx.CLOCK = now; ctx.FORCEAGE = null;
    try { ctx.draw(g); } catch (e) { out.push(`ERR ${s}: ${e}`); continue; }
    const m = ctx.curMayor, cg = ctx.cityGrowth(now);
    const mstr = m ? `${(m.party && m.party.k) || '?'}/${m.winName || '?'}/${m.campaign ? 'C' : ''}${m.electionDay ? 'E' : ''}${m.scandal ? 'S' : ''}` : 'none';
    out.push(`${cg.cy.toFixed(3)} ${ctx.tickerMsg(now)} || ${mstr}`);
  }
  return out;
}
const LIVES = []; for (let L = 1; L <= 48; L++) LIVES.push(L);

if (process.argv[2] === 'baseline') {
  const ctx = load();
  for (const L of LIVES) { console.log(`### LIFE ${L}`); for (const line of stream(ctx, L, 60)) console.log(line); }
  process.exit(0);
}

// ARC checks (only meaningful once regimeState exists)
const ctx = load();
if (typeof ctx.regimeState !== 'function') { console.log('regimeState not present yet — baseline-only mode'); process.exit(0); }
const problems = []; let regimeLives = 0;
for (const L of LIVES) {
  const start = lifeStart(ctx, L); let peakStage = 0, seenActive = false, leader = null, pth = null, outcome = null;
  for (let s = 0; s <= 120; s++) {
    const now = Math.round(start + (s / 120) * ctx.GROW_CYCLE);
    const r = ctx.regimeState(now), cg = ctx.cityGrowth(now);
    if (r) {
      seenActive = true;
      if (typeof r.stage === 'number') { if (r.stage < peakStage) problems.push(`life ${L} cy ${cg.cy.toFixed(3)}: regime stage regressed ${peakStage}→${r.stage}`); if (r.stage > peakStage) peakStage = r.stage; }
      if (leader === null) leader = r.leaderName; else if (r.leaderName !== leader) problems.push(`life ${L}: leader name changed ${leader}→${r.leaderName}`);
      if (pth === null) pth = r.path; else if (r.path !== pth) problems.push(`life ${L}: fall path changed ${pth}→${r.path}`);
      if (outcome === null) outcome = r.outcome; else if (r.outcome !== outcome) problems.push(`life ${L}: outcome changed ${outcome}→${r.outcome}`);
      // WIN takeovers clear by ~0.82; PUT-DOWN takeovers legitimately rule on to the apocalypse (~0.955)
      const limit = (r.outcome === 'putdown') ? 0.955 : 0.82;
      if (cg.cy > limit) problems.push(`life ${L} cy ${cg.cy.toFixed(3)}: ${r.outcome} regime active past its end`);
    }
  }
  if (seenActive) { regimeLives++;
    if (outcome === 'win' && peakStage < 6) problems.push(`life ${L}: 'win' regime never reached the fall (peak stage ${peakStage})`);
    if (outcome === 'putdown' && peakStage < 5) problems.push(`life ${L}: 'putdown' regime never reached total control (peak stage ${peakStage})`); }
}
const rate = (regimeLives / LIVES.length * 100).toFixed(0);
if (problems.length) { console.log('REGIME_ARC_FAIL (' + problems.length + '):'); console.log(problems.slice(0, 20).join('\n')); process.exit(1); }
console.log(`REGIME_ARC_OK — ${regimeLives}/${LIVES.length} lives (${rate}%) had the arc, all coherent (win→falls by cyEnd, put-down→holds to apoc, stable leader+path+outcome)`);
