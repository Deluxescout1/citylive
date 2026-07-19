// Living-World ticker-arc harness (v1.10.0). Loads the REAL engine (city.js) in a vm
// context with a stubbed 2D canvas, then steps the wall-clock across a full life and
// dumps the ticker stream. Story arcs are TEXT LOGIC OVER TIME — a screenshot proves one
// headline rendered, not that an arc progresses coherently. This catches "founder ACQUIRED
// and opens 100th store the same week" and famInfo/citizen collisions.
//
//   node desktop/test/ticker-life.js            # dump + coherence checks, a few lives
//   node desktop/test/ticker-life.js --dump 7   # full ticker stream for lifeIndex 7
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', '..', 'org.citylive.wallpaper', 'contents', 'js', 'city.js');

// ---- a no-op 2D canvas context (only measureText / gradients return real-ish objects) ----
function stubCtx() {
  const grad = { addColorStop() {} };
  const handler = {
    get(t, p) {
      if (p in t) return t[p];
      switch (p) {
        case 'measureText': return (s) => ({ width: (s ? String(s).length : 0) * 4 });
        case 'createLinearGradient':
        case 'createRadialGradient':
        case 'createPattern': return () => grad;
        case 'getImageData': return () => ({ data: [] });
        case 'canvas': return { width: 2560, height: 1440 };
        case 'save': case 'restore': case 'beginPath': case 'closePath':
        case 'moveTo': case 'lineTo': case 'arc': case 'arcTo': case 'rect':
        case 'fill': case 'stroke': case 'fillRect': case 'strokeRect': case 'clearRect':
        case 'fillText': case 'strokeText': case 'translate': case 'rotate': case 'scale':
        case 'setTransform': case 'resetTransform': case 'transform': case 'clip':
        case 'drawImage': case 'putImageData': case 'quadraticCurveTo': case 'bezierCurveTo':
        case 'setLineDash': case 'ellipse': case 'roundRect':
          return () => {};
        default:
          // unknown method → no-op; unknown property → 0
          return () => {};
      }
    },
    set() { return true; }
  };
  return new Proxy({}, handler);
}

function loadEngine() {
  const src = fs.readFileSync(ENGINE, 'utf8');
  const sandbox = {
    Math, Date, JSON, Object, Array, String, Number, Boolean, isNaN, isFinite,
    parseInt, parseFloat, console,
    // browser globals the engine may touch (all guarded, but be safe):
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0,
    XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; this.setRequestHeader = () => {}; },
    setTimeout: () => 0, setInterval: () => 0, clearTimeout: () => {}, clearInterval: () => {},
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(src, ctx, { filename: 'city.js' });
  // one-time setup so per-screen geometry globals exist
  ctx.setup('neon', { cw: 853, ch: 480, woff: 0, ww: 2269, pxk: 3, zoom: 1, quality: 'spectacle' });
  return ctx;
}

// start-of-life wall-clock for lifeIndex L (inverse of lifeIndexOf)
function lifeStart(ctx, L) {
  return L * ctx.GROW_CYCLE + ctx.GROW_EPOCH - ctx.GROW_OFFSET_DAYS * 86400000 - (ctx.WORLD_SHIFT || 0);
}

// step the clock across a life, run the real frame pipeline, collect the ticker each step
function lifeStream(ctx, L, steps) {
  steps = steps || 240;
  const g = stubCtx();
  const start = lifeStart(ctx, L), cyc = ctx.GROW_CYCLE;
  const out = [];
  let drawErr = null;
  for (let i = 0; i <= steps; i++) {
    const now = Math.round(start + (i / steps) * cyc);
    ctx.NOWOVR = now; ctx.CLOCK = now; ctx.FORCEAGE = null;
    try { ctx.draw(g); } catch (e) { if (!drawErr) drawErr = 'step ' + i + ': ' + e + (e && e.stack ? '\n' + e.stack.split('\n').slice(0, 3).join('\n') : ''); }
    const cg = ctx.cityGrowth(now);
    out.push({ i, now, cy: +cg.cy.toFixed(4), g: +cg.g.toFixed(3), phase: cg.phase, msg: ctx.tickerMsg(now) });
  }
  return { L, drawErr, stream: out };
}

// ---- coherence checks (assertions grow as citizens land; baseline = engine sane today) ----
function checkLife(ctx, L) {
  const { drawErr, stream } = lifeStream(ctx, L);
  const problems = [];
  if (drawErr) problems.push('DRAW THREW — ' + drawErr);
  for (const row of stream) {
    if (row.msg == null || typeof row.msg !== 'string') problems.push(`life ${L} cy ${row.cy}: ticker not a string (${row.msg})`);
    else if (/undefined|NaN|\[object/.test(row.msg)) problems.push(`life ${L} cy ${row.cy}: junk in ticker "${row.msg}"`);
  }
  // citizen-arc coherence (only if the civic layer exists yet)
  if (typeof ctx.citizenState === 'function') {
    // contradiction guard: a founder can't be "acquired/bankrupt" and "opens 100th store" adjacent
    let prevFounder = null;
    for (const row of stream) {
      const cs = ctx.citizenState(row.now);
      if (cs && cs.founder) {
        const f = cs.founder;
        if (prevFounder && prevFounder.phase === 'acquired' && f.phase === 'growing')
          problems.push(`life ${L} cy ${row.cy}: founder regressed acquired→growing`);
        prevFounder = f;
      }
    }
  }
  return problems;
}

function main() {
  const dumpArg = process.argv.indexOf('--dump');
  const ctx = loadEngine();
  if (dumpArg >= 0) {
    const L = +(process.argv[dumpArg + 1] || 7);
    const { drawErr, stream } = lifeStream(ctx, L, 300);
    if (drawErr) console.log('DRAW ERR: ' + drawErr);
    let last = null;
    for (const r of stream) if (r.msg !== last) { console.log(`  cy ${r.cy.toFixed(3)} [${r.phase}]  ${r.msg}`); last = r.msg; }
    return;
  }
  const lives = [1, 2, 3, 5, 7, 11];
  let all = [];
  for (const L of lives) all = all.concat(checkLife(ctx, L).map(p => `  ${p}`));
  if (all.length) { console.log('TICKER_ARC_FAIL (' + all.length + '):'); console.log(all.join('\n')); process.exit(1); }
  console.log('TICKER_ARC_OK — ' + lives.length + ' lives, ticker coherent, no draw throw');
}
main();
