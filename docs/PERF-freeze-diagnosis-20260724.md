# CityLive desktop-freeze diagnosis — 2026-07-24

Nick's report: "when the population gets too big my whole desktop slows to a crawl … it even
freezes my taskbar." Three monitors, all running CityLive.

## Verdict

The wallpaper asks for **~4× more work than the frame budget allows** on this 3-screen setup.
It is not a leak and not a specific city state — it is a permanent overload.

| screen | canvas | zoom | median frame (real Qt V4) |
|---|---|---|---|
| 4K @165% (fractional DPR) | 1922×1082 | 2 | **112–120 ms** |
| 2560×1440 @100% | 854×480 | 1 | 104–113 ms |
| 1920×1080 @100% | 640×360 | 1 | 105–112 ms |

Repaint timer (`quality: "spectacle"`) fires every **83 ms**. Combined work per tick:
**~330 ms → ~400% of budget.** plasmashell can never finish a frame before the next is
demanded, so its render threads saturate and the whole desktop (taskbar included) drags.

Cost is essentially **flat across city maturity** (measured cy 0.05→0.95 and 8 whole lives) —
the city is over budget at every age. It is over budget on *one* screen alone (131%).

## Biggest single cost: the citizen-sim cache thrashes every frame

`P_sim` (city.js ~8099) keeps a **single** cache slot. Within one frame it gets three requests
at two different ticks, and the third is a *rewind* — which misses and cold-folds the entire
life from tick 0:

| # | caller | cy | tick | `P_step` calls | ms (node vm) |
|---|---|---|---|---|---|
| 1 | `peopleElectionState` | 0.5080 | 457 | 0 (hit) | 0.02 |
| 2 | `peopleElectionState` | 0.5780 | 520 | 63 (advance) | 11.1 |
| 3 | `drawNamedCitizens` | 0.5080 | **457** | **458 (COLD REFOLD)** | **43.8** |

`P_step` is **~70 ms of a 91 ms frame (77%)** — 521 calls/frame, 175 citizens each. Every
frame, every screen, forever. Repo HEAD is **worse** (811 `P_step`/frame).

## Ruled out (measured, not assumed)

- **Engine JS leak across lives** — none. 110 consecutive lives (= 5 days uptime at the
  current 1 h cycle): heap 16.2 → 17.6 MB, frame time flat, **zero** arrays grew.
- **plasmashell RSS leak** — 851 MB → 798 MB on the next sample. Normal fluctuation.
- **Render errors** — journal clean, no "recovered from a render error".
- **A specific expensive city state** — worst frame over 1600 samples was only 2.0× mean.

## Contributing factor: wrong cycle length

`localcfg.js` has `"cycle": "test"` = a **1-hour** life, so the city races to maturity and
apocalypses hourly. Should be `"1w"` for normal use. Something re-baked this during the
other models' edits.

## Base-build note

The **live** build (`~/.local/share/plasma/wallpapers/…`) is a hand-edit that is NOT repo HEAD:
it collapsed HEAD's 7 canvases → 1 (a deliberate fix — 7 FBOs × 3 screens was "enough to pin
plasmashell on a three-screen setup", per its own comment) and calls `City.draw(g)` with no
pass argument, so every frame repaints the whole scene. HEAD has the worse sim thrash *and*
the 7-FBO design. **The live build is the only one verified to render correctly on Nick's
fractional-DPR 3-monitor setup — port fixes into it rather than switching base to HEAD.**

## Harnesses written (session scratchpad)

- `qml-perf.qml` / `qml-sweep.qml` — real Qt V4 frame timing, offscreen.
  Run: `QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 -I . qml-sweep.qml`
  (V4 console output is swallowed without `QT_ASSUME_STDERR_HAS_CONSOLE=1`.)
- `prof-draw.js` — per-function self-time profile of one frame (wraps every engine global).
- `sim-trace.js` — logs every `P_sim` call in a frame with caller + fold cost.
- `accum-test.js` — cross-life accumulation/leak detector.
- `spike-hunt.js` — worst-case frame hunter across many lives.

**Caveat:** node/V8 is not the wallpaper's runtime. Qt V4 measured ~10× slower than native
node and roughly matches the node-`vm` figures. Always confirm perf work on the QML harness.
