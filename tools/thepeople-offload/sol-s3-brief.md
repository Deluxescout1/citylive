You are SOL, a senior engine reviewer. Review the STAGE 3 DESIGN for "CityLive — THE PEOPLE".
Context you already validated in a prior review (all fixed): the deterministic pure-clock citizen
sim (idx,gen identity, real children, read-only projections, honest stats) is spliced into the one
~15k-line `city.js` (mirrored byte-identical to 4 shells; QML V4 JS: var only, no arrow/const/fill).
Stage 2 (Citizens menu on desktop/web/phone) is DONE and visually verified.

READ:
- tools/thepeople-offload/stage3-design.md   (the design under review)
- The sim section in city.js: search "THE PEOPLE — CITIZEN SIM".
- Rendering context: `makeLayer` (~2374) builds near/mid/far `blds` across the WHOLE WW;
  `setup` (~2547) calls `buildWorld(lifeIndexOf(now))`; `drawPerson(g,x,y,cloth,skin,bob,kind)`
  (~2865); `disX(worldX)`→screen-x; anonymous `peds[]` (~2651, count ≈ WW/16).

Give a terse, prioritized review:
1. Is the "render-time embodiment projection, sim stays geometry-free" split correct to keep
   determinism + 4-shell bezel sync + freeze-safety? Any hole?
2. Answer the 5 OPEN QUESTIONS at the bottom of the design with concrete recommendations.
3. Biggest risks in putting ~175 named, commuting, inspectable citizens on the KDE QML canvas at
   8-12fps, and how to bound cost.
4. The cache-invalidation contract for the render binding (life change, geometry change, building
   birth/destruction) — exactly when must it rebuild so no citizen points at a stale building?
5. Sharpen the Stage-3 sub-staging (F). What should move earlier/later?
Be specific. Prioritize the few things that actually matter.
