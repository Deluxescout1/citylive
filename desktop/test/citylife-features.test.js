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

function canvasStub() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === 'measureText') return (s) => ({ width: String(s || '').length * 4 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') return () => gradient;
      if (prop === 'canvas') return { width: 853, height: 480 };
      return () => {};
    },
    set() { return true; }
  });
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
  const train = frame.indexOf('drawTrainLine(g,L,now,fx,"base")');
  const service = frame.indexOf('drawTrainLine(g,L,now,fx,"service")');
  assert.ok(train >= 0, 'train base draw call must remain in the main frame');
  assert.ok(service > train, 'station and train service layer must render after the viaduct');
  for (const protectedDraw of [
    'drawLandmarks(g,L,now,night,nd)',
    'drawBuilds(g,L,now,night)',
    'drawNewsScreens(g,L,now,night)',
    'drawSportsDistrict(g,L,now)',
    'drawJumbotrons(g,L,now,night)'
  ]) {
    assert.ok(frame.indexOf(protectedDraw, train) > train, protectedDraw + ' must render in front of the train');
    assert.ok(frame.indexOf(protectedDraw, train) < service, protectedDraw + ' must stay behind train stations');
  }
});

test('dialogue is readable, sparse, and never overwhelms the street', () => {
  const source = fs.readFileSync(ENGINE, 'utf8');
  const speech = source.slice(source.indexOf('function drawSpeechBubbles'), source.indexOf('function peopleMarketBeat'));
  assert.match(speech, /beatMs=apocFinal\?1800:3200/);
  assert.match(speech, /sceneCycle=apocFinal\?9000:24000/);
  assert.match(speech, /gate=apocFinal\?2:11/);
  assert.match(speech, /shown<2/);
});

test('top monorail uses world coordinates and renders in the live service layer', () => {
  const source = fs.readFileSync(ENGINE, 'utf8');
  const mono = source.slice(source.indexOf('function drawMonorail(g,L,now,cb,part)'), source.indexOf('function drawMonoTrain'));
  assert.match(mono, /route=WW\+trainW\+90/);
  assert.doesNotMatch(mono, /route=SW\+/);
  const frame = source.slice(source.indexOf('function draw(g,pass)'));
  assert.ok(frame.indexOf('drawMonorailService(g,L,now)') > frame.indexOf('if(pass==="city") return'));
});

test('street ads use framed landscape billboard faces', () => {
  const source = fs.readFileSync(ENGINE, 'utf8');
  const ads = source.slice(source.indexOf('function drawCorpAds'), source.indexOf('function drawBillsAds'));
  assert.match(ads, /ph=19/);
  assert.match(ads, /maintenance catwalk/);
  assert.match(ads, /Thick steel casing/);
  assert.match(ads, /bold brand\/logo field/);
});

test('live aircraft visibly follow altitude changes and stay inside the sky', () => {
  const at = 1784219400000;
  function flightY(rate) {
    const ctx = loadEngine();
    ctx.FORCEAGE = 0.72;
    ctx.FORCEFLIGHTS = [{ cs:'TEST1', hex:rate > 0 ? 'climb' : 'desc', cat:'A3', e0:12000, n0:18000,
      alt0:rate > 0 ? 3000 : 8000, track:90, gs:220, vr:rate, t0:at, lastSeen:at }];
    ctx.NOWOVR = at;
    ctx.draw(canvasStub(), 'skyfast');
    const first = ctx.flightSmooth[rate > 0 ? 'climb' : 'desc'].y;
    ctx.NOWOVR = at + 60000;
    ctx.draw(canvasStub(), 'skyfast');
    const last = ctx.flightSmooth[rate > 0 ? 'climb' : 'desc'].y;
    assert.ok(first >= 22 && last >= 22, 'aircraft data plate must remain on-screen');
    return [first, last];
  }
  const climb = flightY(1800), descent = flightY(-1800);
  assert.ok(climb[1] < climb[0], 'climbing aircraft must move upward');
  assert.ok(descent[1] > descent[0], 'descending aircraft must move downward');
});
