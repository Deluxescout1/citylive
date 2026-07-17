# PLAN — "Deep Space Age" mega-batch (→ v1.8.0)

Branch `deeper-space` (off main, includes v1.7). Nick locked all of this via AskUserQuestion
2026-07-17. Ship as ONE mega-release. Rules unchanged: canonical engine + sync ×4 + md5;
both-platform gate (KDE live + WinTest VM) before merge/tag; pure clock+hash determinism;
QUAL budget; verify via kde-repro (Chromium) + headless qml6 (real KDE Canvas) + live journal.

## Nick's locked decisions
- **Persistence: HYBRID** — a BASELINE colony persists & slowly grows ACROSS lives (like the
  ruin/build persistence, but monotonic + capped), PLUS each life's space age (curSpace) adds a
  visible BOOM on top. Applies to EVERY colonised body (Moon + planets).
- **Vibe: FULL SCI-FI SPECTACLE** — orbital ring/station, mega-structures, dense fleets, a
  departing exodus fleet, holograms. A clear distinct AGE.
- **Arc: SMOOTH RAMP** — everything intensifies gradually with curSpace (no milestone-ticker
  stages). (Moon END events are finale/war-triggered, not curSpace-ramped.)
- **New elements: ALL** — growing moon city, crewed rocket launches (carry settlers → tie to
  colony growth), orbital station/ring, other worlds visible, + planetary colonies.
- **Moon must be SUPER VISIBLE**, bigger, and also visible in the MORNINGS/daytime sometimes
  (real daytime moon). Moon END-events only render WHEN the moon is actually above the horizon.
- **Moon end-time events — ALL FOUR:**
  1. Shattered — Moon cracks → glowing debris ring above the dying city.
  2. Blood/looming portent — reddens, looms larger, pulses as the end nears.
  3. Lunar colony falls — colony lights flicker out, explosions on the surface, evac ships flee.
  4. **Moon falls to Earth = MAJORA'S MASK** — it grows ENORMOUS and gains a menacing carved
     FACE (angry eyes, furrowed brow, gritted teeth), plunging toward the city. Its own finale.
- **Colonisable worlds: Moon + Mars + Venus (cloud cities) + Jupiter/Saturn moons (Europa/Titan
  ice colonies).** Planets visible at real-ish positions when up.

## Positions / ephemeris (my call, matches the real-sky ethos)
- Reuse `altAz(ra,dec,lst)` + `skyWX`/`skyY` (real projection already in engine).
- Moon: `moonRaDec` already exists. Planets: add low-precision heliocentric Keplerian elements
  (VSOP-lite) → geocentric RA/Dec per date. Naked-eye bodies: Mars, Venus, Jupiter, Saturn (Mercury
  optional). Plausible fallback if a body's ephemeris proves heavy — but aim real.
- DAYTIME MOON: `drawSky` currently returns if L>=0.34. Split moon+planet drawing into a path that
  also runs in daylight when the body is up (pale, low-contrast) — a separate `drawDaySky`/hook so
  the star field stays night-only but the Moon/bright planets can show by day.

## Persistence model (deterministic, capped, cross-life)
- `SPACE_EPOCH` = the life index at which spacefaring begins (once cities first reach the age).
- `colonyBaseline(body, now)` = f(livesElapsed since a body's settlement life), monotonic, hard-capped
  per body (Moon caps at a lit lunar metropolis; Mars smaller; outer moons smaller still). Deterministic
  from the life index — NO stored state (recompute like ruins/builds). Firewall: colony math must not
  read curDis/curWar/mayor etc.
- `colonyLevel(body, now)` = min(cap, baseline + curSpace*boom). Drives dome/light/district count.
- Settlement order over lives: Moon → Mars → Venus → Europa/Titan (each unlocks after N lives).

## ADDED MID-BATCH (Nick 2026-07-17)
- [x] SUN OVERHAUL DONE — radial-gradient corona bloom + limb-darkened round disc + soft hot core + gentle breathe; keeps temp colors/god-rays/eclipse. Verified Chromium + QML (createRadialGradient works).

## Build phases (ONE release, but built + verified incrementally)
- P0  branch + this doc. `bodyState()` scaffold + FORCE hooks (FORCESPACE `{body:level}`,
      FORCEMOONEVENT) + kde-repro params (moon=, planet=, moonevent=).
- P1  MOON OVERHAUL: bigger + detailed disc (maria/craters/brighter halo), DAYTIME moon (real pos,
      pale), super-visible. Verify day+night, several phases.
- P2  LUNAR CITY + hybrid persistence: growing domes/lit districts/lunar spaceport/shuttles; baseline
      grows across lives + curSpace boom. Verify at lives 1/5/20 × curSpace .3/.7/1.
- P3  PLANETS VISIBLE: planet ephemeris → Mars/Venus/Jupiter/Saturn at real positions, brightness,
      day/night. Verify positions against a known date (sanity vs an ephemeris).
- P4  PLANETARY COLONIES: Mars domes, Venus cloud cities, Europa/Titan ice colonies (hybrid persist).
- P5  ORBITAL MEGA-STRUCTURE: space station/ring crossing the sky on a real arc + lit windows; dense
      hover fleets already exist — fold in. Crewed rocket launches enhanced (carry settlers → colony).
- P6  INTERPLANETARY EXODUS: late-age fleet departs toward the planets (mass exodus before the end).
- P7  MOON END-EVENTS (only when moon up): shattered / blood-portent / colony-falls, wired to the
      right finales/war; **MAJORAّS-MASK MOONFALL** as a new DEATHS entry "moonfall" (grows huge +
      carved face + plunge). Note DEATHS hash-map shift (cosmetic).
- P8  sync ×4 + md5 + full render matrix + QML sweep (no-try/catch, all bodies/events) + perf.
- P9  both-platform gate (KDE live journal + WinTest VM) → merge → bump 1.8.0 → tag.

## Guardrails (hard-won this project)
- Determinism firewall: colony/planet/persistence math is pure f(clock+hash); never reads
  curDis/curWar/curMayor/curEcon.
- FREEZE-safe: persistent colonies render every frame for hours → static/cheap/clamped like ruins.
- Cross-screen: everything a pure fn of shared wall-clock + world-X (bodies via real altAz already are).
- QML gotchas: NO draw()-local var read by a top-level draw fn (the wmood class — the plugin onPaint
  has NO try/catch, so an uncaught throw aborts the whole frame). Run the qml6 no-try/catch sweep.
- New DEATHS entry shifts deathOf() hash mapping (cosmetic; note in commit).
- No per-frame allocations in the hot path; precompute planet elements once.
- NO sound.

## Verify pipeline (per phase)
node -c; sync ×4 + md5; kde-repro render (Chromium) + qml6 headless (real Canvas) + qml6 no-try/catch
error sweep across bodies/events/finales; perf probe (draw() ms); then P9 gate.

## STATUS  ⟵ UPDATE AS EXECUTED
- [ ] P0 scaffold + hooks
- [x] P1 moon overhaul (bigger disc+maria+halo, DAYTIME moon; verified night+day, QML clean) (bigger + daytime)
- [x] P2 lunar city + hybrid persistence (colonyLevel model + growing lunar city; verified 3 levels, QML clean). Full lunar spaceport/shuttle detail can extend later.
- [x] P3+P4 planets visible + colonies (JPL ephemeris verified; point→ringed colonized disc + glow + "<WORLD> COLONY" label; Venus by day). QML clean.
- [x] P4 (done with P3)
- [x] P5+P6 orbital station beef-up + orbital RING arc + crewed EXODUS (ramps with curSpace, ships arc spaceward). QML clean.
- [x] P6 (done with P5)
- [ ] P7 moon end-events + Majora's-Mask moonfall finale
- [ ] P8 sync + matrix + QML sweep + perf
- [ ] P9 both-platform gate → ship v1.8.0
