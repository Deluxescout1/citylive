Verdict: **NOT READY** to splice into drawing. Core determinism is sound, but Stage 3 still ignores destruction and has boundary drift. All four `city.js` copies are byte-identical; all 11 tests pass; native full fold is ~6.2 ms at N=175.

### P0/P1

- **P1 — destroyed buildings remain valid citizen destinations.** `buildingStanding()` only checks construction; `nukeHit`/permanent ruins are comments, not code. Citizens will inhabit obliterated buildings. [bind-proto.js:14](/home/deluxescout/CityLive/tools/thepeople-offload/bind-proto.js:14)

- **P1 — “In memoriam” is permanently empty.** Death immediately overwrites the slot, so no canonical dead citizen survives for `peopleRoster().dead`. Both UIs expose a nonfunctional feature. [city.js:7790](/home/deluxescout/CityLive/desktop/renderer/city.js:7790), [city.js:7916](/home/deluxescout/CityLive/desktop/renderer/city.js:7916)

- **P1 — birth statistics always report zero.** `births` is initialized each tick but never incremented when `spec` creates a real child. [city.js:7771](/home/deluxescout/CityLive/desktop/renderer/city.js:7771), [people-core.js:107](/home/deluxescout/CityLive/tools/thepeople-offload/people-core.js:107)

- **P1 — construction predicate is not actually centralized.** Prototype uses strict `>`, while existing render gates contain both `<` and `<=`. At exact completion, some paths draw the building while registry says it is unavailable. [bind-proto.js:13](/home/deluxescout/CityLive/tools/thepeople-offload/bind-proto.js:13), [city.js:3512](/home/deluxescout/CityLive/desktop/renderer/city.js:3512), [city.js:5535](/home/deluxescout/CityLive/desktop/renderer/city.js:5535)

No P0 found. `(idx,gen)` spouse/parent/mayor resolution is safe, living-population denominators are correct, projections are fresh, and default-event cold-fold equals incremental advancement.

### Concrete suggestions

- Preserve a bounded death ledger or remove the Memoriam UI.
- Return whether `P_respawn` produced a child, then increment `econ.births`.
- Make `buildingStanding` consume the same apocalypse/ruin predicate as drawing, including parks where appropriate.
- Replace all relevant build gates with one predicate; decide explicitly whether equality means complete.
- Cache registry with an explicit world identity, not merely `near._peopleReg`; assert invalidation on world rebuild/resize.
- Harden `cy`: non-finite input currently yields an empty, misleading roster rather than a controlled clamp/error. [people-core.js:207](/home/deluxescout/CityLive/tools/thepeople-offload/people-core.js:207)
- The test “index stability” is vacuous: it compares only `idx`, which is assigned directly. The population hash also omits `bornTick`, generations of references, `arrived`, economic state, and building-death state. [people-sim.test.js:109](/home/deluxescout/CityLive/desktop/test/people-sim.test.js:109)
- UI escaping is adequate for current trusted data. Validate `clothes` as a hex color before inserting it into a style attribute. Rendering ~175 cards only on open/filter is acceptable.
- Data passes: 37 unique jobs; building types resolve directly or through declared fallbacks; 140 speech lines, ASCII, maximum 29 characters; names are ASCII and duplicate-free.

### Three most important new tests

1. **Forced lifecycle test:** deterministically force a child birth and death; assert `births > 0`, death ledger contents, parent `(idx,gen)` safety, and no replacement mistaken for the deceased.
2. **Registry destruction/boundary test:** candidates before, exactly at, and after completion plus nuked/ruined states; assert deterministic fallback and `-1` when none stand.
3. **Full-state convergence test:** deep-compare canonical population, `econ`, and `bldgDead` for cold, tickwise, jumps, rewind, and freeze—not a lossy hash.