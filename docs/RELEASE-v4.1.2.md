# v4.1.2 — THE YEAR GETS ITS MIDDLES

**Feature release.** Nick, 2026-10-12: "between the seasons of Spring and Winter, each map should
transition from fully green to the colors of fall, to then everything is dead. Perhaps every map
needs some trees (if it applies) so we can have that effect on every map."

## What the engine had

`seasonInfo` ran four hard month flips for the project's whole life: a canopy fully green on
Aug 31, fully gold on Sep 1, still gold on Nov 30, bare on Dec 1. Four palettes, zero travel —
nobody ever watched a tree change. The four anchor palettes were themselves good (and stay
byte-exact — nobody's shipped look moves); it was the middle of the year that was missing.

## What changed

1. **The year is continuous.** `seasonInfo` keeps `{name, canopy, bare, blossom}` and every calendar
   flag boundary exactly (festivals, seed heads, field palettes, a dozen gates hang off those and
   shifting them moves four of them), but adds day-of-year ramps, smoothstepped, one window table:
   `greenT` (Mar 18 → Apr 18: dead grey → spring green), `deepenT` (Apr 25 → May 20: spring
   green → deep summer green), `fallT` (Aug 10 → Oct 5: green → gold — "the colors of fall" as a
   six-week burn), `bareT` (Nov 10 → Nov 30: gold → dead brown AND the leaf-drop wave), `blossomT`
   (Mar 22 → Apr 6 in, gone by May 12). All mixing happens once per frame in `seasonInfo`; the
   draw calls never mix. First cut mixed whole 3×3 palette MATRICES with `mixc` and painted every
   canopy black — the lesson is written beside the fix.
2. **The leaf-drop is a wave.** `drawTree`'s generic woods now shed tree by tree through bareT —
   a hash of each tree's seed, so the same tree always drops the same day on all three monitors.
   The bare-branch path is today's winter path, untouched; at Dec 1 the flag takes whatever the
   wave hasn't got. The stagger lives in drawTree ONLY — `season_bare_ok` (the saguaro/gorse bloom
   gate) never sees it, or saguaros bloom in November. Blossom sprinkles scale by blossomT: petals
   arrive as a wave, never at the Mar 1 flag flip.
3. **The deciduous follows.** In `drawBiomePlant`: the LARCH follows the ramp and (bug of its own)
   now actually drops in winter — the old switch (`||bare`) had kept it gold through December; the
   CYPRESS goes bald-wildfire rust through the fall, which is what real bald cypresses do; the
   COTTONWOOD's crown and the WILLOW's weeping strands ride the ramp; GRASS greens in spring,
   greens up summer, goes tan through the fall, dead by winter — on every land that has grass, so
   even the near-treeless lands (the steppes, the badlands) visibly season.
4. **The drifts follow.** Falling leaves open with fallT (Aug 10) and ride the drop wave to Dec 1
   (the old key was `name==="autumn"`: gold leaves on Sept 1 while the canopies were still green);
   petals move with blossomT, not the Mar 1 flag.
5. **Coverage.** Audit of all ~30 lands against their `flora.kinds`: every land that can plausibly
   host seasonal trees already carries at least one canopy-following kind (karst: willow and
   cottonwood; fjord: the larch; dam: willow; gorge: cottonwood and willow; bayou: cypress and
   willow; the alpine leaf lands: the larch; the sprawl: street trees; the park: its own). Nothing
   needed planting; what was needed was making the right kinds respond. **On purpose evergreen:**
   the savanna's acacias, sea-cliff pines, spruces, palms, saguaros, lichen, fungus — skip-list in
   `seasons.test.js`.
6. **Tests.** `seasons.test.js` (4 tests): anchors byte-exact at Jul 15/Oct 15/Jan; the whole year
   sweeps smooth (≤25 channels day-over-day, month boundaries included) — with the three realms of
   the vm harness handled: build assertion rows with test-realm literals, sandbox arrays fail
   deepStrictEqual's prototype check; the drop waves (40 seeds, monotone, partial at Nov 14, total
   by Dec 5); per-land kind coverage; purity of the model. 248 pass, 1 pre-existing failure
   (fireflies/leaf, fails identically on the pristine committed engine).

## Not done here (deliberate)

Fields/festivals still key on the month FLAGS — a pop at Mar 1/Sep 1 in the meadow bloom mixes and
harvest seedheads remains, small and calendar-like (festivals). If Nick wants those ramped too,
it's the same table.