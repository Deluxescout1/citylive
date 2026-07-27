// A SPRITE'S IDENTITY MUST NEVER BE DERIVED FROM ITS POSITION.
//
// Nick, 2026-07-27: "the motorcycle person changes color whenever he drives by". The rider's clothing
// and skin were `PEDC[(worldX*7+...)%len]` — indexed by the bike's CURRENT world x — so every frame he
// moved, both re-rolled out of the palette. He was not one person crossing the city; he was a
// different person in every single frame.
//
// The same mistake was in two other places (the horse scout's face, keyed to the horse's moving x;
// the abductee's face, keyed to screen x while being lifted up a beam). Three instances of one idea,
// which is what makes it worth a test rather than three fixes.
//
// The test drives each sprite ACROSS THE SCREEN and asserts the colour rects it emits are identical
// at every position. It deliberately does not care WHICH colours — only that they do not change.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');

function loadEngine() {
  const sandbox = {
    Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    isNaN, isFinite, parseInt, parseFloat, console,
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {}
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), context, { filename: 'city.js' });
  context.NOFETCH = true;
  context.setup('neon', { cw: 853, ch: 480, woff: 0, ww: 853, pxk: 3, zoom: 1, quality: 'spectacle' });
  return context;
}

// records every distinct fillStyle used, in order, so we can compare one traverse position to another
function paletteRecorder() {
  const styles = [];
  let cur = null;
  const noop = () => {};
  const g = new Proxy({}, {
    get(_o, k) {
      if (k === 'canvas') return { width: 853, height: 480 };
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
      if (k === 'measureText') return () => ({ width: 4 });
      if (k === 'fillRect') return () => { styles.push(cur); };
      return noop;
    },
    set(_o, k, v) { if (k === 'fillStyle') cur = v; return true; }
  });
  return { g, styles };
}

test('a motorcycle rider keeps the same colours all the way across the screen', () => {
  const ctx = loadEngine();
  const now = 1783972450746;
  const seen = [];
  for (const worldX of [40, 120, 260, 400, 540, 680, 810]) {
    const { g, styles } = paletteRecorder();
    ctx.drawBike(g, worldX, 1, 1, now, 'moto', 12345);
    seen.push(styles.join('|'));
  }
  const distinct = new Set(seen);
  assert.strictEqual(distinct.size, 1,
    'the rider changed appearance while riding — identity must come from `rid`, not from worldX.\n' +
    Array.from(distinct).slice(0, 3).join('\n'));
});

test('a different journey gets a different rider', () => {
  const ctx = loadEngine();
  const now = 1783972450746;
  const looks = new Set();
  for (const rid of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const { g, styles } = paletteRecorder();
    ctx.drawBike(g, 300, 1, 1, now, 'moto', rid);
    looks.add(styles.join('|'));
  }
  assert.ok(looks.size > 1, 'every journey produced an identical rider — rid is not reaching the palette');
});

test('the horse scout keeps his face while he rides', () => {
  const ctx = loadEngine();
  const now = 1783972450746;
  const seen = new Set();
  for (const wx of [50, 180, 330, 470, 620, 790]) {
    const { g, styles } = paletteRecorder();
    ctx.drawHorse(g, wx, ctx.HORIZON + 2, 1, 1, now, 0, 3);
    seen.add(styles.join('|'));
  }
  assert.strictEqual(seen.size, 1, 'the mounted scout changed appearance as he rode');
});

test('an abductee keeps his face on the way up the beam', () => {
  const ctx = loadEngine();
  const seen = new Set();
  for (const x of [100, 240, 380, 520, 660]) {
    const { g, styles } = paletteRecorder();
    ctx.drawAbductee(g, x, 120, 1, false, 1);
    seen.add(styles.join('|'));
  }
  assert.strictEqual(seen.size, 1, 'the abductee changed appearance while being lifted');
});

// The guard that stops this coming back a fourth time: no character palette may be indexed by a
// variable whose name says "position". Cheap, textual, and it fails loudly on the exact pattern.
test('no character palette is indexed by a position variable', () => {
  // strip line comments first — the fixes are documented in comments that quote the OLD broken code,
  // and a guard that trips on its own explanation is a guard nobody keeps.
  // ⚠⚠ NORMALISE CRLF BEFORE STRIPPING, or this passes on Linux and fails on Windows CI — which is
  // exactly what it did, breaking the v3.0.1 build. `.` in a JS regex matches any character EXCEPT a
  // line terminator, and \r IS a line terminator. So on a CRLF checkout every line ends "...\r",
  // `//.*$` can never consume that \r, the match fails, and NOTHING is stripped. The guard then
  // tripped on its own documentation. A silent no-op is the worst failure mode for a sanitiser:
  // it looks like it ran.
  const source = fs.readFileSync(ENGINE, 'utf8')
    .replace(/\r/g, '')
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  const offenders = [];
  const re = /(PEDC|SKINC|HAIRC|HORSEC)\s*\[[^\]]*\b(worldX|wx|sx|px|screenX)\b[^\]]*\]/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const line = source.slice(0, m.index).split('\n').length;
    offenders.push(`line ${line}: ${m[0]}`);
  }
  assert.deepStrictEqual(offenders, [],
    'a character palette is indexed by a position variable — the sprite will change identity as it moves');
});
