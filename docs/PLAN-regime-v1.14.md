# CityLive v1.14.0 — "THE ORDER" (fascist-takeover political arc)

A dystopian political CHAPTER a city can go through and come out of. Branch `regime` off main@v1.13.0. Pure engine (city.js) → all platforms. Ominous but **wallpaper-friendly** (dread, no gore).

## Locked with Nick (2026-07-19, AskUserQuestion)
1. **Trigger:** rises ORGANICALLY through the elections (not player-pickable). Deterministic per-life.
2. **Frequency:** UNCOMMON — ~1 in 7 lives (own hash, ~14%).
3. **Regime:** a NEW fictional party **"THE ORDER"** — crimson `#c0182a` + black banners, a **white angular star/chevron emblem** (invented, NO real-world symbols).
4. **Leader:** cult of personality — a named Dear Leader (per-life name), giant PORTRAITS on facades, a colossal PLAZA STATUE, name on state media. The statue **TOPPLES** at the fall.
5. **Arc = full slow-burn, 6 STAGES** (below), each visibly distinct.
6. **Outcome:** ALWAYS falls; the PATH varies per life (voted out / peaceful revolution / violent uprising).
7. **The fall = big cathartic LIBERATION:** statue topples, banners torn down, crowds flood the plaza, lights return, city HEALS back to normal.
8. **Pacing:** a CHAPTER — city normal before & after, arc spans a few terms mid-life.

## The 6 stages (mapped to a cy window; city normal outside it)
Arc window ~cy [0.42 … 0.80], healed-normal after. Stages (tune boundaries):
1. **POSTERS** — a fringe party appears; propaganda posters (emblem) go up; a small rally.
2. **WINS CITY HALL** — surges on fear (crime/hard times); THE ORDER takes City Hall; first banners.
3. **EMERGENCY POWERS** — elections "postponed"; City Hall draped; the HUD/mayor flips to THE ORDER, no more votes.
4. **SURVEILLANCE STATE** — road CHECKPOINTS, PATROLS, sweeping SEARCHLIGHTS, night CURFEW (reuse occupation-curfew mood), the emblem/Eye watching.
5. **FULL DICTATORSHIP** — crimson BANNERS drape the skyline; the Leader's giant PORTRAIT + colossal STATUE; NEWS SCREENS become state media (emblem + slogans); patrols everywhere; desaturated heavy mood.
6. **RESISTANCE → THE FALL** — graffiti + gathering crowds; the path plays out (vote / march / uprising-barricades); **statue topples**, banners torn; then LIBERATION crowds + lights return; city heals over the following days back to normal.

## Architecture
- **`regimeState(now)`** — pure clock fn (own `REGIME_SALT`, reads `econOf`/`cityGrowth`/`lifeIndexOf`, NEVER mutable cur* globals → freeze-safe). Returns `null` for most lives; for a regime life returns `{active, stage 1-6, sub (0..1 within stage), leaderName, party:{k:"THE ORDER",c:"#c0182a"}, path:"vote|revolution|uprising", cyStart, cyEnd}`. Gate: only real cities (cg.g≥~0.4), not apoc.
- **Integration w/ `mayorState`** (~8210): when regime active at stage≥2, override `M` → ruling party = THE ORDER, suppress campaign/electionDay/scandal (elections postponed) at stage≥3; `curMayor` reflects it in the HUD. Keep the determinism firewall — regimeState reads only pure inputs; mayorState *reads* regimeState but neither feeds the mutable cur* back.
- Set `curRegime=regimeState(now)` each frame near curMayor. HUD (`drawCivicHud`), ticker (`tickerMsg`), news screens all branch on it.
- **`FORCEREGIME`** test hook (pin a stage) for kde-repro/sweep.

## Draw pieces (grep names first — collisions!)
`drawRegimeBanners` (facade drapes), `drawRegimePosters`, `drawLeaderPortrait` (on a facade), `drawLeaderStatue` (plaza, topples in stage 6), `drawCheckpoints`/`drawPatrols`/`drawSearchlights` (surveillance), state-media overlay on `drawNewsScreens`, `drawResistance` (graffiti/crowds/barricades), `drawLiberation` (topple + crowds + lights). Reuse: curfew mood (`curWar` occupation ~5031), `curPolicies.surveil`, `drawPerson`, plaza at 0.365, the emblem helper.

## Phases
- **RP0** — `regimeState` + mayorState integration + node-vm ARC-COHERENCE harness (stages monotone 1→6 then null; leader name stable; path stable; no junk; ~1/7 of lives get it). `FORCEREGIME` + kde-repro `?regime=<stage>`.
- **RP1** — emblem + banners + posters + state-media news screens.
- **RP2** — Leader portrait + plaza statue; surveillance (checkpoints/patrols/searchlights/curfew).
- **RP3** — resistance + the fall (paths) + statue topple + liberation + heal.
- **RP4** — ticker headlines across all 6 stages + aftermath; HUD regime state.
- **RP5** — ship gate → v1.14.0.

## Verification
node-vm harness (arc coherence over the life, per the citizens/finale pattern) + qml-sweep jobs pinning each of the 6 stages + a render per stage. Both-platform gate. **Commit hygiene: specific paths only.**
