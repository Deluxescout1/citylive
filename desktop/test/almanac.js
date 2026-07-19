// City Almanac harness. TWO jobs:
//  1) CONSISTENCY (the one that matters): the almanac must AGREE with what the city renders. draw() sets
//     curMayor/curRegime/curDeath via its own draw-order (mayorState override, regime, deathOf). We call
//     draw(stub) at a `now`, capture those globals, then call almanacData(now) and ASSERT they match —
//     proving the almanac reflects the rendered city, not a parallel computation that drifts.
//  2) SANITY: sweep many lives/phases and assert almanacData never emits NaN/undefined and the shape holds
//     (population>=0, life>=1, history entries well-formed, era/fate non-empty).
//   node desktop/test/almanac.js            # checks + a sample dump
//   node desktop/test/almanac.js --dump N   # full almanac for lifeIndex N at a few phases
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
if (typeof ctx.almanacData !== 'function') { console.log('almanacData not present'); process.exit(1); }

if (process.argv[2] === '--dump') {
  const L = +process.argv[3] || 6, g = stub();
  for (const cy of [0.12, 0.45, 0.66, 0.90]) {
    const now = Math.round(lifeStart(ctx, L) + cy * ctx.GROW_CYCLE);
    ctx.NOWOVR = now; ctx.CLOCK = now; ctx.FORCEAGE = null; ctx.draw(g);
    console.log(`\n=== LIFE ${L} @ cy≈${cy} ===`);
    console.log(JSON.stringify(ctx.almanacData(now), null, 1));
  }
  process.exit(0);
}

const problems = [];
const g = stub();
let regimeSeen = 0, apocSeen = 0, mayorSeen = 0, lm = 0;
// consistency + sanity across 48 lives × several phases (covers empty-history, regime, mid-apocalypse)
for (let L = 1; L <= 48; L++) {
  for (const cy of [0.10, 0.30, 0.50, 0.62, 0.75, 0.90, 0.985]) {
    const now = Math.round(lifeStart(ctx, L) + cy * ctx.GROW_CYCLE);
    ctx.NOWOVR = now; ctx.CLOCK = now; ctx.FORCEAGE = null;
    try { ctx.draw(g); } catch (e) { problems.push(`L${L} cy${cy}: draw threw ${e}`); continue; }
    const cm = ctx.curMayor, cr = ctx.curRegime, cd = ctx.curDeath;
    let A; try { A = ctx.almanacData(now); } catch (e) { problems.push(`L${L} cy${cy}: almanacData threw ${e}`); continue; }

    // --- CONSISTENCY: almanac must match what draw() computed ---
    const wantFate = ctx.DEATH_LABEL[cd] || cd;
    if (A.fate !== wantFate) problems.push(`L${L} cy${cy}: fate "${A.fate}" != curDeath "${wantFate}"`);
    if (cm) {
      mayorSeen++;
      if (!A.mayor) problems.push(`L${L} cy${cy}: curMayor set but almanac.mayor null`);
      else {
        if (A.mayor.name !== cm.winName) problems.push(`L${L} cy${cy}: mayor name "${A.mayor.name}" != curMayor "${cm.winName}"`);
        const wp = (cm.party && cm.party.k) || '—';
        if (A.mayor.party !== wp) problems.push(`L${L} cy${cy}: mayor party "${A.mayor.party}" != curMayor "${wp}"`);
      }
    } else if (A.mayor) problems.push(`L${L} cy${cy}: curMayor null but almanac.mayor set`);
    if (cr && cr.active) {
      if (!A.regime) problems.push(`L${L} cy${cy}: curRegime active but almanac.regime null`);
      else {
        if (A.regime.stage !== cr.stage) problems.push(`L${L} cy${cy}: regime stage ${A.regime.stage} != curRegime ${cr.stage}`);
        if (A.regime.leader !== cr.leaderName) problems.push(`L${L} cy${cy}: regime leader "${A.regime.leader}" != "${cr.leaderName}"`);
      }
    } else if (A.regime) problems.push(`L${L} cy${cy}: curRegime inactive but almanac.regime set`);
    if (ctx.cityPhase === 'apoc') apocSeen++;
    if (A.regime) regimeSeen++;
    if (A.landmarks && A.landmarks.length) lm++;

    // --- SANITY: no NaN/undefined, shape holds ---
    const bad = [];
    if (!(A.population >= 0)) bad.push('population=' + A.population);
    if (!(A.life >= 1)) bad.push('life=' + A.life);
    if (!(A.growthPct >= 0 && A.growthPct <= 100)) bad.push('growthPct=' + A.growthPct);
    if (!(A.economy >= 0 && A.economy <= 100)) bad.push('economy=' + A.economy);
    if (!A.era || A.era === 'Unknown') bad.push('era=' + A.era);
    if (!A.fate) bad.push('fate=' + A.fate);
    if (!A.cityName) bad.push('cityName=' + A.cityName);
    for (const h of A.history) { if (!(h.life >= 1) || !h.era || !h.fate) bad.push('badHistory=' + JSON.stringify(h)); }
    if (bad.length) problems.push(`L${L} cy${cy}: ${bad.join(', ')}`);
  }
}

if (problems.length) { console.log('ALMANAC_FAIL (' + problems.length + '):'); console.log(problems.slice(0, 25).join('\n')); process.exit(1); }
console.log(`ALMANAC_OK — 48 lives × 7 phases consistent with draw() (mayor checks ${mayorSeen}, regime frames ${regimeSeen}, apoc frames ${apocSeen}, lives-with-landmarks ${lm})`);
// a sample so a human can eyeball it
const nowS = Math.round(lifeStart(ctx, 6) + 0.66 * ctx.GROW_CYCLE);
ctx.NOWOVR = nowS; ctx.CLOCK = nowS; ctx.draw(g);
console.log('\nSAMPLE (life 6, thriving):'); console.log(JSON.stringify(ctx.almanacData(nowS), null, 1));
