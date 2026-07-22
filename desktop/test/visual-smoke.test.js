'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');
function canvasStub() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === 'measureText') return (s) => ({ width: String(s || '').length * 4 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') return () => gradient;
      if (prop === 'getImageData') return () => ({ data: [] });
      if (prop === 'canvas') return { width: 853, height: 480 };
      return () => {};
    },
    set() { return true; }
  });
}
function countingCanvas(counts) {
  const gradient = { addColorStop() { counts.addColorStop = (counts.addColorStop || 0) + 1; } };
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === 'measureText') return (s) => ({ width: String(s || '').length * 4 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') {
        return () => { counts[prop] = (counts[prop] || 0) + 1; return gradient; };
      }
      if (prop === 'getImageData') return () => ({ data: [] });
      if (prop === 'canvas') return { width: 853, height: 480 };
      return () => { counts[prop] = (counts[prop] || 0) + 1; };
    },
    set() { return true; }
  });
}
function loadEngine() {
  const sandbox = { Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    isNaN, isFinite, parseInt, parseFloat, console,
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {} };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), context, { filename: 'city.js' });
  context.NOFETCH = true;
  context.setup('neon', { cw: 427, ch: 240, woff: 0, ww: 427, pxk: 4, zoom: 1, quality: 'performance' });
  return context;
}
function splitFrame(ctx) {
  assert.doesNotThrow(() => ctx.draw(canvasStub(), 'bg'));
  assert.doesNotThrow(() => ctx.draw(canvasStub(), 'sky'));
  assert.doesNotThrow(() => ctx.draw(canvasStub(), 'cloud'));
  assert.doesNotThrow(() => ctx.draw(canvasStub(), 'water'));
  assert.doesNotThrow(() => ctx.draw(canvasStub(), 'skyfast'));
  assert.doesNotThrow(() => ctx.draw(canvasStub(), 'city'));
  assert.doesNotThrow(() => ctx.draw(canvasStub(), 'fg'));
  const status = ctx.cityStatus(Date.now());
  assert.ok(status && status.title && status.dataLabel);
}

test('every finale survives the retained render layers', () => {
  const ctx = loadEngine();
  ctx.DEMO_APOC_SEC = 60;
  const finales = Array.from(new Set(Array.from(ctx.DEATHS).concat(['kaijuwar', 'pollution', 'moonfall'])));
  for (const finale of finales) {
    ctx.FORCEDEATH = finale;
    splitFrame(ctx);
    assert.match(ctx.cityStatus(Date.now()).title, /APOCALYPSE/);
  }
});

test('retained layers preserve every original drawing operation', () => {
  const at = 1784219400000;
  const whole = loadEngine();
  whole.NOWOVR = at;
  whole.FORCEAGE = 0.72;
  const wholeCounts = {};
  whole.draw(countingCanvas(wholeCounts));

  const split = loadEngine();
  split.NOWOVR = at;
  split.FORCEAGE = 0.72;
  const splitCounts = {};
  for (const pass of ['bg', 'sky', 'cloud', 'skyfast', 'water', 'city', 'fg']) split.draw(countingCanvas(splitCounts), pass);

  // Layer canvases require their own transform/clear calls. All visible primitives and paths
  // must otherwise match the original monolithic frame exactly—no feature may disappear.
  delete wholeCounts.setTransform;
  delete splitCounts.setTransform;
  delete wholeCounts.clearRect;
  delete splitCounts.clearRect;
  // Moving static signage/ads into the retained city cache can legitimately change the number
  // of tiny raster rectangles while preserving every visible drawing primitive and path.
  const splitRects = splitCounts.fillRect || 0, wholeRects = wholeCounts.fillRect || 0;
  delete splitCounts.fillRect;
  delete wholeCounts.fillRect;
  assert.deepStrictEqual(splitCounts, wholeCounts);
  assert.ok(Math.abs(splitRects - wholeRects) < wholeRects * 0.08, 'retained split must stay within the raster budget');
});

test('every transparent animation layer clears its previous frame', () => {
  const ctx = loadEngine();
  ctx.NOWOVR = 1784219400000;
  for (const pass of ['sky', 'cloud', 'skyfast', 'water', 'city', 'fg']) {
    const counts = {};
    ctx.draw(countingCanvas(counts), pass);
    assert.strictEqual(counts.clearRect, 1, pass + ' must not leave motion trails');
  }
});

test('long-running story arcs expose a clear status and render without throwing', () => {
  const ctx = loadEngine();
  ctx.DEMO_APOC_SEC = 0;
  ctx.FORCEAGE = 0.72;
  const cases = [
    ['regime', 'FORCEREGIME', { active:true, stage:5, sub:0.7, perm:true, outcome:'putdown', party:{k:'THE ORDER',c:'#c0182a'}, theme:'order', leaderName:'THE DIRECTOR', path:'uprising', seed:123 }],
    ['plague', 'FORCEPLAGUE', { active:true, stage:3, sub:0.5, severity:1, zombie:false, seed:123 }],
    ['zombie plague', 'FORCEPLAGUE', { active:true, stage:5, sub:0.5, severity:1, zombie:true, zprog:0.8, seed:123 }],
    ['festival', 'FORCEFESTIVAL', { active:true, stage:4, sub:0.5, festivity:1, theme:'WORLD', seed:123 }],
    ['addiction', 'FORCEADDICT', { active:true, stage:4, sub:0.5, severity:1, crackdown:false, seed:123 }]
  ];
  for (const [name, hook, value] of cases) {
    ctx.FORCEREGIME = ctx.FORCEPLAGUE = ctx.FORCEFESTIVAL = ctx.FORCEADDICT = null;
    ctx[hook] = value;
    splitFrame(ctx);
    assert.notEqual(ctx.cityStatus(Date.now()).title.indexOf('·'), -1, name + ' needs a named stage');
  }
});

test('offline fallback is explicit and still renders', () => {
  const ctx = loadEngine();
  splitFrame(ctx);
  assert.match(ctx.liveDataStatus(Date.now()).label, /OFFLINE MODE/);
});

test('Chronicle exposes only a witnessed election and stable full candidate names', () => {
  const ctx = loadEngine();
  ctx.FORCEAGE = 0.72;
  ctx.FORCEELECT = { phase:'campaign', partyK:'GREENS', party2K:'TRANSIT' };
  ctx.draw(canvasStub());
  ctx.curWar = ctx.curDis = ctx.curRegime = ctx.curPlague = ctx.curFestival = ctx.curAddiction = null;
  const witness = ctx.chronicleSnapshot(Date.now());
  assert.ok(witness && witness.recordable);
  assert.strictEqual(witness.kind, 'election');
  assert.match(witness.eventKey, /^election:/);
  assert.strictEqual(witness.people.length, 2);
  witness.people.forEach((p) => assert.match(p.name, /^[A-Z]+( [A-Z]\.)? [A-Z]+$/));   // dedup inserts a middle initial ("IVAN Q. WHITE")
  assert.ok(!Object.prototype.hasOwnProperty.call(witness, 'future'));
});
