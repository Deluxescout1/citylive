// EVERY moving or rotating text surface runs off ONE pace.
//
// 🚨 THE BUG THIS PINS IS "half a fix", twice in one day. Nick: "the text and the Dialogue is moving
// WAAAAAAAY too fast" → I slowed the speech bubbles → "you didn't correct the text speed, some of
// them are still shooting off rapid fire." The bubbles were one surface out of six, and each had its
// own hand-tuned literal in a different function, so "slow the text down" could not be done once.
//
// ⚠⚠ AND THE FIRST ATTEMPT AT THE BLOCK-LEVEL FIX WAS WORSE THAN THE HALF FIX. Substituting every
// `Math.floor(now/9000)` in the file caught four sets of WINDOW LIGHTS, a neon colour cycle and a
// Bills slot — features that merely share the literal 9000. A magic number is not an identifier.
// This test pins both halves: the text surfaces are paced, and the non-text ones are NOT.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'city.js'), 'utf8');

test('there is a single named pace, not six scattered literals', () => {
  assert.match(SRC, /var TEXT_PACE=[\d.]+;/, 'TEXT_PACE must exist as one knob');
  assert.match(SRC, /function textRot\(ms\)\{ return Math\.max\(1, ms\/TEXT_PACE\); \}/);
  const pace = parseFloat(/var TEXT_PACE=([\d.]+);/.exec(SRC)[1]);
  assert.ok(pace > 0 && pace < 1, 'a pace of 1 or more would be no slower than the version Nick rejected');
});

test('all six text surfaces are paced', () => {
  const surfaces = {
    'ticker scroll': /off=\(now\*0\.014\*TEXT_PACE\)%tw2/,
    'ticker copy rotation': /Math\.floor\(now\/textRot\(9000\)\)/,
    'news screens scroll': /off=\(\(now\*0\.02\*TEXT_PACE\)\+b\.seed\*7\)%tw2/,
    'jumbotron crawl': /coff=\(\(now\*0\.02\*TEXT_PACE\)\+rx\*3\)%cwid/,
    'billboard brands': /\(\(now\/textRot\(18000\)\)\|0\)/,
    'regime slogans': /ORDER_SLOGANS\[\(Math\.floor\(now\/textRot\(2600\)\)\)/
  };
  for (const [name, re] of Object.entries(surfaces)) {
    assert.match(SRC, re, name + ' is not on the shared text pace');
  }
});

test('THE OVER-APPLICATION GUARD: window lights and neon are NOT text and must stay unpaced', () => {
  // These share the literal 9000 with the ticker and nothing else. If a future regex sweep catches
  // them, the city's windows start flickering at the speed of its headlines.
  const winLights = SRC.match(/winOn=\(L<0\.6 && \(\(\(Math\.floor\(now\/9000\)/g) || [];
  assert.ok(winLights.length >= 2, 'window lights must still use the raw 9000 cadence');
  assert.match(SRC, /NEON\[\(Math\.floor\(now\/9000\)\)%NEON\.length\]/, 'the neon cycle is not text');
  // …and there should still be a healthy number of untouched 9000 sites overall.
  const raw = (SRC.match(/Math\.floor\(now\/9000\)/g) || []).length;
  assert.ok(raw >= 8, 'expected the non-text 9000 sites to remain raw, found ' + raw);
});

test('the ticker copy rotates slower than a person reads a headline', () => {
  const pace = parseFloat(/var TEXT_PACE=([\d.]+);/.exec(SRC)[1]);
  assert.ok(9000 / pace >= 14000, 'ticker copy should hold at least 14 s (was 9 s)');
  assert.ok(2600 / pace >= 4000, 'regime slogans should hold at least 4 s (was 2.6 s)');
});
