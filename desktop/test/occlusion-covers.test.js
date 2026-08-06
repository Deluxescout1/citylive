// The coverage rule of the Windows performance guard, tested off Windows.
//
// 🚨 THE FAILURE THIS EXISTS TO PREVENT is not a crash — it is a guard that runs perfectly and never
// fires. The KDE version of this shipped once, tested a window rect against the FULL SCREEN, and so
// never suspended anything even once: a maximised window covers the screen MINUS the panels (a
// browser measured 2327x1259 on a 1309-tall screen — exactly the 50 px panel short). It looked like
// it was working. It was doing nothing. `covers()` is the arithmetic that decides, and on Windows it
// is fed `display.workArea`, not `display.bounds`, for exactly that reason.
//
// The other silent-failure mode is units: GetWindowRect is PHYSICAL pixels and workArea is DIP. On a
// 150%-scaled Surface, comparing them raw makes every window look one-third too small to cover
// anything — the guard never fires, and again it looks fine. The scaled case below is that bug.

const { test } = require('node:test');
const assert = require('node:assert');
const { covers } = require('../occlusion');

// A window rect, as GetWindowRect returns it.
const rect = (l, t, r, b) => ({ left: l, top: t, right: r, bottom: b });
// A display work area in physical pixels, as dipToScreenRect returns it.
const area = (x, y, w, h) => ({ x: x, y: y, width: w, height: h });

test('a maximised window covers the WORK AREA even though it misses the screen', () => {
  // The exact geometry that made the KDE v1 useless: 1309-tall screen, 50 px panel, window 1259 tall.
  const screen = area(0, 0, 2328, 1309);
  const workArea = area(0, 0, 2328, 1259);
  const maximised = rect(0, 0, 2328, 1259);
  assert.strictEqual(covers(maximised, workArea), true, 'covers the work area — this is the right test');
  assert.strictEqual(covers(maximised, screen), false, 'does NOT cover the full screen — this was the bug');
});

test('Windows maximised windows overhang the work area, and that still counts', () => {
  // Windows keeps invisible resize borders outside the visible frame, so a maximised window's rect is
  // normally slightly LARGER than the work area. Exact equality would match nothing.
  const workArea = area(0, 0, 1920, 1032);
  assert.strictEqual(covers(rect(-8, -8, 1928, 1040), workArea), true);
});

test('a window one rounded-corner pixel short still counts', () => {
  const workArea = area(0, 0, 1920, 1032);
  assert.strictEqual(covers(rect(1, 1, 1919, 1031), workArea), true, 'default slack forgives a couple of px');
  assert.strictEqual(covers(rect(1, 1, 1919, 1031), workArea, 0), false, 'and slack 0 is strict');
});

test('a window that leaves any strip of desktop showing does NOT count', () => {
  const workArea = area(0, 0, 1920, 1032);
  assert.strictEqual(covers(rect(0, 0, 1600, 1032), workArea), false, 'half the desktop still visible');
  assert.strictEqual(covers(rect(0, 200, 1920, 1032), workArea), false, 'a band across the top still visible');
  assert.strictEqual(covers(rect(200, 0, 1920, 1032), workArea), false, 'a column down the side still visible');
});

test('a second monitor is only covered by a window that is actually on it', () => {
  // Virtual-screen coordinates: the second display starts at x=1920.
  const second = area(1920, 0, 1920, 1032);
  assert.strictEqual(covers(rect(0, 0, 1920, 1032), second), false, 'maximised on display 1 does not cover display 2');
  assert.strictEqual(covers(rect(1920, 0, 3840, 1032), second), true);
});

test('a monitor placed LEFT of the primary has negative coordinates and still works', () => {
  // The origin of the virtual screen is negative whenever a monitor sits left of or above the
  // primary — the common case for a second screen, and a routine source of sign bugs in this project.
  const left = area(-1920, 0, 1920, 1080);
  assert.strictEqual(covers(rect(-1920, 0, 0, 1080), left), true);
  assert.strictEqual(covers(rect(0, 0, 1920, 1080), left), false);
});

test('THE UNIT TRAP: a DIP work area compared against a physical window rect never matches', () => {
  // A 150%-scaled Surface: 2256x1504 physical, reported as 1504x1002 DIP (minus a 48 px taskbar).
  // The window rect is physical. If the caller forgets dipToScreenRect, this is what happens.
  const physicalWorkArea = area(0, 0, 2256, 1432);
  const dipWorkArea = area(0, 0, 1504, 955);
  const maximised = rect(0, 0, 2256, 1432);          // physical, as Win32 reports it
  assert.strictEqual(covers(maximised, physicalWorkArea), true, 'correct units → the guard fires');
  // …and with the wrong units it also "passes", which is why this is dangerous: the bug does not
  // show up as a false negative here, it shows up as the guard firing when the desktop is VISIBLE.
  assert.strictEqual(covers(maximised, dipWorkArea), true);
  // The real damage is the reverse direction — a genuinely covering window judged too small:
  const smallWindowPhysical = rect(0, 0, 1504, 955); // a window the size of the DIP rect, in physical px
  assert.strictEqual(covers(smallWindowPhysical, physicalWorkArea), false,
    'a window covering only two-thirds of the panel must not read as full coverage');
});
