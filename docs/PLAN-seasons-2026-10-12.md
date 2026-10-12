# PLAN — continuous seasons v4.1.2 (2026-10-12)

Goal: green → fall gold → dead winter TRANSITION (no hard month flips), visible on every applicable land.

- seasonInfo (3094) rewrite: keep {name,canopy,bare,blossom} + month boundaries; ADD fallT/bareT/greenT/blossomT ramps (day-of-year, smoothstep). Anchors byte-exact: Jul 15=summer, Oct 15=autumn, Jan=dead/bare.
- drawTree (27741): per-tree staggered shed via hash(seed) < bareT (bare branch path = today's winter path); blossom sprinkle × blossomT.
- drawBiomePlant: larch + grass (+ cypress rust?) blend by fallT/bareT instead of binary season_autumn_ok.
- Drifters 65596 + leaf piles ~1874: key on fallT/bareT windows (fade, no pop).
- Steppe (~3945): add lone cottonwood; savanna acacia stays green by design; skip dunes/salt/arctic/volcano/hell/heaven/under.
- New test desktop/test/seasons.test.js: 366-day sweep (anchors + smoothness), Nov stagger monotonic on leaf, per-land Oct gold presence, determinism double-render.
- Release: separate version commit → 4.1.2 (package.json + metadata.json), docs/RELEASE-v4.1.2.md.

DONE: feature committed; v4.1.2 committed; push pending device-flow → push main+tags (commits ad1257c, c6f3923 + tag v4.1.1).
After push: memory notes [[citylive-mountain-lines]]; Nick's visual verdict on seasons.