'use strict';

// ⏱️🚨 "EVERY ENDING WHOSE CONSTANTS ARE AUTHORED IN REAL SECONDS." — city.js, ~L51541.
//
// `apocMs` runs 0 → APOC_BAND*GROW_CYCLE ≈ 12,096,000 (201.6 min). An ending whose phase
// boundaries are authored in real seconds (`NUKE_WIPE_MS` 6000, `FOX_WIPE_MS` 9000 …) is
// therefore OVER in its first few seconds, and the remaining three-plus hours is one frozen
// frame. `apocSpanMs()` fixes that by stretching the ending's own authored span across the
// arc — but only for the keys listed in its switch, because it returns 0 otherwise and
// `draw()` only remaps when the span is non-zero.
//
// 🚨 THE FIX HAS NOW BEEN A HALF-FIX TWICE. The pass fixed eight, `flood` was found later as a
// ninth ("a fix applied only where the bug was REPORTED is half a fix"), and the audit of
// 2026-08-13 found SIX MORE — massacre · logout · wilderness · godwars · banwave · ninetails,
// every one of them over inside the first 1% of the arc. They were missed because they are not
// in `DEATHS`: five are the OSRS land-triggered pool and the sixth is the fox, both deliberately
// kept out of that array, so an audit that walked `DEATHS` walked straight past all six.
//
// ⚠ SO THIS TEST DERIVES THE PREDICATE, IT DOES NOT HAND-LIST THE ENDINGS. Absence is not a
// decision: a test naming the 43 keys it knows about is exactly as blind to the 44th as the
// three audits that missed these six. It reads the pools out of the source, resolves each key
// to its renderer, and FOLLOWS THE HELPERS — four of the six were caught not in the renderer
// body but one call down, in `massFrontR`/`logoutFrontR`/`wildFrontR`/`banFrontR`. A version of
// this test that only read renderer bodies would have passed on four of the six real bugs.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');
const SRC = fs.readFileSync(ENGINE, 'utf8');
const LINES = SRC.split('\n');

// 🛠️ COMMENTS ARE NOT CODE, AND IN THIS FILE THAT IS NOT A TECHNICALITY. Its comments quote the
// identifiers they discuss ("Timeline on the real-time `apocMs` clock…", "it reads `apocMs`, not a
// name"), so a raw grep for `apocMs` reported `bh`, `thetitans` and `ragnarok` as offenders on the
// strength of three PROSE mentions. A probe whose pass and whose blind look the same is worse than
// no probe: strip comments and string literals before asking what the code reads.
function codeOnly(s) {
  let out = '', i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '/') { while (i < n && s[i] !== '\n') i++; continue; }
    if (c === '/' && s[i + 1] === '*') { i += 2; while (i < n && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < n && s[i] !== q) { if (s[i] === '\\') i++; i++; }
      i++; out += '""'; continue;
    }
    out += c; i++;
  }
  return out;
}

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

// ---- every death key, read out of the pools rather than named here ------------------------
function deathKeys() {
  const keys = new Set();
  for (const m of SRC.matchAll(/^var\s+(?:RS_)?DEATHS(?:_[A-Z0-9]+)?\s*=\s*\[([\s\S]*?)\];/gm))
    for (const k of m[1].matchAll(/"([a-z0-9_]+)"/g)) keys.add(k[1]);
  return [...keys];
}

// ---- top-level bodies, bounded by the NEXT top-level declaration --------------------------
// 🚨 Bounded by the next `\nfunction `, never by an end-marker search: a START→END index edit
// once deleted 40 functions in this file because the end marker's first hit was 1,400 lines
// downstream, and `node --check` passed.
const DECL = [];
LINES.forEach((l, i) => {
  if (/^function\s+[A-Za-z_$][\w$]*\s*\(/.test(l) || /^APOC_X(_BACK|_FRONT)?\.[a-z0-9_]+\s*=\s*function/.test(l)) DECL.push(i);
});
function bodyOf(name) {
  const isTable = name.startsWith('APOC_X.');
  const re = isTable
    ? new RegExp(`^APOC_X(_BACK|_FRONT)?\\.${name.slice(7)}\\s*=`)
    : new RegExp(`^function\\s+${name}\\s*\\(`);
  const start = DECL.find(i => re.test(LINES[i]));
  if (start === undefined) return null;
  const next = DECL.find(i => i > start);
  return LINES.slice(start, next === undefined ? LINES.length : next).join('\n');
}

// ---- key -> renderer(s) -------------------------------------------------------------------
function renderersFor(key) {
  const out = [];
  const hard = SRC.match(new RegExp(`if\\(curDeath===\\s*"${key}"\\)\\{\\s*((?:\\w+\\(g,ap,L,now\\);\\s*)+)`));
  if (hard) for (const m of hard[1].matchAll(/(\w+)\(g,ap,L,now\)/g)) out.push(m[1]);
  if (new RegExp(`\\bAPOC_X(?:_BACK|_FRONT)?\\s*\\.\\s*${key}\\s*=\\s*function`).test(SRC)) out.push(`APOC_X.${key}`);
  return out;
}

// 🔑 THE SHARED DISPATCHERS ARE NOT PART OF ANY ONE ENDING'S TIMELINE. `apocHit`/`apocStruck` and
// friends hold a branch for EVERY ending, so a renderer that merely asks the generic question "has
// the city been hit here?" reaches the nuke's and the kaiju's real-millisecond constants through
// them. Walking into these reported `glassrain`, `warmachine` and `ragnarok` as offenders on the
// strength of other endings' code. Excluding them is what makes the walk depth-stable: with these
// cut, depth 3, 4 and 6 all return exactly the same answer, so the result is not tuned to a depth.
const SHARED_DISPATCH = new Set(['apocHit', 'apocStruck', 'apocFull', 'apocApproachF', 'apocVictimDown', 'resistOn']);

// ---- follow the helpers: the union of a renderer's body and the bodies it calls ------------
function reachableSource(names, depth) {
  const seen = new Set(), chunks = [];
  const walk = (name, d) => {
    if (seen.has(name) || d > depth || SHARED_DISPATCH.has(name)) return;
    seen.add(name);
    const raw = bodyOf(name);
    if (!raw) return;
    // 🚨 STRIP BEFORE WALKING, not just before counting. This file's comments discuss other
    // functions by name and with their parens — "`meteorImpacts()` LOOKED LIKE THE OBVIOUS REUSE
    // AND IS NOT", "it reads `apocMs`, not a name". Walking the raw text followed those PROSE
    // mentions as if they were call sites, which dragged unrelated renderers into gammaray's
    // reachable set and reported it as an offender with 15 reads it does not perform.
    const b = codeOnly(raw);
    chunks.push(b);
    for (const m of b.matchAll(/\b([a-zA-Z_$][\w$]*)\s*\(/g)) {
      const callee = m[1];
      if (!seen.has(callee) && bodyOf(callee)) walk(callee, d + 1);
    }
  };
  for (const n of names) walk(n, 0);
  return chunks.join('\n');
}

test('no ending is authored in real seconds without being stretched across the arc', () => {
  const c = loadEngine();
  const keys = deathKeys();
  assert.ok(keys.length >= 43, `expected the full death pools, derived ${keys.length}`);

  const offenders = [];
  for (const key of keys) {
    c.curDeath = key;
    const span = c.apocSpanMs();
    if (span > 0) continue;                       // remapped: its own timeline is stretched across the arc

    const names = renderersFor(key);
    assert.ok(names.length, `${key} has no reachable renderer at all`);
    // ⚠ THE DEPTH WAS MEASURED AGAINST THE PRE-FIX ENGINE, NOT GUESSED. At depth 1 this predicate
    // named only three of the six real bugs, and at depth 2 only five: `wilderness` reaches the
    // clock as drawApocWild → wildTaken → wildFrontR → apocFrontR, and none of the middle hops
    // contains a literal `apocMs`. Re-run with the six cases stripped out of apocSpanMs() and this
    // must name all six; that is the check that this test discriminates at all.
    const src = codeOnly(reachableSource(names, 4));
    const reads = (src.match(/\bapocMs\b/g) || []).length;
    if (reads) offenders.push(`${key} (renderer ${names.join('+')} reads apocMs ${reads}×, apocSpanMs()=0)`);
  }

  assert.deepStrictEqual(offenders, [],
    'these endings read real-millisecond `apocMs` but are not in apocSpanMs(), so their whole ' +
    'event happens in the first seconds of a 201-minute arc and the rest is a frozen frame:\n  ' +
    offenders.join('\n  '));
});

test('the six found by the 2026-08-13 audit are stretched, and land where their own constants say', () => {
  const c = loadEngine();
  // ⚠ Asserts the SPAN IS DERIVED FROM THE ENDING'S OWN CONSTANTS, not that it equals a number
  // typed here — "never a fourth number invented", the rule apocSpanMs() was written under. If an
  // ending re-times itself later, this still holds; a hard-coded literal would silently disagree.
  const expect = {
    ninetails:  ['FOX_ARRIVE_MS', 'FOX_WIPE_MS'],
    massacre:   ['MASS_PARTY_MS', 'MASS_WIPE_MS'],
    logout:     ['LOGOUT_WAIT_MS', 'LOGOUT_WIPE_MS'],
    wilderness: ['WILD_WAIT_MS', 'WILD_WIPE_MS'],
    godwars:    ['GW_WAIT_MS', 'GW_CLOSE_MS'],
    banwave:    ['BAN_WAIT_MS', 'BAN_WIPE_MS'],
  };
  for (const key of Object.keys(expect)) {
    c.curDeath = key;
    const [a, b] = expect[key];
    assert.strictEqual(c.apocSpanMs(), c[a] + c[b] + 5000, `${key} span must be ${a}+${b}+tail`);
  }
});

test('a stretched ending still has something happening in the middle of its arc', () => {
  // The measurable form of the bug, stated the way the file states it: rendered at ap 0.05 and
  // ap 0.90 the frames came back identical. `apocMs` is the input every one of these endings
  // reads, so if it is remapped the two are far apart; if it is not, both saturate to the same
  // finished state and the ending is a still frame for three hours.
  const c = loadEngine();
  const arc = c.APOC_BAND * c.GROW_CYCLE;
  for (const key of ['ninetails', 'massacre', 'logout', 'wilderness', 'godwars', 'banwave']) {
    c.curDeath = key;
    const span = c.apocSpanMs();
    assert.ok(span > 0, `${key} must be remapped`);
    const at = ap => Math.round(ap * span);
    // the ending must not be finished by 5% of the arc…
    assert.ok(at(0.05) < span * 0.5, `${key} is more than half over at 5% of the arc`);
    // …and the middle of the arc must be a genuinely different moment from the start.
    assert.ok(at(0.55) - at(0.05) > span * 0.4, `${key} barely advances across the middle of its arc`);
    // and the stretch must be real: the authored span is a tiny fraction of the raw arc.
    assert.ok(span < arc * 0.05, `${key} span ${span} is not a real-seconds timeline`);
  }
});
