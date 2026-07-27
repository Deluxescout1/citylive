// NO TWO TOP-LEVEL FUNCTIONS IN THE ENGINE MAY SHARE A NAME.
//
// A later `function foo(){}` silently replaces an earlier one. No error, no warning — the first
// definition simply ceases to exist, and every call written against ITS signature starts feeding
// arguments into a different function's parameters. The failure is invisible at the call site and
// invisible in review, because both definitions look perfectly correct where they are written.
//
// This shipped THREE TIMES in one 22,000-line file:
//   · drawVolcano   — the disaster renderer was shadowed by the BIOME renderer, whose first act is
//                     to check `curBiome.volcanic` and return. On every land that was not already a
//                     volcano, the volcano disaster drew literally nothing.
//   · drawTank      — the parade tank was shadowed by the war tank, so a y coordinate arrived as
//                     `dir` and +/-1 arrived as `L`: the tank picked its day/night palette from
//                     which way it was driving, and its animation clock got a 0..1 light value.
//   · meteorShowerActive — two byte-identical copies kept "in lockstep" by hand. Harmless the day it
//                     was written, and a silent trap the day somebody edited only the first one.
//
// The engine is mirrored across four copies, so this checks the canonical one and trusts
// check-engine-sync for the rest.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ENGINE = path.join(__dirname, '..', 'renderer', 'city.js');

test('no top-level function name is declared twice', () => {
  // ⚠ normalise CRLF: the Windows CI checkout uses it, and regex `.` does not match \r, which
  // silently broke the sibling guard in sprite-identity.test.js and failed the v3.0.1 build.
  const src = fs.readFileSync(ENGINE, 'utf8').replace(/\r/g, '');
  const seen = new Map();
  const dupes = [];
  const re = /^function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    const line = src.slice(0, m.index).split('\n').length;
    if (seen.has(name)) dupes.push(`${name}: first at line ${seen.get(name)}, again at line ${line}`);
    else seen.set(name, line);
  }
  assert.deepStrictEqual(dupes, [],
    'a later function declaration silently replaces the earlier one, so every call written against ' +
    'the first signature now feeds its arguments into the second function:\n  ' + dupes.join('\n  '));
});

test('the engine really does expose one drawVolcano and one drawTank, with the expected shapes', () => {
  // the source check above is textual; this one asks the LOADED engine, which is how the original
  // drawVolcano bug was actually confirmed (the surviving body had arity 4, the biome signature).
  const vm = require('vm');
  const ctx = { console, Date, Math, JSON, setTimeout, clearTimeout,
    XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), ctx);
  for (const name of ['drawVolcano', 'drawVolcanoDisaster', 'drawTank', 'drawParadeTank']) {
    assert.strictEqual(typeof ctx[name], 'function', name + ' is missing from the engine');
  }
  // the biome volcano takes (g,L,now,nd); the disaster takes (g,cd,L,now)
  assert.strictEqual(ctx.drawVolcano.length, 4);
  assert.strictEqual(ctx.drawVolcanoDisaster.length, 4);
  // the war tank takes (g,cx,dir,L,now,firing); the parade tank takes (g,x,y,dir,L)
  assert.strictEqual(ctx.drawTank.length, 6);
  assert.strictEqual(ctx.drawParadeTank.length, 5);
});
