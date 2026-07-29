// A FUNCTION SPLIT IN TWO MUST NOT LEAVE A VARIABLE BEHIND.
//
// When one big renderer is split into a static half and an animated half — the reason being that the
// static half has no business running at the live frame rate — every local the animated half still
// reads has to be re-declared in it. Miss one and you get a ReferenceError at runtime, from inside a
// draw pass, and JavaScript does not politely skip the rest: THE WHOLE PASS ABORTS.
//
// This is not hypothetical. Splitting `drawVolcano` into `drawVolcanoSurface` and `drawVolcanoLive`
// left `crD` (the crater's depth, read by the crater glow) behind in the surface half. The result at
// 23:00 was a frame containing the mountain and the palm trees and NOTHING ELSE — no city, no road,
// no sea, no panel — because one missing variable in one overlay threw before the rest of the live
// pass could draw. A missing `var` silently deleted the entire city.
//
// ⚠ AND THE DAYTIME RENDER PASSED CLEANLY, WHICH IS WHY IT NEARLY SHIPPED. The crater glow is gated on
// `glow > 0.06`, and by day with the volcano quiet that expression is 0.0275 — so the broken line was
// never reached in a 13:00 render. "It renders at noon" is not evidence that it renders. Hence a static
// check, which does not care what the clock says.
//
// The engine is mirrored across four copies, so this checks the canonical one and trusts
// check-engine-sync for the rest.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');

// Functions that were split out of a larger one and therefore repeat a preamble by hand.
// Add to this list whenever another renderer is split the same way.
const SPLIT_FNS = ['drawVolcanoSurface', 'drawVolcanoLive'];

function bodyOf(src, name) {
  const start = src.indexOf('function ' + name + '(');
  assert.notStrictEqual(start, -1, `${name} not found in the engine — was it renamed?`);
  let depth = 0, i = start;
  // walk to the matching close brace. String/comment contents can hold braces, but the engine's
  // style keeps them balanced within a line, and an unbalanced walk would fail loudly here rather
  // than silently pass, which is the direction we want a guard to fail in.
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
}

function declaredIn(body) {
  const names = new Set(['g', 'L', 'now', 'nd']);          // the shared draw signature
  // `var a=1, b=2, c` — take every declarator, not just the first. Only catching the first name is
  // exactly the mistake that made an earlier ad-hoc version of this check report four false
  // positives and hide the one real miss among them.
  for (const m of body.matchAll(/\bvar\s+([^;\n]+)/g)) {
    for (const part of m[1].split(',')) {
      const n = /^\s*([A-Za-z_$][\w$]*)/.exec(part);
      if (n) names.add(n[1]);
    }
  }
  for (const m of body.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  return names;
}

test('a split renderer declares every local it reads', () => {
  const src = fs.readFileSync(ENGINE, 'utf8').replace(/\r/g, '');
  // The union of everything declared across the halves is the set of names the ORIGINAL function had.
  // Any of those that a half reads without declaring is a variable left behind by the split.
  const bodies = SPLIT_FNS.map(n => ({ name: n, body: bodyOf(src, n) }));
  const all = new Set();
  for (const b of bodies) for (const n of declaredIn(b.body)) all.add(n);

  const problems = [];
  for (const b of bodies) {
    const mine = declaredIn(b.body);
    // strip comments before looking for reads: the halves quote each other's variable names heavily
    // in their own documentation, and a name inside a `//` line is not a read.
    const code = b.body.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
    for (const n of all) {
      if (mine.has(n)) continue;
      if (new RegExp('\\b' + n.replace(/\$/g, '\\$') + '\\b').test(code)) {
        problems.push(`${b.name} reads \`${n}\` but never declares it`);
      }
    }
  }
  assert.deepStrictEqual(problems, [],
    'a split left a variable behind — this throws mid-pass and aborts the rest of the frame:\n  ' +
    problems.join('\n  '));
});
