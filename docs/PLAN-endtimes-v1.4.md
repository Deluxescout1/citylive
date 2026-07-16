# PLAN — "End-Times Spectacle" batch (→ v1.4.0)

Fable-planned 2026-07-16 against engine md5 483ab8b6…; user-locked decisions inline.
Execution state lives here so any session can resume. Standing rules: work on THIS branch
(`endtimes-spectacle`); both platforms (KDE + Windows VM) verify before merge/tag; engine
edits ONLY in canonical `org.citylive.wallpaper/contents/js/city.js` then sync ×4 + md5.

## Scope (user-locked)
- **A. "kaijuwar" finale — Godzilla vs Kong**: two kaiju battle each other; buildings are
  collateral; **different winner each life** (per-life hash); victor roars on the rubble.
- **B. "pollution" finale — slow suffocation**: paces on `cityApoc` across the WHOLE apoc
  phase (NOT real-seconds like others): veil ramps → district lights die one-by-one (per-life
  hashed district order, per-building stagger) → grey corrosion → dead grey. NO collapse, no fire.
- **C. Invasion upgrade — ALL invasion sites** (`drawApocAI`, `drawApocAlienWar`, `drawWar` tier-3):
  descending dropship force + AIMED tracked beams that crack into streets (telegraph sweep →
  thick beam → ground flash + scorch + dust); **near-misses only, crowds scatter, nobody dies**.
- **D. Picker plumbing**: DEATHS += "kaijuwar","pollution" (append-only!); config-store whitelist;
  settings.html + config.qml dropdowns ("Godzilla vs Kong", "Pollution"); main.xml comment; tests.

## Key engine anchors (verified by Fable; line numbers at plan time)
- DEATHS 7665 · deathOf 7667 · CFG_FINALE 7666/7670 · curDeath 8961 · FORCEDEATH 7671 · DEMO_APOC_SEC 7708
- apoc clock: cityGrowth 6250 · apocMs 8960 · timing consts 7678-7707 · generic gates
  `apocPositional/apocStruck/apocHit/apocFull` 7730-7763 (the "three questions" contract — plug in here)
- building collapse branches 2966-3007 — ⚠ catch-all `else` at 3004 collapses unknown deaths →
  pollution MUST add explicit no-op branch. lmHit/lmBlow 5208-5218 (flood no-blow pattern at 5208).
  Museum relic glyphs 4993-5006 (add 2). apocKill switch 8965-8983 (default `cityApoc` = pollution's
  fade for free; kaijuwar needs a branch like kaiju 8979). Train gate 3282.
- peds: per-death branches 9540-9606 (kaiju flee 9596; generic run 9605 — pollution needs explicit
  masked-shuffle branch, reuse smog residents 6112-6117); war scatter 9607-9608; arms-up 9618.
- lights-out hook: window lit gate 3114-3115 (blackout `blk6` pattern) — pollution adds sibling predicate.
  Districts/districtAt 158-208 for light-death order.
- smog veil palette 6102-6118 · wildfire smokeF veil 9881 · apocVeil 9939 · blackout column-veil 6086.
- invasions: drawApocAI 8392 (monolith 8406, eye 8430, HUD 8410/8464) · drawApocAlienWar 8519
  (static ground beams 8566-8571 = REPLACE; ship arrays 8547-8550 = muzzle positions; keep
  ship-vs-ship 8555 + wreckage 8572) · drawWar 7556 (tier-3 static beam 7618-7620 = REPLACE;
  fleeing civs 7594; tiers 0-2 untouched; milFund 7296-7307 untouched).
- kaijuwar choreo: epicenter apocEpiX 7714; fronts like apocFrontR 7716/frontCollapse 7722;
  timeline: ARRIVE ~4.5s (roar rings 5872 idiom) → APPROACH ~6s (fronts trample toward bx) →
  CLASH ~12s (3s beat cycles keyed floor(apocMs/3000): beam-rake / lunge-pummel / grapple+ring;
  midpoint drifts ±WW*0.04/cycle; clash radius collapses) → DECIDED ~2s (loser topples like a
  collapsing building) → AFTERMATH static victor + roar pose every 6s. Winner=hash(lifeIndexOf),
  trademark-safe in-engine names, friendly picker name "Godzilla vs Kong".
- pollution bands of cityApoc: 0-0.25 veil settles (HUD "AIR QUALITY EMERGENCY - STAY INSIDE") ·
  0.25-0.70 district lights die (hashed order + b.seed stagger ±0.03) · 0.70-0.92 grey corrosion
  (blackout column-veil technique w/ warm grey) · 0.92-1 dead grey static (HUD "THE AIR IS GONE").
  apocStruck=cityApoc>0.02; apocHit=false until apocFull(0.92); NEVER enters drawApocBuilding.
- invasion helpers (pure clock): 3-6 dropships, ~9-14s wrapped descent S-curves; strike slots
  ~800-1100ms: telegraph sweep 60% → CRACK beam + ground flash (fillEllipse 8571 idiom) + dust;
  target offset ±6-14px from ped anchors (guaranteed near-miss); scorch = pure fn of last ~10 slots,
  ember fades ~20s.

## Ordered steps & state  ⟵ UPDATE AS EXECUTED
- [x] Branch `endtimes-spectacle`; commit leftover harness (CLAGE knob + kde-repro debug rigs) + this plan
- [ ] 1 (Opus) constants + winner/front/clash helpers + gate cases (7702/7790/7730-7763) + apocKill branch
- [ ] 2 (Opus) building/lm/ped/window-lit wiring + museum glyphs (see anchors)
- [ ] 3 (Opus) drawApocKaijuWar + drawApocPollution + dispatch (7837-7845); hot-phase/static-aftermath split
- [ ] 4 (Opus) invasion helper cluster + rework drawApocAI / drawApocAlienWar 8566-8571 / drawWar tier-3
- [ ] 5 sync city.js ×4 + md5
- [ ] 6 (Sonnet) config-store whitelist+comment + tests green
- [ ] 7 (Sonnet) settings.html FINALES + config.qml finaleChoices + main.xml comment
- [ ] 8 (Sonnet) verify-scale.js knobs CLDEATH + CLAPOC (FORCEAGE={g:1,phase:'apoc',apoc:X,cy:0.955+0.045X})
- [ ] 9 render matrix (day+night per scene: kaijuwar arrive/clash/decided/aftermath + winner determinism
      across 2 lives ×2 reruns; pollution 0.1/0.4/0.75/0.95 — assert ZERO collapsed buildings; ai/alienwar/
      war-tier3 scenes; regression: all 9 old finales mid+aftermath, smog/blackout/zombie disasters, CLAGE=1)
- [ ] 10 both-platform gate: KDE qml6-offscreen subset + live plasma dropdown/pin/end-world test;
      Windows VM install + CC dropdown + pinned-kaijuwar end-world screenshot; perf spot-check 8fps clash
- [ ] 11 merge → bump 1.4.0 → tag (ONLY after both gates)

## Side-quest state: vertical-lines bug (roadmap #12)
Linewatch 2026-07-16 16:40-17:27 (26 frames, upper-sky strip): NEGATIVE — but the crop missed the
mountain band where lines are most visible. NEXT TACTIC: run the qml6-offscreen harness (scratchpad
kdeqml.qml pattern — recreate it; it renders the REAL engine under QML with the REAL clock) during a
live village window (test mode: ~:06-:18 past each hour) with NO FORCEAGE — the real advancing cycle
is the missing ingredient every frozen-age repro lacked. If reproduced: bisect draw subsystems.

## What NOT to do
No choreography state (pure clock+hash only); append-only DEATHS (never reorder/rehash);
pollution must never collapse a building (catch-alls at 3004/5218!); additive `else if` edits only;
no gore (loser topples like a building; near-misses); loops bounded ≤~60; aftermaths static-cheap;
old configs sanitize cleanly; canonical-then-sync engine discipline; no tag before both platforms pass.
