'use strict';
// Every shell paints the city with TWO canvases: a slow "bg" backdrop and a fast foreground.
// The foreground must be "live" — the exact complement of "bg". "fg" is the older single-canvas
// foreground and deliberately skips the buildings block (city.js: `if(pass!=="fg")`), so a shell
// left on "bg"+"fg" renders a city with no buildings and no road.
//
// That shipped: the two-canvas perf work moved the KDE wallpaper to "live" and left the Electron
// app, the web build and the phone build on "fg". pass-split.test.js proves bg ∪ live == the whole
// scene, but nothing proved the shells actually ASK for those passes. This does.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SHELLS = [
  { name: 'desktop app', file: 'desktop/renderer/index.html' },
  { name: 'web build', file: 'web/index.html' },
  { name: 'phone build', file: 'phone/index.html' },
  { name: 'KDE wallpaper', file: 'org.citylive.wallpaper/contents/ui/main.qml' },
];

// draw(g,'live') / draw(g,"live") / City.draw(getContext("2d"), "bg")
// The argument list can itself contain parens and quoted strings, so match the pass as the
// LAST quoted token before the closing paren of a draw( call rather than trying to skip args.
function drawPasses(src) {
  const found = [];
  const re = /\bdraw\s*\(([\s\S]*?)\)\s*;/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const args = m[1];
    const quoted = args.match(/['"]([a-z]+)['"]\s*$/);   // trailing pass argument
    if (quoted) found.push(quoted[1]);
  }
  return found;
}

for (const shell of SHELLS) {
  test(`${shell.name} paints a complete city (bg + live, never fg)`, () => {
    const src = fs.readFileSync(path.join(ROOT, shell.file), 'utf8');
    const passes = drawPasses(src);
    assert.ok(passes.length > 0, `${shell.file}: found no draw(pass) calls — did the render loop move?`);
    assert.ok(passes.includes('bg'), `${shell.file}: never draws the "bg" backdrop pass`);
    assert.ok(passes.includes('live'),
      `${shell.file}: draws [${passes.join(', ')}] — the foreground pass must be "live"; ` +
      '"fg" skips the buildings block and renders a city with no buildings and no road');
    assert.ok(!passes.includes('fg'),
      `${shell.file}: still draws the "fg" pass, which omits buildings — use "live"`);
  });
}
