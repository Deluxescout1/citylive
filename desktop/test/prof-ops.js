'use strict';
// WHERE DOES THE LIVE PASS GO? Not a test — a profiler.
//
// qml-perf-split.qml says the `fg` pass (street life only: no sky, no buildings, no terrain) costs
// 15.3 ms per frame at 1552x874 on the real QML runtime. That is far too much for cars and people,
// and it is the number that decides whether the wallpaper can afford a higher frame rate. Wall-clock
// alone can't say WHY, so this counts the canvas command stream instead: totals per method, and —
// separately — every fillStyle/strokeStyle assignment, because in Qt's QQuickContext2D the commands
// are queued and replayed on the render thread and a state change costs far more than a fillRect.
//
// Counts are runtime-independent, so node is legitimate HERE (unlike timings — see
// docs/PERF-freeze-diagnosis-20260724.md). Run: node test/prof-ops.js [pass] [life] [age]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'city.js'), 'utf8');

const calls = new Map();
const sets = new Map();
const styleValues = new Map();     // distinct colour strings assigned — how much a memo table could win
let totalCalls = 0, totalSets = 0;
// REDUNDANT state changes: assigning fillStyle the value it already holds. Free to eliminate —
// a guard changes no pixel — so this is the size of the zero-risk win.
let redundantStyle = 0, curFill = null, curStroke = null;

function bump(map, k) { map.set(k, (map.get(k) || 0) + 1); }

function profContext() {
  const gradient = { addColorStop() {} };
  const noop = new Proxy(function () {}, { apply() {} });
  return new Proxy({}, {
    get(_t, p) {
      if (p === 'measureText') return (s) => { bump(calls, 'measureText'); totalCalls++; return { width: String(s || '').length * 4 }; };
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') {
        return () => { bump(calls, p); totalCalls++; return gradient; };
      }
      if (p === 'getImageData') return () => ({ data: [] });
      if (p === 'canvas') return { width: 1552, height: 874 };
      if (typeof p !== 'string') return noop;
      return (...a) => { bump(calls, p); totalCalls++; };
    },
    set(_t, p, v) {
      bump(sets, p);
      totalSets++;
      if (p === 'fillStyle') { if (String(v) === curFill) redundantStyle++; curFill = String(v); bump(styleValues, p + '=' + String(v)); }
      if (p === 'strokeStyle') { if (String(v) === curStroke) redundantStyle++; curStroke = String(v); bump(styleValues, p + '=' + String(v)); }
      return true;
    }
  });
}

const sandbox = { console, Math, Date, JSON, Object, Array, String, Number, isNaN, parseInt, parseFloat, setTimeout, clearTimeout };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox, { filename: 'city.js' });

const pass = process.argv[2] || 'fg';
const life = Number(process.argv[3] || 76);      // forest by default
const age = Number(process.argv[4] || 0.85);

const CYC = 604800000, EPOCH = 1783972450746;
sandbox.NOFETCH = true;                           // no network from a profiler
sandbox.GROW_CYCLE = CYC;
sandbox.NOWOVR = EPOCH + life * CYC + Math.round(0.45 * CYC);
sandbox.setup('neon', { cw: 1552, ch: 874, woff: 0, ww: 4656, pxk: 3, zoom: 1, quality: process.env.QUAL || 'balanced', frameMs: 83 });
sandbox.FORCEAGE = age;
sandbox.weather.wind = 14;
sandbox.weather.temp = 62;

const g = profContext();
sandbox.draw(g, pass);                            // warm (first frame allocates caches)
calls.clear(); sets.clear(); styleValues.clear();
totalCalls = totalSets = 0;

const N = 10;
for (let i = 0; i < N; i++) { sandbox.NOWOVR += 83; sandbox.draw(g, pass); }

const per = (n) => (n / N).toFixed(0);
console.log(`\n=== pass "${pass}"  life ${life} (${sandbox.curBiome.k}/${sandbox.curBiome.name})  age ${age}  @1552x874 ===`);
console.log(`TOTAL ${per(totalCalls)} calls + ${per(totalSets)} state sets = ${per(totalCalls + totalSets)} ops/frame`);

const top = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
console.log('\n-- draw calls --');
for (const [k, v] of top(calls, 14)) console.log(`   ${per(v).padStart(7)}  ${k}`);
console.log('\n-- state assignments (the expensive ones in Qt) --');
for (const [k, v] of top(sets, 10)) console.log(`   ${per(v).padStart(7)}  ${k}`);

const distinct = styleValues.size;
const styleSets = (sets.get('fillStyle') || 0) + (sets.get('strokeStyle') || 0);
console.log(`\n-- colour churn --`);
console.log(`   ${per(styleSets)} fill/stroke style assignments per frame`);
console.log(`   ${distinct} DISTINCT colour strings across ${N} frames  (${(styleSets / Math.max(1, distinct)).toFixed(1)}x reuse)`);
console.log(`   ${per(redundantStyle)} of them REDUNDANT (already that value) = ${(100*redundantStyle/Math.max(1,styleSets)).toFixed(0)}% — free to eliminate`);
console.log('\n-- hottest single colours --');
for (const [k, v] of top(styleValues, 8)) console.log(`   ${per(v).padStart(7)}  ${k.slice(0, 72)}`);
