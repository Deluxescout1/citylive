# Stage 3 design — THE PEOPLE on the wallpaper (world-binding + embodiment)

Goal: put the ~175 named citizens ON the live wallpaper — living in real buildings, commuting
home↔work, dressed for their job, inspectable on hover/click — on all 4 shells, deterministic and
freeze-safe. This is the design for SOL to review BEFORE any invasive draw code.

## What already exists (confirmed in engine)
- `buildWorld(lifeIndexOf(now))` seeds the world from the LIFE INDEX → `near.blds`/`mid.blds`/
  `far.blds` are a globally-deterministic building list, identical on every screen (culled by
  `disX` at draw). Each `b` has `{x,w,h,type,district,bAge,...}`. Types: apartment/house/hospital/
  school/fire/cafe/store/office/bank/hotel/theater/factory/warehouse/depot/pharmacy/museum/park.
- `drawPerson(g,x,y,cloth,skin,bob,kind)` draws a 7px pixel person. Anonymous `peds[]` (≈WW/16)
  are built at world-gen and drawn each frame in the foreground.
- Coordinate: world-px; `disX(worldX)` → screen-x; `HORIZON` = sidewalk baseline; `wrapW`.
- The citizen sim (`peopleRoster`/`P_sim`) is PURE-CLOCK and geometry-free (placeholder building ids).

## Core principle (keep the invariant)
The sim stays geometry-free and pure-clock. Building **embodiment is a RENDER-TIME projection**:
a deterministic map citizen→(homeBuilding, workBuilding) computed from `near.blds` + the citizen's
seed, done in the draw path (where `near.blds` exists), NEVER inside the pure-clock fold. Same
`near.blds` on every screen ⇒ same binding on every screen ⇒ bezels stay in sync.

## A. Building registry (render-time, deterministic)
Build once per `(life, screen-geometry)` in `setup()`/first draw, cached:
- `HOMES[]` = indices of `near.blds` with type in {apartment,house} (+ oldtown/residential blocks).
- `WORK[typeName]` = indices of `near.blds` grouped by building type.
- Each citizen (by index+seed) deterministically picks: `homeB = HOMES[hash(seed)%HOMES.len]`,
  `workB = WORK[job.building][hash(seed^1)%len]` (fallback: nearest existing type; if none exists
  yet at this cy, citizen is "off-screen"/not embodied until it's born). Stable per life.
- A building is "real/standing" only if born (`cityG-b.bAge>bandOf(b)`); unborn/destroyed → citizen
  routes to a fallback or is not drawn (never a floating occupant).

## B. Schedule & position (deterministic function of time-of-day)
- Real local time-of-day (already the wallpaper's clock) drives a daily routine:
  night→home, morning commute home→work, day→at work, evening commute work→home. A small per-
  citizen phase offset (from seed) desynchronises the crowd.
- Position = lerp between homeB.x and workB.x along the sidewalk by schedule phase; `bob` animates
  the walk. Only citizens whose current world-x falls in this screen's `[WOFF,WOFF+SW]` are drawn.
- Clothing: **work uniform** (`job.clothes/clothesAlt`) while commuting-to/at-work; **civilian**
  (existing PEDC palette, seeded) otherwise. Immutable skin/hair from seed → recognisable.

## C. Replace vs augment the anonymous pool
Proposal: KEEP a thinned anonymous crowd for density, and draw named citizens ON TOP as a distinct,
inspectable layer (cap the on-screen named count to what fits, prioritising the notable: mayor,
council, wealthy, those mid-conversation). Rationale: replacing the whole `peds[]` pool risks the
crowd feel + perf; a named overlay is lower-risk and still "the city is these people." (Open to
SOL's view: full replacement vs overlay.)

## D. Inspect (hover/click) — read-only
- Hit-test: on mousemove/click over the sidewalk band, find the nearest drawn named citizen's
  screen-x; show a small inspect card (name, job, class, family) via `citizenPublic`-style
  projection. Read-only. Opt-in per Nick (a setting), off by default? (Nick said hover/click is
  fine "if it works"; drag-to-death gag is opt-in OFF by default and COSMETIC, never mutates.)
- KDE wallpaper: pointer events on a desktop wallpaper are limited — inspect likely lives in the
  Electron/web/phone shells (which own the pointer); the KDE wallpaper may show name+speech only.

## E. Speech bubbles (only on real interaction)
- When two named citizens are co-located on the sidewalk at the same tick, they exchange one line
  each from `speech.json` (category chosen by their state: economy/politics/class/family/…). Bubble
  is a short pixel caption above them. No free-floating name labels (Nick Q26).

## F. Staging within Stage 3 (each clears the both-platform gate)
1. Render binding + draw named citizens at their WORKPLACE in job clothes (static-ish), inspect card
   in Electron/web/phone. (Smallest visible win.)
2. Daily commute schedule (home↔work) + civilian/work clothing switch.
3. Speech bubbles on co-location.
4. Opt-in drag gag (cosmetic overlay, off by default).

## Open questions for SOL
1. Overlay named citizens on a thinned anonymous crowd, or fully replace `peds[]`?
2. Best deterministic hit-testing approach given `disX`/ZOOM/multi-bezel offsets?
3. Where must the render-binding cache invalidate (life change, geometry change, building birth/
   destruction) to avoid a citizen pointing at a stale/destroyed building?
4. Perf: drawing + per-frame binding for up to ~175 citizens across the foreground — any concern at
   8–12fps on the KDE canvas, and how to bound it?
5. Does embodiment need to feed back into the sim (workplace destroyed → job loss), or stay a
   cosmetic projection in Stage 3 and couple in Stage 4 (economy)?
