// EVERY ANIMAL A LAND ASKS FOR MUST EXIST, AND MUST BE IN A LIST ITS BODY PLAN CAN SURVIVE.
//
// A biome declares its wildlife as three lists of species names:
//     fauna:{ big:[...], small:[...], air:[...] }
// and drawBiomeFauna routes each list to a different sprite writer — `big` to drawQuad, `small` to
// the speck writer, `air` to the bird writer. Two things can go wrong, and both had:
//
//  1. THE NAME DOES NOT EXIST IN `FAUNA`. drawBiomeFauna does `sp=FAUNA[name]; if(!sp) continue;`
//     so the animal is skipped IN SILENCE. Nine species were in this state — camel, oryx, fennec,
//     scarab, monkey, buffalo, flamingo, and (predating all of tonight's work) `goat` and `bat`,
//     which the beach and volcano variants had been asking for since Phase 4. Those lands rendered
//     with no animals at all and nothing anywhere said so. You cannot see "silently nothing" in a
//     screenshot; the only way to find it is to check the declarations against the table.
//
//  2. THE NAME EXISTS BUT IS IN THE WRONG LIST. `flamingo` is a bird — no `c2` — and it was declared
//     in `big`, which hands it to drawQuad, which reads `sp.c2[0]`. That is not a silent skip, it is
//     a TypeError that killed the whole frame: THE SALT MIRROR threw on every draw at every city age.
//     It surfaced as a generic "draw threw" in an unrelated almanac test, three lands away from the
//     cause.
//
// Both are one-line mistakes that are invisible in review and expensive to trace, so they get a test.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');

function engine() {
  const ctx = {
    console, Date, Math, JSON, setTimeout, clearTimeout,
    XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), ctx);
  return ctx;
}

// which body plans each list can actually render. `big` -> drawQuad, `small` -> speck, `air` -> bird.
const LIST_PLANS = { big: ['quad'], small: ['spot'], air: ['bird'] };

function everyFaunaBlock(ctx) {
  const out = [];
  const push = (b, where) => { if (b && b.fauna) out.push({ fauna: b.fauna, where }); };
  ctx.BIOMES.forEach((b) => push(b, b.name || b.k));
  for (const k of Object.keys(ctx.BIOME_VARIANTS))
    ctx.BIOME_VARIANTS[k].forEach((v, i) => push(v, `${k}/${i} ${v.name || '(base)'}`));
  return out;
}

test('every species a land declares exists in the FAUNA table', () => {
  const ctx = engine();
  const missing = [];
  for (const { fauna, where } of everyFaunaBlock(ctx))
    for (const list of Object.keys(LIST_PLANS))
      for (const name of fauna[list] || [])
        if (!ctx.FAUNA[name]) missing.push(`${where}: ${list}[] wants "${name}"`);
  assert.deepStrictEqual(missing, [],
    'These lands declare animals that do not exist, so drawBiomeFauna skips them SILENTLY and the ' +
    'land renders with fewer animals than it claims:\n  ' + missing.join('\n  '));
});

test('every species is in a list its body plan can survive', () => {
  const ctx = engine();
  const wrong = [];
  for (const { fauna, where } of everyFaunaBlock(ctx))
    for (const [list, plans] of Object.entries(LIST_PLANS))
      for (const name of fauna[list] || []) {
        const sp = ctx.FAUNA[name];
        if (!sp) continue;                       // covered by the test above
        if (!plans.includes(sp.plan))
          wrong.push(`${where}: ${list}[] contains "${name}" (plan "${sp.plan}", needs ${plans.join('/')})`);
      }
  assert.deepStrictEqual(wrong, [],
    'A species in the wrong list is handed to the wrong sprite writer. This is not a silent skip — ' +
    'a bird in big[] reaches drawQuad, which reads sp.c2[0], and the whole frame throws:\n  ' +
    wrong.join('\n  '));
});

test('every land can actually draw a frame, on every land, without throwing', () => {
  // The backstop. The flamingo bug was found by an almanac test three lands away from its cause;
  // this walks every biome and variant directly so the next one names itself.
  const ctx = engine();
  const noop = () => {};
  const g = new Proxy({}, {
    get(_o, k) {
      if (k === 'canvas') return { width: 854, height: 480 };
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
      if (k === 'measureText') return () => ({ width: 4 });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return noop;
    },
    set() { return true; }
  });
  const failures = [];
  ctx.GROW_CYCLE = 604800000; ctx.NOFETCH = true; ctx.FORCEEGG = null;
  for (const b of ctx.BIOMES) {
    const nv = (ctx.BIOME_VARIANTS[b.k] || [{}]).length;
    for (let v = 0; v < nv; v++) {
      ctx.FORCEBIOME = b.k; ctx.FORCEVARIANT = v;
      const d = new Date(1783972450746 + 44 * 604800000 + Math.round(0.45 * 604800000));
      d.setHours(13, 0, 0, 0);
      ctx.NOWOVR = ctx.CLOCK = d.getTime();
      ctx.setup('neon', { cw: 854, ch: 480, woff: 776, ww: 2269, pxk: 3, zoom: 1,
                          taskbarWp: 28, quality: 'balanced', frameMs: 125 });
      ctx.FORCEAGE = 0.72; ctx.weather.code = 0; ctx.weather.wind = 8; ctx.weather.temp = 64;
      const name = (ctx.curBiome && ctx.curBiome.name) || `${b.k}/${v}`;
      try { ctx.draw(g, 'bg'); ctx.draw(g, 'live'); }
      catch (e) { failures.push(`${name}: ${e.message}`); }
    }
  }
  assert.deepStrictEqual(failures, [], 'These lands throw while drawing:\n  ' + failures.join('\n  '));
});
