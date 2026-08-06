// The pace of street dialogue — pinned because it is a JUDGEMENT, not an implementation detail.
//
// 🚨 Nick, twice: "the text and the Dialogue is moving WAAAAAAAY too fast… it is so distracting and
// you can't even read it", then "regardless of the map speed Dialogue should be much slower and not
// as distracting." A wallpaper is read out of the corner of the eye by someone doing something else.
// "Long enough to read if you are staring at it" is the wrong standard and it is what the old floor
// of 2.6 s per line assumed.
//
// ⚠⚠ THE INVARIANT THAT IS EASY TO BREAK: a four-beat script must FIT INSIDE its scene cycle. The
// beat search walks accumulated durations and gives up if `scenePos` lands past the end — so a script
// longer than its cycle does not stretch, it silently loses its closing line, and nothing anywhere
// reports that. Slowing the lines without widening the cycle would have quietly deleted the last beat
// of every long conversation, including the city's final words.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'city.js'), 'utf8');

// Pull the shipped numbers straight out of the engine so this cannot drift from what actually runs.
function readMsBody() {
  const m = /function readMs\(t\)\{\s*return ([^;]+);/.exec(SRC);
  assert.ok(m, 'readMs not found in the engine');
  return new Function('t', 'return ' + m[1] + ';');
}
function sceneCycles() {
  const m = /var sceneCycle=apocFinal\?(\d+):(\d+);/.exec(SRC);
  assert.ok(m, 'sceneCycle not found in the engine');
  return { finale: +m[1], normal: +m[2] };
}
function density() {
  const g = /var gate=apocFinal\?(\d+):(\d+);/.exec(SRC);
  const b = /var maxBub=apocFinal\?(\d+):(\d+);/.exec(SRC);
  assert.ok(g && b, 'gate/maxBub not found in the engine');
  return { gate: +g[2], maxBub: +b[2], finaleRate: 0.56 };
}

const readMs = readMsBody();
const CYC = sceneCycles();
const D = density();

test('a line stays up long enough to read at a glance', () => {
  assert.ok(readMs('OK.') >= 4000,
    'the shortest line must hold at least 4 s (was 2.6 s, which Nick could not read)');
  assert.ok(readMs('X'.repeat(60)) >= 10000, 'a long line must hold at least 10 s');
});

test('THE INVARIANT: four beats must fit inside the scene cycle, or the last line is never seen', () => {
  const longest = 4 * readMs('X'.repeat(200));
  assert.ok(longest <= CYC.normal,
    'longest 4-beat script is ' + longest + ' ms but the cycle is only ' + CYC.normal + ' ms — the closing line would be dropped');
  const finaleLongest = 4 * Math.round(readMs('X'.repeat(200)) * D.finaleRate);
  assert.ok(finaleLongest <= CYC.finale,
    "the city's FINAL WORDS would be cut: " + finaleLongest + ' ms of script in a ' + CYC.finale + ' ms cycle');
});

test('there is real silence between conversations, not just slower talking', () => {
  const longest = 4 * readMs('X'.repeat(200));
  assert.ok(CYC.normal - longest >= 8000,
    'even the longest scene must leave 8 s of quiet before the pair speaks again');
});

test('the street is not crowded with simultaneous bubbles', () => {
  assert.ok(D.maxBub <= 2, 'at most two bubbles on screen at once (was four)');
  assert.ok(D.gate >= 6, 'at most one pair in six talks per slot (was one in four)');
});
