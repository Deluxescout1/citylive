// ANIMALS ARE MEASURED AGAINST THE PERSON, NOT AGAINST K.
//
// Nick: "Animals must be sized proportionally to everything else — they should only [be] massive if
// they are genuinely that big."
//
// The bug: drawQuad scaled by `S = max(0.8, K*0.85)` while drawPerson does NOT scale at all — every
// rect in drawPerson is a literal offset, and the engine's own comment says a person is 7 px and
// reads as one floor. So at Nick's KSP=2 the animals ran at 1.7x while people stayed at 1x, and the
// error compounded because the table's values were already generous:
//     a coyote was drawn 1.4x a person's height; a real coyote is 0.3x  -> 4.6x too big
//     a bear was drawn 2.0x;                     a bear on all fours is 0.6x -> 3.3x too big
//
// This test pins the RATIO to a real animal's shoulder height, so the table cannot drift back and a
// future K-scaling change cannot quietly reinflate them.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');
const PERSON_PX = 7;        // drawPerson's fixed height — the engine's reference unit
const HUMAN_M = 1.70;

// real shoulder height (quadrupeds stand on four legs; that is what `h` means here)
const REAL_M = {
  elk: 1.50, bear: 1.00, boar: 0.90, bighorn: 0.95, coyote: 0.60, bison: 1.85,
  pronghorn: 0.87, cattle: 1.40, seal: 0.45, ibex: 0.90, wolf: 0.80,
  polarbear: 1.30, walrus: 1.00, caribou: 1.20
};

function loadEngine(pxk) {
  const ctx = { console, Date, Math, JSON, setTimeout, clearTimeout,
    XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), ctx);
  ctx.NOFETCH = true;
  ctx.setup('neon', { cw: 1552, ch: 874, woff: 0, ww: 2269, pxk, zoom: 2,
                      taskbarWp: 0, quality: 'balanced' });
  return ctx;
}

test('no quadruped is drawn more than 1.6x its true size relative to a person', () => {
  const ctx = loadEngine(3);
  const bad = [];
  for (const [name, sp] of Object.entries(ctx.FAUNA)) {
    if (sp.plan !== 'quad') continue;
    const real = REAL_M[name];
    if (!real) continue;                       // fictional/unreferenced animals are not pinned
    const drawn = Math.max(3, sp.h) / PERSON_PX;
    const target = real / HUMAN_M;
    const ratio = drawn / target;
    // 3px is a legibility floor, so small animals are allowed to be generous
    if (Math.max(3, sp.h) > 3 && ratio > 1.6) bad.push(`${name}: drawn ${drawn.toFixed(1)}x a person, real ${target.toFixed(1)}x (${ratio.toFixed(1)}x too big)`);
  }
  assert.deepStrictEqual(bad, [], 'animals are out of proportion with people:\n  ' + bad.join('\n  '));
});

test('animal size does not change with screen resolution, because a person does not', () => {
  // The whole bug was that one scaled with K and the other did not. If a future change reintroduces
  // K into drawQuad, the same animal will come out different sizes on Nick's three monitors.
  const sizes = new Set();
  for (const pxk of [2, 3, 6]) {
    const ctx = loadEngine(pxk);
    const src = ctx.drawQuad.toString();
    const m = src.match(/var\s+S\s*=\s*([^,;]+)/);
    assert.ok(m, 'could not find drawQuad\'s scale expression');
    sizes.add(m[1].trim());
    assert.ok(!/\bK\b/.test(m[1]),
      'drawQuad\'s scale references K again — animals will resize per monitor while people do not');
  }
  assert.strictEqual(sizes.size, 1, 'drawQuad scale differs across resolutions');
});

test('the biggest land animal is still bigger than the smallest, and a bison beats a coyote', () => {
  const ctx = loadEngine(3);
  const F = ctx.FAUNA;
  assert.ok(F.bison.h > F.coyote.h, 'a bison must out-measure a coyote');
  assert.ok(F.bison.h > F.bear.h, 'a bison is taller at the shoulder than a bear on all fours');
  assert.ok(F.polarbear.h >= F.wolf.h, 'a polar bear must out-measure a wolf');
});
