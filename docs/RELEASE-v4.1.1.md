# v4.1.1 — THE LINES, FIFTH AND FINAL RETURN

**Fix release.** Three commits: the screen-stripes root cause, the water reflection seams, and the
rowing crews made visible. 244 engine tests green; the one failure (`fireflies.test.js` on `leaf`)
fails identically on the pristine committed engine — pre-existing, tracked here for the next pass.

## 1. The vertical lines on the 4K screen (mountains + water)

The family of bugs that has now recurred FIVE times, each after a change to the canvas/resample
math in `main.qml`, finally got its root cause stated without a proxy:

- **What was true:** the engine's own output is clean at 1:1 (re-proven 2026-10-12 on THE KARST,
  offscreen, at native resolution — verticals present in the frame are only the designed dashed
  fissure strokes). The stripes are made downstream, by the compositor.
- **What broke it this time:** the false-binary rework left `texelBuf` pinned at `pxk` (coarse
  texels) for EVERY screen. On Nick's 4K left screen (DP-3, 3840×2160 at **165%**, which Qt
  reports as dpr exactly 2) that means: canvas FBO 1552×874 → plasmashell upscale ×1.5009 into the
  4656-wide window buffer → KWin output downsample 4656→3840. Two fractional resamples, beating
  against the coarse 3-device-px texel blocks — the recurring "lines every ~58px".
- **Measured, before the fix:** column-luminance autocorrelation of the mountains band peaked
  **+0.202 @ 60px**, the water band **+0.767 @ 120px**; the clean DP-4 control read **+0.048**.
- **The rule, in its own words now:** a screen whose canvas maps to the output by an exact integer
  keeps coarse texels and pays nothing (the overshoot-and-crop trick covers the 2560's 2.9977
  case). A screen plasmashell must **resample to a fractional output scale** (dpr ≠ 1) has no such
  integer anywhere in its pipeline and pays for native texels — `texelBuf = round(dpr)`, canvas
  2328×1311 on his 4K, rasterized 4656×2622 = the window buffer 1:1, leaving only KWin's global
  output downsample, which every native-resolution app on that output already goes through.
- **After:** mountains autocorrelation **+0.011 @ 64px** (flat), verified live after re-install.
- **Cost:** 2.24× the canvas pixels on that one screen (~12 points of one core at 8fps, measured in
  the third round). Nick accepted this trade explicitly then; it is the same trade now.

## 2. The water's own seams (engine-side, both fixes map-independent)

Two structural faults in the banded reflection batching (`drawKarstWater`, and the identical
pattern in `drawFjordWater`), found by rendering 1:1 offscreen at the same instant Nick screenshotted:

- **Hairline seams:** two near-touching towers leave a 1–6px run of NO silhouette; its bare
  gradient, flanked by dark reflection bands, reads as a thin light line down the full depth of the
  water. `karstSil` now BRIDGES slivers ≤8px with a linear blend of the flanks; wider gaps stay
  bare (real sky between towers → no reflection).
- **Patch-rim edges:** even after bridging, every run's first/last column was a hard jump from full
  reflection alpha to bare water — 1px of edge per band, stacked down all six bands = a full-depth
  ruled line. New shared `bandRunRect()` draws every run FEATHERED (~1/3 of the run, capped 4px, at
  42% alpha, both ends, core at full alpha). Measured offscreen: 13 full-depth line clusters → 1
  (a bezel-edge artifact only).

Both are in the canvas texture now, not just the resample — so they held on the native canvas and
would have shown on every future screen. `drawCavernWater` already wobbles its edges and was left
alone.

## 3. The rowing crews ("if someone is in a boat you can see them rowing")

Nick, watching a crew of eight: they read as men SITTING. Three fixes in `drawSculls`, all pure
functions of (world x, clock):

- **The window was dawn-only (05:00–09:00)** — nobody ever caught a crew rowing. Now 05:00–20:00
  (morning practice through the evening rows); ashore at night and in heavy rain, unchanged.
- **The oars were a two-pose stub** that switched on a sine — sub-pixel and invisible. Now: oars
  out on BOTH sides of the shell (a real eight), a continuous sweep through the arc as two 1px
  segments, blade at/below the waterline through the drive, a splash at the catch, an expanding
  ripple through the pull, and each body leaning ~1px into its stroke.
- **`sculls.test.js` updated + hardened:** crews ashore at 21:00 and 02:00, launched in daylight
  (11:00 / 17:00), eight oar ops minimum on any visible crew, no NaN, no negative-width rects
  (port-side oars drew negative widths on the first pass — invisible on half the crew).

## 4. Housekeeping

`City.VERSION` had drifted two releases behind (`2.0.2` while the build was 4.1.0) — the config
page and Almanac have been lying about the build. Now `4.1.1` everywhere (engine, package.json,
metadata.json), with the drift noted as a RELEASING cut-list item.