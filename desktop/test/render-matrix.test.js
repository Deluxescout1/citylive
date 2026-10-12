'use strict';

// RENDER-MATRIX — the engine's whole surface, permanently watched.
//
// The audit that wrote this ran ALL of it (31 lands × 5 weathers × day/night × 8 passes, fresh
// vm per land) and it found real defects, both in the "silently nothing" class:
//   • dunes/salt painted ~225 NaN fillRects per sweep — FAUNA.fennec had no w/h but the
//     PREDATORS hunter table reads them raw, so the hunt scene never rendered at all;
//   • (earlier audit) the karst/fjord/undercity front waters never saw a rain ring.
// This permanent copy keeps the assertions that are cheap and drift-proof:
//   1. THE LAND-TRAP: every pin renders the land you named. Eggs go through FORCEEGG — an egg
//      pinned via `land:` silently renders the roll and "passes" every other check (the exact
//      trap docs/LANDS.md warns has cost more than one session).
//   2. No exception in setup or any pass, across weathers and day/night.
//   3. No non-finite canvas coordinate anywhere (a moveTo(x, NaN) kills its whole path on a real
//      QML canvas; a "rgba(...,NaN)" style paints nothing) — the fennec class of defect.
//   4. The legacy full pass builds a real frame (op floor) and the water pass draws whenever the
//      land genuinely has seam water (SEA_FRONT 0 AND seaW > 0).
// Blank-exempt passes: sky/skyfast/cloud early-return by design; water is legitimately empty on
// front-water lands (SEA_FRONT>0 ⇒ seaW=0 — the engine's "two coastlines read as nowhere" ruling)
// and on any slice that doesn't touch a seam.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');
const SRC = fs.readFileSync(ENGINE, 'utf8');

const ROLLED = ['alpine','forest','mesa','cliffs','plains','beach','swamp','volcano','arctic','sprawl','hell','heaven','dunes','karst','fjord','salt','dam','under','savanna'];
const EGGS = ['leaf','core','fire','air','falls','orbit','plateau','rainv','lumbridge','falador','ardougne','varrock'];
const DAY_T = 1791250800000, NIGHT_T = 1808497090746;
const WX = {
  clear:   { code: 0,  cloud: 20,  wind: 6,  temp: 64, precip: 0,   feels: 64, gust: 9 },
  rain:    { code: 63, cloud: 98,  wind: 14, temp: 52, precip: 2.4, feels: 50, gust: 26 },
  thunder: { code: 95, cloud: 99,  wind: 24, temp: 54, precip: 6,   feels: 52, gust: 48 },
  snow:    { code: 73, cloud: 90,  wind: 10, temp: 22, precip: 2,   feels: 14, gust: 18 }
};
// geometry = Nick's real middle screen: mid slice of the 2269px 3-monitor world
const GEO = { cw: 853, ch: 480, woff: 582, ww: 2269, pxk: 6, quality: 'performance' };

function load() {
  const sb = { Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    isNaN, isFinite, parseInt, parseFloat, console,
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {} };
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  const c = vm.createContext(sb);
  vm.runInContext(SRC, c, { filename: 'city.js' });
  c.NOFETCH = true;
  return c;
}
// op canvas: full call accounting. NaN surveillance covers path ops and gradient args too —
// moveTo(x, NaN) / createLinearGradient(NaN,…) fail silently on a real canvas, exactly like paint.
const NONPAINT = new Set(['save','restore','beginPath','closePath','clip','translate','rotate','scale','setTransform','resetTransform','setLineDash','setLineJoin','setLineCap','clearRect']);
function makeG() {
  const st = { n: 0, bad: 0 };
  const gradient = { addColorStop() {} };
  const g = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'measureText') return () => ({ width: 4 });
      if (prop.startsWith('create')) return (...a) => { for (const v of a) if (typeof v === 'number' && !isFinite(v)) st.bad++; st.grad++; return gradient; };
      if (prop === 'getImageData') return () => ({ data: [] });
      return (...a) => {
        for (const v of a) if (typeof v === 'number' && !isFinite(v)) st.bad++;
        if (NONPAINT.has(prop)) return;
        st.n++;
      };
    },
    set(t, prop, val) {
      if ((prop === 'fillStyle' || prop === 'strokeStyle') && typeof val === 'string' && /[Ii]nfinity|NaN/.test(val)) st.bad++;
      return true;
    }
  });
  return [g, st];
}

// one land, one weather, one light, across the paint-bearing passes
function sweep(c, wxPin, T, wet) {
  const out = { bad: 0, counts: {}, ex: null };
  c.NOWOVR = T; c.CLOCK = T;
  c.FORCEWX = Object.assign({}, wxPin);
  c.wetness = wet != null ? wet : (wxPin.code > 60 ? 1 : 0);
  c.splashes && (c.splashes.length = 0);
  for (const pass of [undefined, 'water', 'city', 'fg', 'live']) {
    const [g, st] = makeG();
    try { c.draw(g, pass); out.counts[pass || 'full'] = st.n; out.bad += st.bad; }
    catch (e) { out.ex = (pass || 'full') + ': ' + e.message; break; }
  }
  return out;
}

test('every pin renders the land you named — no land=/egg= trap', () => {
  for (const land of ROLLED) {
    const c = load();
    c.NOWOVR = DAY_T; c.CLOCK = DAY_T; c.applyConfig({ land });
    c.setup('neon', GEO);
    assert.strictEqual(c.curBiome.k, land, `applyConfig({land}) must honour "${land}"`);
  }
  for (const egg of EGGS) {
    const c = load();
    c.NOWOVR = DAY_T; c.CLOCK = DAY_T; c.applyConfig({ egg });
    c.setup('neon', GEO);
    assert.strictEqual(c.curBiome.k, egg, `applyConfig({egg}) must pin the egg land "${egg}"`);
  }
});

test('no exceptions and no non-finite coordinates, any land × weather × light', () => {
  // two lights per land; weather × pass × full draws inside sweep()
  for (const land of ROLLED.concat(EGGS)) {
    const c = load();
    c.NOWOVR = DAY_T; c.CLOCK = DAY_T;
    c.applyConfig(EGGS.includes(land) ? { egg: land } : { land });
    c.setup('neon', GEO);
    for (const T of [DAY_T, NIGHT_T]) {
      for (const wxName of Object.keys(WX)) {
        const r = sweep(c, WX[wxName], T);
        assert.strictEqual(r.ex, null, `${land} ${wxName} T=${T}: ${r.ex}`);
        assert.strictEqual(r.bad, 0, `${land} ${wxName} T=${T}: ${r.bad} non-finite canvas args`);
      }
    }
  }
});

test('the legacy full pass paints a real city; a slice-visible seam ocean paints its water pass', () => {
  for (const land of ROLLED.concat(EGGS)) {
    const c = load();
    c.NOWOVR = DAY_T; c.CLOCK = DAY_T;
    c.applyConfig(EGGS.includes(land) ? { egg: land } : { land });
    c.setup('neon', GEO);
    const r = sweep(c, WX.clear, DAY_T);
    assert.ok(r.counts.full > 1000, land + ': legacy full pass built only ' + r.counts.full + ' ops');
    // The seam ocean lives near the WORLD seams: bands [0, WW*seaW] and [WW*(1-seaW), WW] per side.
    // It only reaches a slice whose [WOFF, WOFF+SW] window overlaps one — the middle screen of
    // Nick's 2269px world mostly sees none, which is correct, not blank.
    if (c.seaW > 0) {
      const seam = c.seaW * c.ww;
      if (c.woff < seam || c.woff + c.cw > c.ww - seam) {
        assert.ok(r.counts.water > 20, land + ': seam bands overlap the slice but the water pass painted ' + r.counts.water + ' ops');
      }
    }
  }
});