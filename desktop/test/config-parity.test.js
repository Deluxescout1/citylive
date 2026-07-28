// EVERY SETTING MUST SURVIVE THE TRIP TO THE KDE WALLPAPER.
//
// The engine reads personal settings from a global `CITYLIVE_CFG` into `var CFG` at the very top of
// city.js, and a pile of module-level `var`s are initialised from it right there:
//     var CFG_EGG       = ... CFG.egg ...
//     var CFG_DEBUGSTAMP = !!CFG.debugStamp;
//     var SCORE_ON      = (CFG.scores !== false);
//
// That works on desktop, web and phone, which define `CITYLIVE_CFG` before the engine loads
// (desktop/renderer/index.html, web/config.js, phone/config.js).
//
// ⚠ THE PLASMA WALLPAPER DEFINES IT NOWHERE. QML has no way to inject a global ahead of a JS import,
// so main.qml delivers settings by CALLING `City.applyConfig(Local.CONFIG)` after the engine has
// already loaded. By then every one of those `var`s has been evaluated against an empty `{}`.
//
// So a setting handled ONLY at load time is silently dead on KDE — which is the surface that is
// actually somebody's desktop. Three had rotted this way before this test existed:
//   · debugStamp — the diagnostic overlay built specifically to catch the floating-blue-boxes bug.
//                  Nick was told to switch it on and screenshot. It could not have fired, and the
//                  bug stayed "blocked on the user" for it.
//   · egg        — `egg:"leaf"` never pinned the Hidden Village on his machine; he was still on the
//                  1-in-12 roll and had no way to tell the difference from a working pin.
//   · scores     — the live-sports opt-out could not be opted out of.
//
// The failure is invisible in review: the code reads correctly, the key is spelled right, the JSON
// is valid, and nothing errors. It just quietly does nothing, on one surface, forever.
//
// THE RULE: if the engine reads `CFG.foo` anywhere, `applyConfig` must also handle `cfg.foo`.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');

// Keys that are deliberately load-time-only. Empty on purpose — add one ONLY with a reason, and
// only if it genuinely cannot change after startup on any surface.
const LOAD_TIME_ONLY = new Set([]);

// Strip comments and string literals before scanning for `CFG.x`.
//
// Necessary, not defensive: this engine is ~24,000 lines of heavily commented code and the comments
// discuss the config keys by name. The first run of this test failed on `CFG.foo` — from the comment
// in applyConfig explaining this very rule. A naive scan reads prose as code.
//
// Done with a scanner rather than a regex because the cheap `s.replace(/\/\/.*$/gm,'')` truncates any
// line holding a URL ("https://…"), which would silently drop real code to its right — the same shape
// of silent-nothing failure this whole file exists to prevent.
function stripNonCode(s) {
  let out = '', i = 0;
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'") {
      i++;
      while (i < s.length && s[i] !== c) { if (s[i] === '\\') i++; i++; }
      i++; out += '""'; continue;
    }
    out += c; i++;
  }
  return out;
}

function applyConfigBody(src) {
  const start = src.indexOf('function applyConfig(');
  assert.notStrictEqual(start, -1, 'applyConfig() not found in the engine');
  // brace-match to the end of the function rather than guessing at a line count
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error('applyConfig() is unbalanced — could not find its closing brace');
}

test('every CFG.* the engine reads is also applied by applyConfig()', () => {
  // ⚠ normalise CRLF first. The Windows CI checkout uses it and regex `.` does not match \r — that
  // exact oversight silently disabled a sibling guard and shipped the broken v3.0.1 release.
  const src = stripNonCode(fs.readFileSync(ENGINE, 'utf8').replace(/\r/g, ''));

  const read = new Set();
  let m;
  const reRead = /\bCFG\.([A-Za-z_$][A-Za-z0-9_$]*)/g;
  while ((m = reRead.exec(src)) !== null) read.add(m[1]);
  assert.ok(read.size > 5, `expected to find CFG.* reads, found ${read.size} — did the config block move?`);

  const body = applyConfigBody(src);
  const applied = new Set();
  const reApp = /\bcfg\.([A-Za-z_$][A-Za-z0-9_$]*)/g;
  while ((m = reApp.exec(body)) !== null) applied.add(m[1]);

  const orphans = [...read].filter((k) => !applied.has(k) && !LOAD_TIME_ONLY.has(k)).sort();
  assert.deepStrictEqual(
    orphans, [],
    'These settings are read from CFG at load time but never handled by applyConfig(), so they are ' +
    'DEAD ON THE KDE WALLPAPER (it has no CITYLIVE_CFG global and can only reach the engine through ' +
    'applyConfig): ' + orphans.join(', ') + '\n' +
    'Add `if(cfg.<key>!==undefined) ...` to applyConfig, assigning the same module var the load-time ' +
    'line does.'
  );
});

test('the KDE wallpaper really does lack a CITYLIVE_CFG global', () => {
  // The premise of the test above. If somebody ever gives the Plasma plugin a way to define the
  // global, this test fails and the parity rule can be revisited rather than cargo-culted.
  const dir = path.join(__dirname, '..', '..', 'org.citylive.wallpaper');
  const hits = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(qml|js|json)$/.test(e.name)) continue;
      if (p.endsWith(path.join('js', 'city.js'))) continue;      // the engine READS it; that's the point
      if (fs.readFileSync(p, 'utf8').includes('CITYLIVE_CFG')) hits.push(path.relative(dir, p));
    }
  })(dir);
  assert.deepStrictEqual(hits, [], 'CITYLIVE_CFG is now defined in the Plasma plugin (' + hits.join(', ') +
    '). Load-time config may now work on KDE — re-check whether the applyConfig parity rule still applies.');
});

test('applyConfig actually flips the three that were dead', () => {
  // End-to-end, through the real engine: the textual guard above cannot tell whether the assignment
  // targets the right variable. This drives the exact call main.qml makes.
  const vm = require('vm');
  const ctx = {
    console, Date, Math, JSON, setTimeout, clearTimeout,
    XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), ctx);

  // defaults, as a KDE session starts: no CITYLIVE_CFG, so CFG === {}
  assert.strictEqual(ctx.CFG_DEBUGSTAMP, false, 'debugStamp should default off');
  assert.strictEqual(ctx.FORCEEGG, null, 'no egg should be pinned by default');
  assert.strictEqual(ctx.SCORE_ON, true, 'live scores default on');

  ctx.applyConfig({ debugStamp: true, egg: 'leaf', scores: false });
  assert.strictEqual(ctx.CFG_DEBUGSTAMP, true, 'applyConfig({debugStamp:true}) must arm the overlay');
  assert.strictEqual(ctx.FORCEEGG, 'leaf', 'applyConfig({egg:"leaf"}) must pin the Hidden Village');
  assert.strictEqual(ctx.SCORE_ON, false, 'applyConfig({scores:false}) must disable live scores');

  // and back off again — an omitted key must not clobber, but an explicit false must
  ctx.applyConfig({ birthdays: [] });
  assert.strictEqual(ctx.CFG_DEBUGSTAMP, true, 'an unrelated applyConfig call must not reset debugStamp');
  ctx.applyConfig({ debugStamp: false, egg: null });
  assert.strictEqual(ctx.CFG_DEBUGSTAMP, false, 'debugStamp:false must disarm');
  assert.strictEqual(ctx.FORCEEGG, null, 'egg:null must unpin');
});
