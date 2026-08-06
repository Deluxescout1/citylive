// The performance guard's control loop — the part no coverage-arithmetic test can see.
//
// 🚨 BOTH CASES BELOW WERE REAL BUGS, and both had the same character: the guard kept reporting
// healthy state while having silently stopped doing its job. Nothing crashed, nothing logged, and
// the only symptom was the wallpaper going back to full price behind every window for the rest of
// the session. `covers()` unit tests pass either way — the arithmetic was never wrong.
//
//   1. `evaluate()` returned early when there were no windows WITHOUT rescheduling itself, so the
//      timer was never re-armed. Zero windows is not an error state, it is an ordinary moment: the
//      wallpaper-mode toggle destroys the old window before the replacement loads, an Explorer
//      restart takes the whole set, `handleWallpaperWindowLost` runs between them.
//   2. `start()` returned `true` when the guard was ALREADY RUNNING, and the caller re-armed on
//      `!started` — so the refresh path ran only when starting had failed, i.e. exactly when it
//      could not work, and never in the case it exists for.

const { test } = require('node:test');
const assert = require('node:assert');
const throttle = require('../throttle');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function fakeScreen(displays) {
  return {
    getAllDisplays: () => displays,
    getPrimaryDisplay: () => displays[0],
    dipToScreenRect: (_w, r) => r
  };
}
const ONE_DISPLAY = [{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1032 }, scaleFactor: 1 }];

// A stand-in for a BrowserWindow that records what the guard sent it.
function fakeWindow() {
  const sent = [];
  return {
    sent,
    win: { isDestroyed: () => false, webContents: { send: (ch, payload) => sent.push({ ch, payload }) } }
  };
}

test('the poll loop survives a moment with no windows', async (t) => {
  t.after(() => throttle.stop());
  let windows = [];                                   // the app is mid-toggle: no windows exist yet
  const fw = fakeWindow();

  throttle.start({
    screen: fakeScreen(ONE_DISPLAY),
    powerMonitor: null,
    occlusion: { available: () => false, coveredDisplays: () => ({}) },
    getWindows: () => windows,
    getUserQuality: () => null
  });

  // Let at least two poll intervals go by while there is nothing to evaluate. With the bug, the
  // timer is dead by now and nothing will ever re-arm it.
  await wait(3400);

  // The replacement window finishes loading.
  windows = [{ win: fw.win, displayId: 1, hwnd: null }];

  await wait(2200);
  assert.ok(fw.sent.length > 0,
    'the guard never evaluated the new window — the poll loop died during the empty period');
  assert.ok(fw.sent.some((m) => m.ch === 'citylive:throttle' && m.payload && 'suspended' in m.payload),
    'expected a suspend/resume decision for the new window');
});

test('start() distinguishes "started" from "already running", so re-arming works', () => {
  throttle.stop();
  const opts = {
    screen: fakeScreen(ONE_DISPLAY),
    powerMonitor: null,
    occlusion: { available: () => false, coveredDisplays: () => ({}) },
    getWindows: () => [],
    getUserQuality: () => null
  };
  const first = throttle.start(opts);
  const second = throttle.start(opts);
  assert.strictEqual(first, true, 'first call actually starts the guard');
  assert.strictEqual(second, 'already', 'a second call must be distinguishable from the first');
  assert.notStrictEqual(second, false, 'and must never look like a failure');
  throttle.stop();
});

test('start() refuses, rather than half-starts, when it is missing what it needs', () => {
  throttle.stop();
  assert.strictEqual(throttle.start({ screen: null, getWindows: () => [] }), false);
  assert.strictEqual(throttle.start({ screen: fakeScreen(ONE_DISPLAY) }), false);
  throttle.stop();
});

test('a window can ASK for its state — the guard decides before any renderer exists', async (t) => {
  // 🚨 THE BUG THIS PINS made the entire guard a no-op while logging that it was working. The guard
  // evaluates the moment it is armed, which is before the render page has loaded and registered its
  // listener — so the first decision, the one that says "this desktop is already covered, do not
  // start drawing", went to nobody. And having recorded it as sent, the guard never repeated it.
  // Measured: 8.69% drawing vs 8.71% "suspended". After the fix: 8.47% vs 0.53%.
  t.after(() => throttle.stop());
  throttle.stop();
  const fw = fakeWindow();
  const windows = [{ win: fw.win, displayId: 1, hwnd: null }];
  process.env.CITYLIVE_FORCE_SUSPEND = '1';
  throttle.start({
    screen: fakeScreen(ONE_DISPLAY),
    powerMonitor: null,
    occlusion: { available: () => false, coveredDisplays: () => ({}) },
    getWindows: () => windows,
    getUserQuality: () => null
  });
  await wait(600);
  const s = throttle.stateForWindow(fw.win);
  delete process.env.CITYLIVE_FORCE_SUSPEND;
  assert.strictEqual(s.suspended, true,
    'a renderer that loads late must still be able to learn it should not be drawing');
  assert.ok(s.tier, 'and it must learn its tier the same way');
  // A window the guard has never heard of gets a safe answer, not a crash or a stuck suspend.
  assert.strictEqual(throttle.stateForWindow({}).suspended, false);
  assert.strictEqual(throttle.stateForWindow(null).suspended, false);
});

test('the guard reports its own polling cost, so it can never become the problem it solves', async (t) => {
  t.after(() => throttle.stop());
  throttle.stop();
  throttle.start({
    screen: fakeScreen(ONE_DISPLAY),
    powerMonitor: null,
    occlusion: { available: () => false, coveredDisplays: () => ({}) },
    getWindows: () => [{ win: fakeWindow().win, displayId: 1, hwnd: null }],
    getUserQuality: () => null
  });
  await wait(1800);
  const s = throttle.state();
  assert.ok(typeof s.pollAvgMs === 'number', 'poll cost must be observable');
  assert.ok(s.pollAvgMs < 50, 'the guard itself must be far cheaper than a frame (was ' + s.pollAvgMs + 'ms)');
});
