# CityLive v1.12.0 — "STRONGER SEASONS" plan

**Roadmap #3.** Branch `seasons` off main@v1.11.0. Pure engine (city.js) → all platforms.
**Locked with Nick (2026-07-18):** ambient leaves/petals are **wind-reactive** (gust/swirl with real `weather.wind`, gentle when calm) and **tasteful/moderate** density (safe on the KDE 3-canvas budget).

## Already exists (fill GAPS, don't rebuild)
- `seasonInfo(nd)` (~2051) → `curSeason` {name, canopy colors, bare, blossom}, set each frame.
- **Snow: DONE well** — `flakes[]` falling-snow particles + `snowpack` gradual accumulation (`+=dt` snowing, melts otherwise) settling on tiers/roofs/tree-crowns/snowmen (11694-11703, 3665, 3483, 7591…).
- Autumn: canopy recolor + leaf **piles** + raker (1226). Spring: some petals near blossoms/festivals. Summer: `drawShimmer` (~1124).
- Precip particle model to copy: the `flakes` block at ~11694 (array, `dt`, wraps at HORIZON, `weather.wind` term).

## Gaps to add
- **SP1 — Autumn falling leaves** (biggest gap): a `leaves[]` ambient particle system active in autumn — drifting leaves in autumn colors, wind-reactive (gentle drift → gusting swirl as `weather.wind` rises), moderate density, sway/tumble. Suppressed under heavy weather (rain/snow/fog).
- **SP2 — Snow on cars**: settle `snowpack` on car roofs in `drawCar` (mirrors the tier/roof snow already there).
- **SP3 — Spring petals citywide**: ambient `petals[]` in spring blossom season, same wind-reactive drifter (pink/white), moderate.
- **SP4 — Summer heat shimmer**: strengthen/widen `drawShimmer` (heat-haze wobble over roads/rooftops on hot clear afternoons).

## Verification
- qml-sweep: add jobs pinning each season (autumn/spring/summer/winter) at a grown city so every new draw path is throw-checked.
- kde-repro: a `?season=` force hook to render each; perf check (particles within budget).
- node-vm ticker harness stays green (draw() runs the particle systems).
- Both-platform gate (KDE live + WinTest VM) → tag v1.12.0.

## Phases
SP1 leaves · SP2 snow-on-cars · SP3 petals · SP4 shimmer · SP5 ship gate.
**Commit hygiene:** specific paths only (never `git add -A`).
