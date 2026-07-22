'use strict';

// Regression coverage for Nick's July 22 CityLive brief. These checks exercise the real shared
// renderer engine used by Windows Electron, KDE Plasma, web, and phone—not a copied test model.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');

function loadEngine() {
  const sandbox = {
    Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    isNaN, isFinite, parseInt, parseFloat, console,
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {}
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), context, { filename: 'city.js' });
  context.NOFETCH = true;
  context.setup('neon', { cw: 853, ch: 480, woff: 0, ww: 853, pxk: 3, zoom: 1, quality: 'spectacle' });
  return context;
}

test('the billboard library contains exactly 50 distinct realistic campaigns', () => {
  const ctx = loadEngine();
  assert.strictEqual(ctx.AD_LIB.length, 50);
  assert.strictEqual(new Set(Array.from(ctx.AD_LIB, (ad) => ad.n)).size, 50);
  for (const ad of ctx.AD_LIB) {
    assert.match(ad.n, /^[A-Z0-9 &'!+.]+$/);
    assert.ok(ad.g && ad.g.length <= 24, ad.n + ' needs a compact readable tagline');
    assert.ok(Array.isArray(ad.c) && ad.c.length === 3 && ad.c.every(Number.isFinite));
  }
});

test('astronomy desk covers eclipses, major showers, and computed sky events', () => {
  const ctx = loadEngine();
  assert.match(ctx.astroDesk(new Date(2026, 7, 12, 12)), /SOLAR ECLIPSE TODAY/);
  assert.match(ctx.astroDesk(new Date(2026, 7, 28, 20)), /BLOOD MOON TONIGHT/);
  assert.strictEqual(ctx.currentShower(new Date(2026, 7, 12, 23)).n, 'PERSEID');
  assert.strictEqual(ctx.currentShower(new Date(2026, 11, 13, 23)).n, 'GEMINID');
  assert.strictEqual(typeof ctx.isSupermoon(new Date(2026, 0, 1)), 'boolean');
  const conjunction = ctx.conjunctionNow(new Date(2026, 6, 22, 22));
  assert.ok(conjunction === null || (conjunction.a && conjunction.b));
});

test('god rays originate at the same world-anchored sun position', () => {
  const ctx = loadEngine();
  ctx.cityPhase = 'city'; ctx.weather.cloud = 50; ctx.curSunDf = 0.31;
  ctx.solarEclDim = 0; ctx.goldenK = 0.4;
  const moves = [];
  const gradient = { addColorStop() {} };
  const g = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'createLinearGradient') return () => gradient;
      if (prop === 'moveTo') return (x, y) => moves.push([x, y]);
      return () => {};
    },
    set() { return true; }
  });
  ctx.drawGodRays(g, 0.7, Date.UTC(2026, 6, 22, 18), { rain:false, drizzle:false, snow:false, thunder:false, fog:false });
  assert.ok(moves.length > 0, 'broken clouds should produce visible rays');
  const sunX = Math.round(ctx.curSunDf * ctx.WW - ctx.WOFF);
  const sunY = Math.round(ctx.HORIZON * 0.9 - Math.sin(ctx.curSunDf * Math.PI) * ctx.HORIZON * 0.75);
  for (const [x, y] of moves) assert.deepStrictEqual([x, y], [sunX - 2, sunY]);
});

test('concerts prefer a standing theater over a neon club or fallback site', () => {
  const ctx = loadEngine();
  ctx.cityG = 0.75; ctx.curDis = null; ctx.curRuins = [];
  // This test isolates venue ranking; protected landmark footprints are covered by the world sweep.
  vm.runInContext('overSite=function(){return false}; overLandmark=function(){return false};', ctx);
  ctx.near = { blds: [
    { x:300, w:24, h:30, type:'tower', use:'office', district:'neon', seed:1 },
    { x:420, w:34, h:36, type:'tower', use:'theater', district:'downtown', seed:2 }
  ] };
  assert.strictEqual(ctx.concertVenueX(), 437);
});

test('major-event notifications filter minor disasters and expose eclipse days', () => {
  const ctx = loadEngine();
  ctx.NOWOVR = Date.UTC(2026, 6, 22, 12);
  ctx.chronicleSnapshot = () => ({ recordable:true, eventKey:'disaster:tornado:Emergency', kind:'disaster', title:'EMERGENCY · TORNADO', detail:'Crews active' });
  ctx.curDis = { intensity:2 };
  assert.strictEqual(ctx.notifySnapshot(ctx.NOWOVR), null);
  ctx.curDis = { intensity:4 };
  assert.strictEqual(ctx.notifySnapshot(ctx.NOWOVR).key, 'disaster:tornado:Emergency');
  ctx.chronicleSnapshot = () => null; ctx.curDis = null;
  ctx.NOWOVR = new Date(2026, 7, 12, 12).getTime();
  ctx.CLOCK = ctx.NOWOVR;
  assert.strictEqual(ctx.notifySnapshot(ctx.NOWOVR).key, 'sky:solar:2026-8-12');
});

test('the elevated train cannot cover important landmarks or information surfaces', () => {
  const source = fs.readFileSync(ENGINE, 'utf8');
  const frame = source.slice(source.indexOf('function draw(g,pass)'));
  const train = frame.indexOf('drawTrainLine(g,L,now,fx)');
  assert.ok(train >= 0, 'train draw call must remain in the main frame');
  for (const protectedDraw of [
    'drawLandmarks(g,L,now,night,nd)',
    'drawBuilds(g,L,now,night)',
    'drawNewsScreens(g,L,now,night)',
    'drawSportsDistrict(g,L,now)',
    'drawJumbotrons(g,L,now,night)'
  ]) {
    assert.ok(frame.indexOf(protectedDraw, train) > train, protectedDraw + ' must render in front of the train');
  }
});
