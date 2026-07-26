'use strict';
// WHICH FUNCTIONS spend the live pass's canvas ops?
//
// prof-ops.js says the `fg` pass issues ~12.8k fillRects and ~6.2k fillStyle assignments per frame.
// This attributes them. The engine is loaded into a vm sandbox, so every top-level `function foo()`
// is a sandbox property — each can be swapped for a wrapper that records the op-count delta across
// its call, with no edit to city.js at all. Costs are EXCLUSIVE (a callee's ops are subtracted from
// its caller), so the numbers sum to the frame instead of double-counting the call tree.
//
// Run: node test/prof-fns.js [pass] [life] [age]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'city.js'), 'utf8');

let ops = 0, styleSets = 0;
function profContext() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(_t, p) {
      if (p === 'measureText') return (s) => { ops++; return { width: String(s || '').length * 4 }; };
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => { ops++; return gradient; };
      if (p === 'getImageData') return () => ({ data: [] });
      if (p === 'canvas') return { width: 1552, height: 874 };
      return () => { ops++; };
    },
    set(_t, p) { ops++; if (p === 'fillStyle' || p === 'strokeStyle') styleSets++; return true; }
  });
}

const sandbox = { console, Math, Date, JSON, Object, Array, String, Number, isNaN, parseInt, parseFloat, setTimeout, clearTimeout };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox, { filename: 'city.js' });

const pass = process.argv[2] || 'fg';
const life = Number(process.argv[3] || 76);
const age = Number(process.argv[4] || 0.85);

const CYC = 604800000, EPOCH = 1783972450746;
sandbox.NOFETCH = true;
sandbox.GROW_CYCLE = CYC;
sandbox.NOWOVR = EPOCH + life * CYC + Math.round(0.45 * CYC);
sandbox.setup('neon', { cw: 1552, ch: 874, woff: 0, ww: 4656, pxk: 3, zoom: 1, quality: 'spectacle', frameMs: 83 });
sandbox.FORCEAGE = age;
sandbox.weather.wind = 14;
sandbox.weather.temp = 62;

// ---- wrap every top-level draw function for exclusive attribution ----
const stats = new Map();            // name -> {ops, styles, calls}
const stack = [];                   // [{name, childOps, childStyles}]
const names = Object.keys(sandbox).filter(k =>
  typeof sandbox[k] === 'function' && /^(draw|step|fill|paint|render)/i.test(k) && k !== 'draw');

for (const name of names) {
  const orig = sandbox[name];
  stats.set(name, { ops: 0, styles: 0, calls: 0 });
  sandbox[name] = function (...args) {
    const o0 = ops, s0 = styleSets;
    const frame = { childOps: 0, childStyles: 0 };
    stack.push(frame);
    try {
      return orig.apply(this, args);
    } finally {
      stack.pop();
      const st = stats.get(name);
      const selfOps = (ops - o0) - frame.childOps;
      const selfStyles = (styleSets - s0) - frame.childStyles;
      st.ops += selfOps; st.styles += selfStyles; st.calls++;
      if (stack.length) { const p = stack[stack.length - 1]; p.childOps += (ops - o0); p.childStyles += (styleSets - s0); }
    }
  };
}

const g = profContext();
sandbox.draw(g, pass);                                   // warm
for (const st of stats.values()) { st.ops = st.styles = st.calls = 0; }
ops = styleSets = 0;

const N = 10;
for (let i = 0; i < N; i++) { sandbox.NOWOVR += 83; sandbox.draw(g, pass); }

console.log(`\n=== pass "${pass}"  life ${life} (${sandbox.curBiome.k}/${sandbox.curBiome.name})  age ${age}  @1552x874 ===`);
console.log(`TOTAL ${(ops / N).toFixed(0)} ops/frame (${(styleSets / N).toFixed(0)} of them fill/stroke style sets)\n`);
console.log('   ops/f   styles/f  calls/f   function                        (exclusive)');
const rows = [...stats.entries()].filter(([, s]) => s.ops > 0).sort((a, b) => b[1].ops - a[1].ops);
let shown = 0;
for (const [name, s] of rows.slice(0, 22)) {
  shown += s.ops;
  console.log(`   ${(s.ops / N).toFixed(0).padStart(6)}   ${(s.styles / N).toFixed(0).padStart(7)}   ${(s.calls / N).toFixed(0).padStart(6)}   ${name}   ${(100 * s.ops / ops).toFixed(1)}%`);
}
const attributed = rows.reduce((a, [, s]) => a + s.ops, 0);
console.log(`\n   attributed to wrapped fns: ${(100 * attributed / ops).toFixed(0)}%  (rest is inline in draw())`);
