'use strict';

// WEEKLY SIDE-SYSTEM — citylive-weekly.service (chronicle + timelapse of the life that just ended).
//
// ⚠ HOW THIS BROKE: the unit's ExecStart and timelapse.sh both scraped the engine source with
// /GROW_EPOCH=(\d+)/ and /GROW_CYCLE=(\d+)/. GROW_EPOCH is a literal; GROW_CYCLE stopped being one
// when config cycles arrived (`var GROW_CYCLE=cycleMs(CFG.cycle)`). The second scrape matched
// nothing → null[1] → TypeError → the service failed on every run, chronicle.json went stale for
// ~12 weeks, and the only timelapse left was life-0's. The fix is tools/lifeindex.js, which loads
// the engine in a vm and asks IT for the numbers.
//
// This test guards exactly one thing: THE CLOCK NUMBERS MUST COME FROM THE ENGINE, NEVER FROM A
// SCRAPE OF ITS SOURCE. Plus a direct check of lifeindex.js itself.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');

test('lifeindex.js derives its numbers from the engine, and they are integers', () => {
  const epochCycle = execFileSync('node', [path.join(ROOT, 'tools', 'lifeindex.js'), 'epoch', 'cycle'], { encoding: 'utf8' })
    .trim().split(/\s+/).map(Number);
  assert.ok(epochCycle.length === 2 && epochCycle.every(Number.isSafeInteger), 'epoch cycle: ' + epochCycle);
  assert.ok(epochCycle[1] > 0, 'GROW_CYCLE must be positive, got ' + epochCycle[1]);
  const life = Number(execFileSync('node', [path.join(ROOT, 'tools', 'lifeindex.js'), 'life'], { encoding: 'utf8' }).trim());
  const lifePrev = Number(execFileSync('node', [path.join(ROOT, 'tools', 'lifeindex.js'), 'life-prev'], { encoding: 'utf8' }).trim());
  assert.ok(Number.isSafeInteger(life) && Number.isSafeInteger(lifePrev), 'life indexes must be integers');
  assert.strictEqual(lifePrev, life - 1, 'life-prev is one behind life');
  // and the engine's own math agrees with itself
  assert.strictEqual(Math.floor((Date.now() - epochCycle[0]) / epochCycle[1]), life,
    'lifeIndexOf(now) must equal floor((now-EPOCH)/CYCLE) — if this drifts, the life cycle is misaligned with its own epoch');
});

test('timelapse.sh reads the clock from lifeindex.js, never a regex scrape', () => {
  const sh = fs.readFileSync(path.join(ROOT, 'tools', 'timelapse.sh'), 'utf8');
  assert.ok(sh.includes('lifeindex.js'), 'timelapse.sh must source its clock from tools/lifeindex.js');
  assert.ok(!/GROW_CYCLE=\\\(d\+|\.exec\(c\)/.test(sh) && !/GROW_EPOCH=\(\\d\+\)\/\.exec/.test(sh),
    'timelapse.sh still scrapes the engine source — the exact bug that killed the weekly for 12 weeks');
});

test('the installed weekly unit delegates the life index (no inline node -e)', () => {
  const unit = path.join(os.homedir(), '.config', 'systemd', 'user', 'citylive-weekly.service');
  if (!fs.existsSync(unit)) return;   // unit is machine-local; the repo copy of the logic is timelapse.sh
  const s = fs.readFileSync(unit, 'utf8');
  assert.ok(/lifeindex\.js/.test(s), 'the weekly unit must use tools/lifeindex.js');
  const exec = s.split('\n').find((l) => l.startsWith('ExecStart=')) || '';
  assert.ok(!/node -e/.test(exec), 'no inline node -e in ExecStart — systemd strips the escaped quotes and bash chokes on the fragments');
  assert.ok(!/exec\(c\)|GROW_EPOCH=/.test(exec), 'the weekly unit still carries the scrape that broke chronicle.json for 12 weeks');
});