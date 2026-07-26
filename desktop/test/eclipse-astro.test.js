'use strict';

// LOCATION-TRUE SKY — regression cover for the eclipse/aurora/shower work.
//
// Nick, 2026-07-26: "you see it HOW you'd see it based on your Location. So like I would see it
// different in Norwich than Buffalo or even Houston."
//
// ⚠⚠ THE TEST THAT ACTUALLY MATTERS is `differs by location`. Every other check here would still pass
// if the Moon's PARALLAX were left out — you can swap in a perfect ephemeris, delete the date table,
// and still hand every observer on Earth an identical eclipse. Parallax is ~1°, about twice the
// Moon's own diameter, and it is the entire reason an eclipse is total in one town and nothing three
// states away. If `differs by location` ever goes green while the others fail, suspect the test.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');

function loadEngine(lat, lon) {
  const sandbox = {
    Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    isNaN, isFinite, parseInt, parseFloat, console,
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {}
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const c = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), c, { filename: 'city.js' });
  c.NOFETCH = true;
  c.setup('neon', { cw: 853, ch: 480, woff: 0, ww: 853, pxk: 3, zoom: 1, quality: 'spectacle' });
  if (lat !== undefined) { c.LAT = lat; c.LON = lon; }
  return c;
}

// scan a UTC day for the deepest solar eclipse this observer gets
function bestSolar(c, y, m, d) {
  let best = { obsc: -1 };
  for (let t = 0; t < 24 * 60; t += 1) {
    const when = new Date(Date.UTC(y, m - 1, d, 0, t, 0));
    const r = c.solarEclipseAt(when);
    if (r.obsc > best.obsc) { best = r; best.when = when; }
  }
  return best;
}
function bestLunar(c, y, m, d) {
  let best = { umbMag: -99 };
  for (let t = 0; t < 24 * 60; t += 2) {
    const when = new Date(Date.UTC(y, m - 1, d, 0, t, 0));
    const r = c.lunarEclipseAt(when);
    if (r.umbMag > best.umbMag) { best = r; best.when = when; }
  }
  return best;
}

// ---- the ephemeris itself, against Meeus's own worked examples -------------------------------
test('Moon position matches Meeus example 47.a', () => {
  const c = loadEngine();
  const m = c.ecMoonPos(2448724.5);                       // 1992 April 12.0 TD
  assert.ok(Math.abs(m.lon - 133.162655) < 0.0005, 'lon ' + m.lon);
  assert.ok(Math.abs(m.lat - (-3.229126)) < 0.0005, 'lat ' + m.lat);
  assert.ok(Math.abs(m.dist - 368409.7) < 1.0, 'dist ' + m.dist);
});

test('Sun position matches Meeus example 25.a', () => {
  const c = loadEngine();
  const s = c.ecSunPos(2448908.5);                        // 1992 October 13.0 TD
  assert.ok(Math.abs(s.lon - 199.90895) < 0.0005, 'lon ' + s.lon);
  assert.ok(Math.abs(s.dist - 0.99766) < 0.0002, 'R ' + s.dist);
});

// ---- ⚠ THE ONE THAT PINS THE PARALLAX ---------------------------------------------------------
test('a solar eclipse differs by location — Norwich, Buffalo and Houston disagree', () => {
  const norwich = bestSolar(loadEngine(41.5243, -72.0759), 2024, 4, 8);
  const buffalo = bestSolar(loadEngine(42.8864, -78.8784), 2024, 4, 8);
  const houston = bestSolar(loadEngine(29.7604, -95.3698), 2024, 4, 8);

  // published circumstances for the 2024-04-08 total: Buffalo is on the centre line, Norwich sees
  // ~90% and Houston ~93%. All three must be genuinely different numbers.
  assert.ok(buffalo.total, 'Buffalo should be TOTAL, got mag ' + buffalo.mag.toFixed(3));
  assert.ok(!norwich.total && norwich.obsc > 0.86 && norwich.obsc < 0.94, 'Norwich obsc ' + norwich.obsc);
  assert.ok(!houston.total && houston.obsc > 0.90 && houston.obsc < 0.96, 'Houston obsc ' + houston.obsc);
  assert.ok(Math.abs(norwich.obsc - houston.obsc) > 0.02, 'Norwich and Houston must differ');
  // and the greatest eclipse happens at genuinely different CLOCK times, west to east
  assert.ok(houston.when.getTime() < buffalo.when.getTime(), 'Houston peaks before Buffalo');
  assert.ok(buffalo.when.getTime() < norwich.when.getTime(), 'Buffalo peaks before Norwich');
});

test('an eclipse that misses you is not drawn — 2027-08-02 is invisible from North America', () => {
  // the Egypt/Spain total. The old code blacked out the sky for this everywhere on Earth.
  for (const [name, lat, lon] of [['Norwich', 41.5243, -72.0759], ['Buffalo', 42.8864, -78.8784],
                                  ['Houston', 29.7604, -95.3698]]) {
    const b = bestSolar(loadEngine(lat, lon), 2027, 8, 2);
    assert.strictEqual(b.visible, false, name + ' must not see the 2027-08-02 eclipse');
    assert.ok(b.sunAlt < 0, name + ' sun should be below the horizon, alt ' + b.sunAlt);
  }
  // …while Cairo, close to the path, gets a deep one high in the sky
  const cairo = bestSolar(loadEngine(30.04, 31.24), 2027, 8, 2);
  assert.ok(cairo.visible && cairo.obsc > 0.85, 'Cairo obsc ' + cairo.obsc);
});

test('published solar magnitudes reproduce across five cities', () => {
  const want = [['Norwich', 41.5243, -72.0759, 0.90], ['Buffalo', 42.8864, -78.8784, 1.00],
                ['Houston', 29.7604, -95.3698, 0.93], ['Seattle', 47.6062, -122.3321, 0.21],
                ['Miami', 25.7617, -80.1918, 0.45]];
  for (const [name, lat, lon, obsc] of want) {
    const b = bestSolar(loadEngine(lat, lon), 2024, 4, 8);
    assert.ok(Math.abs(b.obsc - obsc) < 0.03, name + ' obsc ' + b.obsc.toFixed(3) + ' want ~' + obsc);
  }
});

// ---- lunar: the magnitude is global, the VISIBILITY is local ----------------------------------
test('lunar eclipse magnitude is the same everywhere but visibility is not', () => {
  const nor = bestLunar(loadEngine(41.5243, -72.0759), 2025, 3, 14);
  const tok = bestLunar(loadEngine(35.68, 139.69), 2025, 3, 14);
  // same shadow, same depth — the Moon is physically inside it
  assert.ok(Math.abs(nor.umbMag - tok.umbMag) < 1e-9, 'umbral magnitude must not vary by observer');
  assert.ok(Math.abs(nor.umbMag - 1.178) < 0.02, 'umbMag ' + nor.umbMag);   // published 1.178
  // …but only one of them can see it
  assert.strictEqual(nor.visible, true, 'Norwich sees the 2025-03-14 total');
  assert.strictEqual(tok.visible, false, 'Tokyo does not');
});

test('the 2025-09-07 total lunar is an Asia/Europe event, not an American one', () => {
  const nor = bestLunar(loadEngine(41.5243, -72.0759), 2025, 9, 7);
  const tok = bestLunar(loadEngine(35.68, 139.69), 2025, 9, 7);
  assert.ok(Math.abs(nor.umbMag - 1.362) < 0.02, 'umbMag ' + nor.umbMag);   // published 1.362
  assert.strictEqual(nor.visible, false);
  assert.strictEqual(tok.visible, true);
});

// ---- the honest-dimming rule Nick chose --------------------------------------------------------
test('partial eclipses stay subtle; only a deep one darkens the city', () => {
  const c = loadEngine(41.5243, -72.0759);
  const dim = (o) => Math.max(0, Math.min(1, (o - 0.55) / 0.45));
  assert.strictEqual(dim(0.30), 0, 'a 30% partial must not dim the city at all');
  assert.strictEqual(dim(0.55), 0, 'even 55% is only odd light, not darkness');
  assert.ok(dim(0.90) > 0.6 && dim(0.90) < 0.9, 'a 90% partial is clearly dusky');
  assert.ok(dim(1.0) > 0.999, 'totality is full');
  // and the engine agrees on a real day
  const b = bestSolar(c, 2024, 4, 8);
  assert.ok(dim(b.obsc) > 0.6, 'Norwich on 2024-04-08 should read dusky');
});

// ---- what actually gets DRAWN ------------------------------------------------------------------
// ⚠ This one exists because of a bug that pixel-hunting could not find and draw-call recording found
// in one shot. The Sun is painted in the "bg" pass; the eclipse twilight veil is a full-screen rect
// in the "live" pass, i.e. a DIFFERENT CANVAS that does not necessarily repaint on the same tick.
// The veil was therefore laying 74% black over the corona — at totality the sky went dark and the one
// thing you came outside to see disappeared with it. Recording the rects is the reliable check.
function recordPasses(lat, lon, utc) {
  const c = loadEngine();
  const t = new Date(utc).getTime();
  c.FORCEBIOME = 'alpine'; c.FORCEVARIANT = 0;
  c.applyConfig({ lat, lon });
  c.NOWOVR = c.CLOCK = t;
  c.setup('neon', { cw: 2269, ch: 437, woff: 0, ww: 2269, pxk: 3, zoom: 1, quality: 'balanced', frameMs: 125 });
  c.applyConfig({ lat, lon });
  c.FORCEAGE = 0.85; c.weather.code = 0; c.weather.cloud = 5; c.weather.temp = 58;
  c.NOWOVR = c.CLOCK = t;
  const mk = (log) => {
    const grad = { addColorStop() {} };
    let fill = '';
    return new Proxy({}, {
      get(_t, p) {
        if (p === 'measureText') return (s) => ({ width: String(s || '').length * 4 });
        if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => grad;
        if (p === 'canvas') return { width: 2269, height: 437 };
        if (p === 'fillRect') return (x, y, w, h) => log.push({ x, y, w, h, f: fill });
        return () => {};
      },
      set(_t, p, v) { if (p === 'fillStyle') fill = v; return true; }
    });
  };
  const bg = []; c.draw(mk(bg), 'bg');
  const live = []; c.draw(mk(live), 'live');
  const sx = c.eclSunX, sy = c.eclSunY;
  return {
    dim: c.solarEclDim,
    disc: bg.filter(o => Math.abs(o.x - sx) < 14 && Math.abs(o.y - sy) < 14 && /#08081|#05050c/.test(String(o.f))).length,
    liveNearSun: live.filter(o => Math.abs(o.x - sx) < 30 && Math.abs(o.y - sy) < 30).length,
    veils: live.filter(o => o.w >= 2000 && o.h >= 400).length
  };
}

test('totality darkens the city AND leaves the corona visible over the veil', () => {
  const r = recordPasses(42.8864, -78.8784, '2024-04-08T19:21:00Z');   // Buffalo, on the centre line
  assert.ok(r.dim > 0.99, 'totality should fully dim, got ' + r.dim);
  assert.ok(r.disc > 20, 'the dark lunar disc must be drawn, got ' + r.disc + ' rects');
  assert.ok(r.veils === 1, 'exactly one full-screen twilight veil');
  // …and the live pass must put something back at the Sun AFTER that veil, or totality renders as an
  // empty dark sky. This is the assertion that would have caught the bug.
  assert.ok(r.liveNearSun > 20, 'corona must be restored over the veil, got ' + r.liveNearSun);
});

test('a shallow partial draws the bite but does NOT veil the city', () => {
  const r = recordPasses(47.6062, -122.3321, '2024-04-08T18:31:00Z');  // Seattle, ~21% covered
  assert.strictEqual(r.dim, 0, 'a 21% partial must not dim the city');
  assert.ok(r.disc > 20, 'you should still see the Moon take a bite, got ' + r.disc);
  assert.strictEqual(r.veils, 0, 'no twilight veil for a shallow partial');
});

test('the Moon crosses the Sun in the right DIRECTION', () => {
  // ⚠ This is the check the draw-call recorder structurally cannot make: it counts rects near the
  // Sun, and a mirrored transit puts exactly as many rects there as a correct one. The Moon always
  // drifts EASTWARD past the Sun, so dx must run negative -> positive through the eclipse…
  const c = loadEngine(); c.applyConfig({ lat: 42.8864, lon: -78.8784 });
  const dxAt = (h, m) => c.solarEclipseAt(new Date(Date.UTC(2024, 3, 8, h, m, 0))).dx;
  assert.ok(dxAt(18, 30) < -0.5, 'first contact: Moon east of Sun, dx ' + dxAt(18, 30));
  assert.ok(Math.abs(dxAt(19, 21)) < 0.2, 'greatest eclipse: centred, dx ' + dxAt(19, 21));
  assert.ok(dxAt(20, 10) > 0.5, 'last contact: Moon west of Sun, dx ' + dxAt(20, 10));
  // …and because this engine lays the day out left-to-right (sx2 = df*WW, df=0 at sunrise), screen
  // RIGHT is WEST. So on screen the dark disc must travel right -> left. That is why the renderer
  // uses `sx2 - dx*SR`; with a plus the whole transit ran backwards.
  const screenX = (h, m) => -dxAt(h, m);
  assert.ok(screenX(18, 30) > screenX(19, 21), 'disc enters from screen right');
  assert.ok(screenX(19, 21) > screenX(20, 10), 'and exits screen left');
});

// ---- no date tables left anywhere --------------------------------------------------------------
test('the hardcoded eclipse date lists are gone from every engine copy', () => {
  for (const rel of ['renderer/city.js', '../web/city.js', '../phone/city.js',
                     '../org.citylive.wallpaper/contents/js/city.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    assert.ok(!/SOLAR_ECLIPSES|LUNAR_ECLIPSES/.test(src),
      rel + ' still carries a hardcoded eclipse table');
  }
});

// ---- aurora by geomagnetic latitude, not by temperature -----------------------------------------
test('aurora follows geomagnetic latitude and the real Kp, not a coin flip', () => {
  const at = (lat, lon, kp) => { const c = loadEngine(lat, lon); c.kpNow = kp; return c.auroraLevel(); };
  // a moderate storm: overhead in Alaska, a northern glow in Connecticut, nothing on the Gulf
  assert.strictEqual(at(64.84, -147.72, 6), 1, 'Fairbanks at Kp6');
  const nor = at(41.5243, -72.0759, 6);
  assert.ok(nor > 0.2 && nor < 1, 'Norwich at Kp6 should be a glow, got ' + nor);
  assert.strictEqual(at(29.76, -95.37, 6), 0, 'Houston at Kp6 sees nothing');
  // quiet night: even Norwich gets nothing, Fairbanks still does
  assert.strictEqual(at(41.5243, -72.0759, 1), 0, 'Norwich on a quiet night');
  assert.ok(at(64.84, -147.72, 1) > 0, 'Fairbanks on a quiet night');
  // and Kp 0 (offline / no data) is silent everywhere
  assert.strictEqual(at(64.84, -147.72, 0), 0, 'no space-weather data → no aurora');
});

test('geomagnetic latitude is right for the cities we care about', () => {
  const gm = (lat, lon) => loadEngineAt(lat, lon).geomagLat();
  function loadEngineAt(la, lo) { return loadEngine(la, lo); }
  assert.ok(Math.abs(gm(41.5243, -72.0759) - 51) < 2, 'Norwich ~51');
  assert.ok(Math.abs(gm(64.84, -147.72) - 65) < 2, 'Fairbanks ~65');
  assert.ok(Math.abs(gm(29.76, -95.37) - 39) < 2, 'Houston ~39');
  assert.ok(Math.abs(gm(51.51, -0.13) - 54) < 3, 'London ~54 — lower than Norwich despite being further north');
});
