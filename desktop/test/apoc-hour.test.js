'use strict';

// "GIVE THEM THE ABILITY TO CHOOSE WHEN IT HAPPENS" — Nick, 2026-07-30.
//
// ⚠⚠ THE ONLY TEST THAT MATTERS HERE IS WHERE THE BOUNDARY LANDS. The feature first shipped
// verified by a probe that printed the GROW_ALIGN values and checked they differed between two
// chosen hours. They did — and the feature was still wrong twice over:
//   1. the guard was `cyc > 86400000`, which silently ignored apocHour on 3d/1w/2w/3w/1mo (five
//      of the eight cycles) while the settings UI went on offering the hour picker beside them;
//   2. alignMsFor returned `(cyc - m)`, the COMPLEMENT of the offset, so where alignment did
//      apply it put the rollover at the mirror hour — apocHour=20 rolled the city over at 11:49.
// A harness is only evidence for the thing it measures. Assert the clock, not the constant.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');
const SRC = fs.readFileSync(ENGINE, 'utf8');

function loadEngine() {
  const sandbox = {
    Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    isNaN, isFinite, parseInt, parseFloat, console,
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {}
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const c = vm.createContext(sandbox);
  vm.runInContext(SRC, c, { filename: 'city.js' });
  c.NOFETCH = true;
  c.setup('neon', { cw: 853, ch: 480, woff: 0, ww: 853, pxk: 3, zoom: 1, quality: 'spectacle' });
  return c;
}

// Every cycle the settings dropdown offers.
const CYCLES = ['1h', '12h', '1d', '3d', '1w', '2w', '3w', '1mo'];
// A 1-hour life rolls over every hour, so the hour picker can only pin the MINUTE (:00).
// Every other cycle can and must land on the chosen hour itself.
const HOURLY = new Set(['1h']);

// Walk the clock forward and collect the local times at which lifeIndexOf() steps.
function boundaries(c, from, span, want) {
  const step = 60000;
  const hits = [];
  let prev = c.lifeIndexOf(from);
  for (let d = step; d <= span && hits.length < want; d += step) {
    const i = c.lifeIndexOf(from + d);
    if (i !== prev) { hits.push(new Date(from + d)); prev = i; }
  }
  return hits;
}

test('every cycle rolls the city over at the chosen hour', () => {
  for (const hour of [0, 3, 20, 23]) {
    for (const cyc of CYCLES) {
      const c = loadEngine();
      c.applyConfig({ cycle: cyc, apocHour: hour });
      const hits = boundaries(c, Date.now(), c.GROW_CYCLE * 2 + 60000, 2);
      assert.ok(hits.length >= 1, `${cyc} @${hour}: no life boundary found in two full cycles`);
      for (const at of hits) {
        assert.strictEqual(at.getMinutes(), 0, `${cyc} @${hour}: rolled over at :${at.getMinutes()}, not on the hour`);
        if (!HOURLY.has(cyc)) {
          // A 12h life rolls twice a day; the chosen hour and its opposite are both correct.
          const ok = cyc === '12h' ? (at.getHours() % 12) === (hour % 12) : at.getHours() === hour;
          assert.ok(ok, `${cyc} @${hour}: rolled over at ${at.getHours()}:00, not ${hour}:00`);
        }
      }
    }
  }
});

test('no chosen hour leaves the grid untouched', () => {
  for (const cyc of CYCLES) {
    const c = loadEngine();
    c.applyConfig({ cycle: cyc, apocHour: -1 });
    assert.strictEqual(c.GROW_ALIGN, 0, `${cyc}: apocHour=-1 must not shift the cycle grid`);
  }
});

test('the alignment is a real shift, not a whole-cycle no-op', () => {
  // Guards the inverted-sign class of bug from the other direction: if alignMsFor ever returns a
  // value congruent to 0, the assertions above still pass for whichever hour happens to match.
  const a = loadEngine(); a.applyConfig({ cycle: '1d', apocHour: 4 });
  const b = loadEngine(); b.applyConfig({ cycle: '1d', apocHour: 17 });
  assert.notStrictEqual(a.GROW_ALIGN, b.GROW_ALIGN, 'two different hours produced the same grid');
  // GROW_ALIGN is a phase, so the gap is modular — subtract on the circle, not the number line.
  const day = 86400000;
  const diff = ((b.GROW_ALIGN - a.GROW_ALIGN) % day + day) % day;
  assert.strictEqual(diff, 13 * 3600000, `4:00 and 17:00 are 13h apart; grid differs by ${diff / 3600000}h`);
});

test('the settings dropdown and the engine agree on the cycle list', () => {
  // The hour picker is offered beside EVERY cycle, so a cycle the engine cannot align is a
  // silently dead control — exactly how the 3d/1w/2w/3w/1mo case shipped.
  const html = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'settings.html'), 'utf8');
  const sel = html.match(/<select[^>]*id="cycle"[\s\S]*?<\/select>/);
  assert.ok(sel, 'no #cycle select found in settings.html');
  const offered = [...sel[0].matchAll(/value="([^"]+)"/g)].map(m => m[1]);
  for (const v of offered) {
    const c = loadEngine();
    c.applyConfig({ cycle: v, apocHour: 9 });
    assert.ok(c.GROW_ALIGN > 0 || v === '1h',
      `settings offers cycle "${v}" with an hour picker the engine ignores`);
  }
});
