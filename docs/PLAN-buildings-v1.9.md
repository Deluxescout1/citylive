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

## REFERENCE IMAGES (Nick dropped 2 in ~/Nextcloud/Desktop, 2026-07-17): analyzed.
## (a) "8-bit-graphics-pixels-scene-with-city-night.jpg" — dense NYC night skyline: buildings are
##     DENSE COLOURFUL LIT-WINDOW GRIDS (warm amber/cool white/cyan/pink) on deep-blue silhouettes;
##     windows are the visual STAR; varied crowns (WTC-style spire, art-deco tops, setbacks, water
##     towers); water reflections; layered atmospheric depth. (b) "1000_F_591796166_...jpg" — dusk
##     skyline w/ gorgeous COLOUR-GRADED DEPTH: near buildings dark teal/green w/ warm lit windows,
##     midground purple, FAR buildings fade to pink/salmon sunset haze; buildings have DISTINCT MATERIAL
##     COLOURS (green glass / teal / pink, NOT grey); densely packed variety; crisp clean readable pixels.
## THROUGH-LINE (the target): (1) FAR denser windows (grids covering facades) — our #1 gap vs the sparse
## current dots; (2) per-building COLOUR IDENTITY (saturated materials, not uniform grey); (3) stronger
## COLOUR-GRADED atmospheric depth (far layers tint hard toward the sky/sunset colour); (4) crisp lit
## windows warm+cool at night. Keep our variety + hustle/bustle. Vibe "bright crisp detailed" ✓ fits.

## HIGH-CLASS DECISIONS (Nick 2026-07-17, "I want this to look high class", AskUserQuestion):
## - DETAIL = BOLD & CRISP: strong readable floor lines, piers, WINDOW FRAMES, cornices, setbacks —
##   sharp/architectural, readable at any zoom. Push the articulation HARDER (bolder than the first pass).
## - GLASS = REFLECTIVE: glass towers MIRROR the sky-gradient by day, warm SUNSET at dusk, city GLOW at
##   night + a diagonal sheen streak. The premium "real render" look (ref #2 green-glass, ref #1 lit glass).
## - LANDMARKS = YES, HERO TOWERS: a few signature buildings per city (art-deco crowns, a spire tower like
##   ref #1's WTC, tapered/twisted forms, ornate caps) anchoring the skyline as focal points.
## - PRIORITY = ALL times equally polished (day + dusk color-grade + lit night).
## EXECUTION ORDER (max high-class impact): reflective glass + bolder articulation + window frames FIRST,
## then material colour identity (colourful AND restrained range), then hero towers, then colour-graded depth.

## B1 EXECUTION LOG (render→react loop with Nick)
## - 1: DENSER window grids (all 5 layouts tightened). 2: FACADE ARTICULATION (floor/spandrel lines + piers).
## - 3: REFLECTIVE GLASS (b.glass flag on corp/ribbon towers, not brick/clap) — body mirrors sky(day)/
##   sunset(dusk)/city-glow(night) via a vertical gradient + a 1px sheen streak. Reads strongest at night.
## - 4: BOLDER articulation (alphas up ~0.11→0.16 etc) for the "high class / bold & crisp" ask.
## - 5: DAYTIME WINDOW FIX (advisor's key call): the day flatness was RENDER not density (night was already
##   dense from the SAME array). Rewrote the day path (near+mid) → every window a CRISP RECESSED PANE:
##   cool glass inset (darker than facade) + 1px lit top edge (sky) + 1px sill shadow; dusk warms the glass.
##   Result: brown residential + grey office towers now read as real gridded glass facades. Perf 7.0→8.4ms
##   (budget 66). VERIFIED: kde-repro day/dusk/night triplet + tight zoom + perf probe. Node -c + sync ×4 OK.
## - OPEN: a few WIDE-SPACED "corp" setback towers are genuinely sparse-by-generation (few big windows) — look
##   flat even with the render fix. Decide with Nick whether those want a secondary light-window pass (risk:
##   over-busy) or stay as intentional big-corporate glazing. Show Nick the triplet + tight zoom → react.
## - 6: MATERIAL COLOUR IDENTITY (the reference's #2 through-line). Root cause of the grey/tan wash: BLDBASE is
##   all dark night-silhouette purples, and the daytime `col` just brightened them with a cool-blue additive
##   offset → lavender-grey for every building. Added DAYMAT{} (a restrained saturated material palette per
##   district: brick red/terracotta/sandstone · green/blue/bronze glass · brownstone/pastel/sage · concrete/
##   rust) + dayMatFor(district,seed); b.dayMat assigned per building (NE region keeps its colonial palette);
##   blended into `col` by DAYLIGHT ONLY (0.6*dayLit) so the moody night silhouette is untouched. Determinism-
##   safe (adds zero r() calls → positions byte-identical). Result: distinct pink/green/red/cream/teal
##   buildings by day — a real colourful city, not grey. VERIFIED: kde-repro day/dusk/night + perf 9.6ms +
##   QML no-try/catch sweep (34 conditions incl. all finales) SWEEP_OK. Show Nick → react (too saturated?).
##
## BLEND + ROOFS (Nick 2026-07-17, AskUserQuestion): CRITICAL FINDING — the wallpaper ADAPTS architecture to
## location, and Norwich CT → REGION="newengland" → the whole city was reskinned colonial (NE_WALLS brick/
## cream/sage walls + gable/gambrel/hip PITCHED roofs on everything bh<54). That's why (a) roofs all looked
## the same, and (b) my dayMat + hero work was BYPASSED at Nick's actual location (gated off for NE). The
## colour in earlier renders came from NE_WALLS, not dayMat — so those two commits were effectively unverified
## on Nick's machine until now.
## Nick's decisions: LOOK = "BLEND BOTH" (NE low-rise character around a MODERN downtown of glass towers +
## landmarks). ROOFS = ALL FOUR upgrades (more shapes · varied colours/materials · rooftop details · modern
## crowns on tall ones).
## - STEP A DONE (blend): neColonial = (NE && district≠downtown && ≠entertainment) — the colonial reskin +
##   pitched roofs now apply to the TOWN districts only; downtown+entertainment stay a modern glass core with
##   dayMat + heroes + varied modern crowns EVEN in New England. hero gate dropped its REGION!=="newengland"
##   check (downtown is modern everywhere). NOTE: exempting downtown/entertainment removes one r() call for
##   those buildings → the city layout INTENTIONALLY re-rolls (expected for this look change). Heroes are
##   mid/far-layer background giants (near downtown caps below the 62*KSP hero height) and rise LAST (high
##   bAge) — verified via new ?probe=hero. Downtown now shows glass towers + deco/blade/step/mansard/antenna/
##   pagoda crowns + gilded-cornice heroes; night = a real neon metropolis. SWEEP_OK 34, perf 9.2ms.
## - STEP B DONE (roof COLOUR): every NE pitched roof mixed toward the SAME slate → root cause. Added ROOFMAT
##   palette (slate/copper-green/red-shingle/cedar/tar/tin/aged, 12) + roofMatFor(bseed); b.roofMat threaded
##   into drawCrown for the roof mass + sunlit slope. No two roofs the same colour now.
## - STEP C DONE (roof SHAPES): NE selection expanded gable/gambrel/hip → +saltbox (asymmetric ridge + chimney)
##   +mansard (Second Empire, now roofMat-coloured w/ dormers) = 5 distinct pitched shapes. Verified each via
##   new FORCECROWN hook (?crown=).
## - STEP D (rooftop DETAILS) partial: chimneys now on gable/gambrel/hip/saltbox; mansard dormers; steeple
##   weathervane. TODO more: cupolas, roof water tanks on colonial, varied dormer counts.
## - Verified: forced saltbox/mansard renders + natural town/oldtown mix + qml sweep (34) SWEEP_OK + perf ~9ms.
##   Harness hooks now: ?layout= (FORCELAYOUT), ?crown= (FORCECROWN), ?probe=hero.
##
## STATUS  ⟵ UPDATE AS EXECUTED
- [ ] B0 branch + plan + harness
- [~] B1 structural realism — glass+articulation+DAY WINDOW PANES done; corp-sparse case + material colour TBD
- [ ] B2 ground-floor retail storefronts
- [ ] B3 building types by function + signage
- [ ] B4 living interiors (people in lit windows at night)
- [ ] B5 variety + district identity + more residential/industrial
- [ ] B6 verify + both-platform gate → ship v1.9.0
