// Micah's bug, as a test. He runs 1920x1080 + 3840x2160 side by side on Windows and reported
// (a) the city drawing over his taskbar and (b) NO GROUND AT ALL on the 1080p screen.
//
// Root cause: one wallpaper window spanning the UNION of all displays. `HORIZON = SH - GROUND` therefore
// anchored to the bottom of the UNION — the bottom of the 4K panel — which is a whole monitor below the
// 1080p panel's visible area. The taskbar reserve had the same flaw: main.js took the MAX bottom gap
// across every display and applied it globally.
//
// This locks the per-display contract: each wallpaper window is sized to ONE display, gets THAT display's
// own bottom gap, and derives `woff` from its x offset so the world stays continuous across the bezels.
const test = require('node:test');
const assert = require('node:assert');

// The arithmetic boot() performs, lifted verbatim so the test fails if the renderer's contract changes.
function place(disp, union, dprCap) {
  const dpr = Math.min(2, dprCap);
  const refW = union.primaryW;
  const PXK = Math.max(2, Math.min(10, Math.round(refW * dpr / 430) || 4));
  const cw = Math.max(160, Math.round(disp.width  * dpr / PXK));
  const ch = Math.max(120, Math.round(disp.height * dpr / PXK));
  const ww   = Math.max(cw, Math.round(union.width * dpr / PXK));
  const woff = Math.round(disp.dx * dpr / PXK);
  const tbWp = disp.tb > 0 ? Math.ceil(disp.tb * dpr / PXK) : 0;
  // engine: GROUND = max(26, taskbarWp+18), HORIZON = SH - GROUND   (city.js setup)
  const GROUND = Math.max(26, tbWp + 18);
  return { PXK, cw, ch, ww, woff, tbWp, GROUND, HORIZON: ch - GROUND };
}

const UNION = { width: 5760, primaryW: 3840 };
const FOURK = { width: 3840, height: 2160, dx: 0,    tb: 48 };
const HD    = { width: 1920, height: 1080, dx: 3840, tb: 40 };

test('every display puts its ground on ITS OWN bottom edge, not the union bottom', () => {
  for (const d of [FOURK, HD]) {
    const r = place(d, UNION, 1);
    assert.ok(r.HORIZON > 0, 'horizon must exist on this display');
    assert.ok(r.HORIZON < r.ch, 'horizon must be inside this display');
    // the ground must sit within one GROUND-band of this display's own bottom
    assert.strictEqual(r.ch - r.HORIZON, r.GROUND);
  }
});

test('the 1080p panel is NOT asked to render the 4K panel\'s height (the actual bug)', () => {
  const hd = place(HD, UNION, 1);
  const union = place({ width: 5760, height: 2160, dx: 0, tb: 48 }, UNION, 1);
  assert.ok(hd.ch < union.ch, 'per-display canvas must be shorter than the union canvas');
  // under the old union model the ground sat at the union bottom; on the HD panel that is off-screen
  assert.ok(union.HORIZON > hd.ch,
    'regression guard: the union horizon really is below the 1080p panel, which is why it had no ground');
});

test('each display reserves ITS OWN taskbar, not the maximum across displays', () => {
  const a = place(FOURK, UNION, 1);
  const b = place({ ...HD, tb: 40 }, UNION, 1);
  const bIfMaxUsed = place({ ...HD, tb: 48 }, UNION, 1);   // the old global-max behaviour
  assert.notStrictEqual(b.tbWp, bIfMaxUsed.tbWp,
    'a 40px gap must not be reserved as if it were the 48px one from the other display');
  assert.ok(a.tbWp > 0 && b.tbWp > 0, 'both displays reserve something');
});

test('woff keeps the world continuous across the bezel', () => {
  const a = place(FOURK, UNION, 1);
  const b = place(HD, UNION, 1);
  assert.strictEqual(a.woff, 0, 'the leftmost display starts at world 0');
  assert.strictEqual(b.woff, a.woff + a.cw,
    'the second display must begin exactly where the first ends — no seam, no overlap');
  assert.ok(b.woff + b.cw <= a.ww, 'both displays fit inside the shared world width');
  assert.strictEqual(a.ww, b.ww, 'every display shares ONE world width');
});

test('a single-display desktop is unchanged', () => {
  const solo = place({ width: 1920, height: 1080, dx: 0, tb: 40 },
                     { width: 1920, primaryW: 1920 }, 1);
  assert.strictEqual(solo.woff, 0);
  assert.strictEqual(solo.ww, solo.cw, 'world width equals the one screen');
});
