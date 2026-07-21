## VERDICT

**Architecture: promising, but not ready to build UI on.** The fixed-tick forward fold, life-clock basis, bounded cache, and byte-identical engine strategy are the right foundation. I independently confirmed all four engine copies currently have the same SHA-256, and cold-fold versus incremental advance produced identical serialized state at tick 700.

However, four load-bearing contracts are unfinished:

1. **The spliced economy is currently broken.** Inlined jobs use `klass`, while `P_make()` reads `J.class`. This makes wealth and GDP `NaN`; at tick 700 I observed `gdp: NaN`, `avgWealth: NaN`, and 99.4% poor. See [city.js](/home/deluxescout/CityLive/org.citylive.wallpaper/contents/js/city.js:7653) versus [city.js](/home/deluxescout/CityLive/org.citylive.wallpaper/contents/js/city.js:7719). The standalone JSON uses `class`, which hides this splice-specific failure.

2. **Roster slots are confused with citizen identity.** `idx` survives replacement while `gen` changes the person. Spouses and mayor references store only the slot index. When someone dies, those references can silently point to an unrelated replacement. A dead mayor can therefore “become” a newborn until the next election. Relationships and offices need a stable identity such as `(idx, gen)` and explicit death cleanup.

3. **The read-only invariant is not enforced.** `citizenPublic()` is safe, but `peopleSim()` returns the mutable cached population and economy directly. Any menu, inspector, or drag handler can mutate canonical state. Expose projections/query functions, not `P_cache`.

4. **The core is not yet coupled to the real city.** Employers/homes are arbitrary `0..59` placeholders; events are synthetic; policies never feed the next tick; votes are merely party counts. Calling this “citizens drive the economy/elections” is premature.

The cache also needs its complete input identity: population count, region/location, model/data version, and event/policy adapter. `applyConfig()` currently changes `PEOPLE_N` or `REGION` without invalidating it.

## CORRECTNESS FINDINGS

Priority order:

- **P0 — `class`/`klass` splice mismatch:** produces `NaN` economic state as described above. Current tests did not catch it.
- **P0 — stale identity references:** spouse and mayor indexes survive slot replacement incorrectly. See [people-core.js](/home/deluxescout/CityLive/tools/thepeople-offload/people-core.js:83), [people-core.js](/home/deluxescout/CityLive/tools/thepeople-offload/people-core.js:107), and [people-core.js](/home/deluxescout/CityLive/tools/thepeople-offload/people-core.js:133).
- **P0 — children are fictional:** births only increment counters. Replacements are always age-zero strangers, despite the comment claiming adult newcomers. No child is connected to parents or promoted into a roster slot.
- **P1 — names are not unique:** life 1 at N=175 had only 165 unique names, including ten duplicate pairs. “Named, unique citizens” needs deterministic collision resolution.
- **P1 — index stability is partial:** names are N-stable, but founder status uses `i < PEOPLE_N*0.55`; changing N changes the arrival history of existing indexes. Seed all trajectory decisions solely from index/life.
- **P1 — bad denominators/stat semantics:** GDP/wealth exclude deaths and not-yet-arrived citizens but divide by total capacity `N`. `crimeRate` is only crimes during the current tick; births/deaths are discarded. The TV station needs explicitly defined living-population denominators and cumulative/windowed statistics.
- **P1 — mayor validity:** `econ.mayor` is not cleared immediately on death. Office succession/recall/death must be deterministic events.
- **P1 — noncommuting jobs look unemployed:** `commutes:false` assigns `employer=-1`, so artists/vendors never count as employed and steadily lose wealth.
- **P2 — index-order bias:** crime probability uses the `rich` count accumulated earlier in the same loop. Higher-index citizens see a different inequality signal. Use prior-tick aggregates.
- **P2 — “Gini” is not Gini:** it is a class-count proxy. Rename it or calculate a bounded real coefficient. With 200 citizens, an `O(N log N)` calculation per tick remains cheap.
- **P2 — job/career lifecycle is static:** job never changes, children begin with adult occupations, retirees retain job display labels, and destroyed employers are arbitrary IDs.

There is no meaningful `O(N²)` hotspot today: normal ticks are O(N), elections add O(N), and spouse selection is O(1) per citizen. Do not introduce all-pairs relationship simulation later; use deterministic adjacency lists or fixed-degree candidate probes.

## VISION GAPS

Still absent or materially underspecified:

- Real children, parentage, generations, household composition, inheritance.
- Friendships, rivalries, feuds, partnerships, conversations, and actual interaction events.
- Career changes, promotions, business ownership, housing acquisition, cars versus transit.
- Real map-bound homes/jobs and behavior when a required building does not yet exist or is destroyed.
- Distinct immutable appearance plus separate civilian/work clothing.
- Individual voting by class, policy, personality and lived outcomes; candidates and coalitions.
- Policy feedback into the next tick and named winners/losers from casinos, taxes, disasters, gentrification, etc.
- Scandals, recall, office history, retirement and succession.
- Named strongman/Bills leader emergence from the roster.
- Life-event ledger needed by biographies, follow feed, Chronicle ingestion, speech bubbles and historical menus.
- Search, portraits, relationship display and dead/historical citizens across desktop/web/phone.
- Wallpaper hit-testing, inspection, cosmetic death overlay and accessibility/touch behavior.
- TV station semantics and honest crime/economic measures.
- Region-aware naming beyond the engine’s current two regions (`newengland` and `generic`).
- Android installability and follow-feed behavior.
- A concrete interaction rule ensuring speech bubbles require a shared, simultaneous interaction event.

## PLAN CRITIQUE

Do **not** proceed directly to the Citizens menu. It would harden broken identity and history APIs.

Recommended order:

1. **Core contract gate**
   - Fix schema mismatch.
   - Define `CitizenId = slot + generation`.
   - Define living roster versus historical persons.
   - Add real child/parent/replacement semantics.
   - Define event ledger, aggregate meanings, cache key and invalidation.
   - Enforce read-only public queries.

2. **World-binding gate**
   - Build a deterministic registry of real buildings with stable IDs.
   - Assign valid homes/employers with deterministic fallback during growth/destruction.
   - Add schedule/position state without drawing it yet.

3. **Headless Citizens API, then menus**
   - Build roster, biography, relationship, search and follow-feed projections once their data is genuine.
   - Implement desktop/web/phone consumers against the same serialized contract.

4. **Wallpaper embodiment**
   - Replace the anonymous pedestrian pool.
   - Add schedules, commute routes, clothing, immutable appearance, hit-testing and inspect.
   - Add conversation events before speech bubbles.
   - Add the drag gag last within this stage, strictly as overlay state.

5. **Economy and policy coupling**
   - Citizens generate employment, production, ownership, wealth and crime aggregates.
   - Policy consumes tick-T aggregates and affects tick T+1.
   - Add TV readout after metric semantics are stable.

6. **Elections**
   - Model candidates, per-citizen ballots, changing preferences, terms, death/succession, scandal/recall and mayor history.
   - Replace `mayorState()` rather than operating two political truths.

7. **THE ORDER/Bills**
   - Rewire both through eligible living citizens and the same election/uprising machinery.
   - Fix frequency independently and earlier: the shipped demo override is already off by default, while organic Bills takeovers are roughly 30% of regime arcs. Add a measured cadence test instead of relying on comments.

8. **Chronicle**
   - Consume deterministic event-ledger deltas on Electron only; prove deletion of Chronicle data cannot change current simulation output.

## VERIFICATION PLAN

### Core gate

- Golden hashes for cold fold versus:
  - one-tick incremental advance;
  - irregular jumps;
  - forward, backward, then forward;
  - fresh VM at the same `NOWOVR`.
- Run across multiple lives, N=150/175/200/400, both regions, ticks 0/election/death/900.
- Reject all `NaN`, infinities, invalid job/home/employer IDs and asymmetric relationships.
- Assert every living `(idx,gen)` and display name is unique.
- Assert mayor is living, adult and has matching identity/office.
- Assert raising N preserves every pre-existing citizen’s full trajectory, not merely name.
- Test config changes invalidate/rebuild the cache.
- Mutation test: modify every returned public object and prove a second query is unchanged.
- Performance thresholds on the real inlined engine, not only `people-core.js`.

### Menu/API stage

- Golden JSON snapshots from KDE-engine VM, Electron, web and phone at identical `NOWOVR`.
- Search/filter/sort parity, including deceased citizens and duplicate-looking surnames.
- Narrow-phone viewport, long names, empty/early-city roster, apocalypse and life rollover.
- Chronicle absent/corrupt/cleared must not alter menu data.

### Positional stage

- For every visible citizen: stable identity, valid building, route endpoint and clothing state.
- Freeze-render identical pixels across repeated cold processes.
- Multi-bezel crop test: same world-coordinate citizen appears consistently at seams.
- Day schedule captures home → commute → work → commute → home.
- Building destruction/rebuild tests prevent floating occupants and invalid routes.
- Click/hover/touch selects the intended citizen under scaling and offsets.
- Cosmetic death changes only local pixels/UI; roster hashes remain identical.

### Economy/election stage

- Conservation/invariant checks for living population, employment denominators and wealth.
- Named policy winners/losers reproducible from fresh and incremental folds.
- Recompute every ballot independently and match the announced tally/winner.
- Mayor death, recall, replacement and life rollover tests.
- TV values match raw citizen rollups exactly.
- Statistical sweeps across thousands of lives for class distribution, unemployment, crime, party wins and candidate diversity.

### ORDER/Bills stage

- Every leader resolves to one living citizen identity throughout the arc.
- No simultaneous ordinary mayor and regime leader contradictions.
- Frequency sweep over at least 10,000 lives, with explicit expected bounds for regime and Bills incidence.
- `billsEvent=false` and absent must be equivalent; forced demo behavior tested separately.
- Existing regime visual A/B tests plus frozen frames for rise, seizure, suppression, overthrow and Bills variants.

**Bottom line:** keep the overall deterministic forward-step architecture, but treat the current core as a prototype. Fix identity/history, cache purity, schema validation and real-world binding before exposing it to UI or coupling it to the existing economy and politics.