// Every module the main process requires must be in package.json's `files` allowlist.
//
// 🚨 WHY THIS TEST EXISTS. `build.files` is an ALLOWLIST, not an exclusion list: a new top-level
// module that main.js requires is silently left out of the packaged app unless it is named here. The
// dev build (`npm start`, and every test in this directory) runs from the source tree, where the file
// is obviously present — so the failure appears for the first time in the INSTALLER, on a user's
// machine, as an app that will not start at all. Nothing in this repo would have caught it.
//
// Adding the performance guard added four new top-level modules at once, which is exactly the shape
// of change that trips this.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// Walk require('./x') edges from main.js, so this keeps working as the module graph grows.
function localRequires(entry, seen) {
  seen = seen || new Set();
  const abs = path.join(ROOT, entry);
  if (seen.has(entry) || !fs.existsSync(abs)) return seen;
  seen.add(entry);
  const src = fs.readFileSync(abs, 'utf8');
  const re = /require\(\s*'\.\/([A-Za-z0-9_\-./]+)'\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    let f = m[1];
    if (!/\.js$/.test(f)) f += '.js';
    localRequires(f, seen);
  }
  return seen;
}

test('every locally-required module is shipped in the packaged app', () => {
  const needed = localRequires('main.js');
  const files = pkg.build.files;
  const missing = [];
  for (const f of needed) {
    const covered = files.some((pattern) => {
      if (pattern === f) return true;
      // Only the glob shapes this project actually uses — a real matcher would hide mistakes.
      if (pattern.endsWith('/**/*')) return f.startsWith(pattern.slice(0, -5) + '/');
      return false;
    });
    if (!covered) missing.push(f);
  }
  assert.deepStrictEqual(missing, [],
    'these modules are required by main.js but would NOT be in the installer: ' + missing.join(', '));
});

test('the entry point named in package.json exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, pkg.main)), pkg.main + ' is missing');
});
