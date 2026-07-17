# PLAN — "Complete Beauty" Buildings Overhaul (→ v1.9.0)

Branch `buildings` (off main, includes v1.8). Nick locked via AskUserQuestion 2026-07-17.
Rules unchanged: canonical engine + sync ×4 + md5; both-platform gate (KDE live + WinTest VM)
before merge/tag; pure clock+hash determinism; QUAL budget; verify via kde-repro (Chromium) +
qml6-offscreen (real KDE Canvas) + qml6 no-try/catch sweep + live journal.

## Nick's locked decisions
- **Look = REALISTIC + NEON CHARACTER**: real-world architecture as the base — oldtown brick +
  cornices + fire escapes; downtown glass + steel + setbacks; terracotta/art-deco; KEEP neon/holo
  in the entertainment + downtown districts, but on REAL forms (not floaty signs on flat slabs).
- **Functional = ALL FOUR**: (1) recognizable TYPES/uses (shops/cafes/banks/theaters/hotels/
  hospitals/schools/offices/factories) w/ fitting signage + ground floors; (2) LIVING interiors &
  activity — lit rooms w/ PEOPLE SILHOUETTES (Nick: "sometimes an open/lit window at night you can
  see people in offices or their apartments/homes"), storefronts w/ goods, rooftop activity, used
  entrances, night window-life; (3) GROUND-FLOOR RETAIL on every frontage (awning/sign/display/door
  → a real commercial street); (4) STRUCTURAL REALISM — cornices, fire escapes, setbacks, mechanical
  roofs, varied materials/eras, not flat facades.
- **ADD ALL FOUR categories**: shops&cafes · civic&culture (hospital/school/museum/theater/hotel/
  bank/station/church-variety) · residential variety (apartments/tenements/townhouses/condos/walk-ups)
  · industrial&utility (factories/warehouses/power-plant/water-tower/gasworks/silos).
- Reference image: NONE supplied yet ("like this" but no attach) → run with the above; ask/await one.

## Build ON (existing DNA — don't rip out, extend)
makeLayer (~1995): per-building b.segs[] massing/setbacks, b.winLayout (grid/ribbon/band/punch/corp),
b.crown (~12: flat/step/peak/dome/tank/chevron/battlement/blade/spire/antenna/helipad/stack), districts
(downtown/entertainment/residential/oldtown/industrial via DISTRICTS{}/districtAt), house types
(brownstone/terrace/creole/steeple), features (awning/LED/sign/billboard/dish/fesc/grime/greenRoof).
drawLayer renders; drawCrown (~2920) caps. Civic LANDMARKS separate (stadium/cathedral/cityhall/etc).
Growth: b.bAge birth-age; unborn skipped, borning = drawGrowSite. Windows precompute w.no/do/tv/hx.

## Guardrails (hard-won)
- Determinism: building DNA from the per-life seed hash (byte-stable so existing skylines don't shift
  unless intended); render pure f(clock). NO Math.random in draw.
- The wmood-class QML trap: NO draw()-local var read by a top-level draw fn (plugin onPaint has no
  try/catch → an uncaught throw blanks the whole frame). Run the qml6 no-try/catch sweep.
- SIGNED-shift index bug class: use >>> (unsigned) when a hash indexes a palette/array (the drawSmokers
  crash). Guard string-array indexes (drawPerson-style default).
- Perf: KDE 3-canvas @15fps, composite-bound. Interiors/retail add per-window/per-frontage cost — keep
  night interiors QUAL-tiered + culled to on-screen near-layer; precompute per-building where possible.
- Freeze-safe: anything static per life computed once (like the window arrays).
- grep top-level fn/var names before adding (collision lesson: drawStadium/drawPark/drawCityPark).
- NO sound.

## Phases (build + verify incrementally; ONE release v1.9)
- B0  branch + this doc + a BUILDING HARNESS (kde-repro probe/param to render a chosen district/type
      big for fast iteration; FORCE hooks for building type/material/era if useful).
- B1  STRUCTURAL REALISM: tripartite facades (base/shaft/cap), a distinct taller GROUND FLOOR, real
      cornices/parapets, material system (brick/stone/glass/terracotta/concrete) by district+era with
      proper shading (mortar coursing, spandrels, piers), better setbacks. Upgrade drawLayer + drawCrown.
- B2  GROUND-FLOOR RETAIL: every near-layer street frontage = a storefront (awning, hanging/box sign,
      display window w/ goods, lit doorway; night glow). Storefront kinds cafe/diner/grocer/bar/book/
      boutique/pharmacy; deterministic per building. Reads as a real commercial street.
- B3  BUILDING TYPES BY FUNCTION: recognizable forms + signage — bank (columns), theater/cinema
      (marquee), hotel (canopy + vertical sign), hospital (cross + wings), school, museum (portico),
      department store, office tower, apartment/tenement/townhouse/walk-up, factory/warehouse. Assign
      by district; label where fitting. Extend the type system (b.use).
- B4  LIVING INTERIORS (Nick's ask): at night some windows are LIT ROOMS with people SILHOUETTES —
      offices (desk/standing figures), apartments/homes (lamp glow, a figure, TV flicker), the rare
      OPEN window showing a room; slow deterministic motion (a figure crosses, sits). QUAL-tiered,
      near-layer, culled.
- B5  VARIETY + DISTRICT IDENTITY: more window layouts + crowns + materials; each district reads
      distinctly (oldtown brick low-rise, downtown glass towers, residential brownstone rows,
      entertainment neon-on-real-forms, industrial sheds/stacks/silos). More residential + industrial
      building gen. Ensure "all functional / no dead facades."
- B6  sync ×4 + md5 + full render matrix (each district day+night, each new type, interiors, growth
      stages, apoc/disaster over new buildings) + qml6 no-try/catch sweep + perf; both-platform gate
      → merge → bump 1.9.0 → tag.

## FINDING (2026-07-17, before B1): drawLayer ALREADY has real structural realism — per-tier cornices
## (~3413), sun/shadow side-shading (~3405), brick coursing + clapboard (~3400), stone quoins (~3418),
## grime/weathering (~3423), ground shadows (~3430), and a D6 ground-floor storefront system (~3567).
## So B1's "structural realism" is largely PRESENT. The real gap to "bright crisp detailed / complete
## beauty" is: (1) COLOR VIBRANCY — buildings skew grey; want saturated varied materials (warm brick,
## cream stone, coloured/painted facades, richer glass); (2) WINDOW crispness/density — sparse faint
## dots → clean readable grids; (3) more VARIETY + per-district POP. Vibe LOCKED = "Bright crisp
## detailed" (clean colourful daytime, crisp readable detail, orderly+vibrant). Best executed as a
## TIGHT feedback loop with Nick (render → he reacts → tune), since "beauty" is subjective. Reorder B1
## toward COLOUR+WINDOWS first (highest visible impact), then the structural extras.

## STATUS  ⟵ UPDATE AS EXECUTED
- [ ] B0 branch + plan + harness
- [ ] B1 structural realism (facades/materials/cornices/ground floor)
- [ ] B2 ground-floor retail storefronts
- [ ] B3 building types by function + signage
- [ ] B4 living interiors (people in lit windows at night)
- [ ] B5 variety + district identity + more residential/industrial
- [ ] B6 verify + both-platform gate → ship v1.9.0
