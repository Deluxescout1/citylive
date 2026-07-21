## Verdict

Do not implement approach (a) as written. Sampling the sim’s current mayor lets the name change every 0.10 life while the engine term lasts 0.18 life. It cannot guarantee HUD = Citizens = Chronicle.

### Open questions

1. **Cadence:** unify clocks. Keep engine `TERM=0.18`; change citizen elections to the corresponding 162-tick boundaries. Store each election result. Sampling alone is unsound.

2. **Parties:** retain `PARTIES` and map citizen indices directly:

   `0→BUILDERS, 1→GREENS, 2→SAFETY, 3→TRANSIT`

   Change citizen display labels to match. Do not introduce coalitions yet.

3. **Vote tally:** expose a copied `votes[4]`, `totalVotes`, winner/runner-up PID and party from the election record. Determinism is fine; counting already occurs. Never recompute the runner-up from the current population.

4. **Full names:** ticker/news/Chronicle accept them. Chronicle permits 80 characters ([chronicle-store.js:13](/home/deluxescout/CityLive/desktop/chronicle-store.js:13)). Fix these display assumptions:

   - HUD merely drops `"MAYOR "` and can still overflow: [city.js:3339](/home/deluxescout/CityLive/desktop/renderer/city.js:3339)
   - Billboard width can grow excessively: [city.js:11811](/home/deluxescout/CityLive/desktop/renderer/city.js:11811)
   - Poll uses the first four characters of the first name, causing collisions: [city.js:11821](/home/deluxescout/CityLive/desktop/renderer/city.js:11821)
   - Existing smoke test rejects deduped middle initials: [visual-smoke.test.js:89](/home/deluxescout/CityLive/desktop/test/visual-smoke.test.js:89)

5. **Freeze/bezel:** `mayorState` may call the sim only with explicit `(lifeIndex, cy)`. `peopleRoster(now)` alone resolves to tick zero because missing `cy` is clamped: [city.js:7890](/home/deluxescout/CityLive/desktop/renderer/city.js:7890), [city.js:7933](/home/deluxescout/CityLive/desktop/renderer/city.js:7933). Prefer a narrow `peopleElectionState(li, term)` API over constructing/sorting the whole roster.

6. **Stage 5:** keep election parties minimal. Add extensibility fields such as `kind`, `leaderPid`, and `label`, but do not merge THE ORDER/Bills into democratic tallies. The existing regime override is isolated and should remain so: [city.js:11535](/home/deluxescout/CityLive/desktop/renderer/city.js:11535).

## Risks

**P0**

- Dual cadence guarantees mid-term identity disagreement: `P_ELECT_EVERY=90` versus 162 ticks per engine term ([city.js:7651](/home/deluxescout/CityLive/desktop/renderer/city.js:7651), [city.js:11217](/home/deluxescout/CityLive/desktop/renderer/city.js:11217)).
- Recall swaps the displayed mayor only; citizen `office=2` remains on the recalled person ([city.js:11523](/home/deluxescout/CityLive/desktop/renderer/city.js:11523), [city.js:7861](/home/deluxescout/CityLive/desktop/renderer/city.js:7861)).
- Mayor is projected separately after name deduplication, so Citizens and HUD can disagree on duplicate names ([city.js:7940](/home/deluxescout/CityLive/desktop/renderer/city.js:7940), [city.js:7941](/home/deluxescout/CityLive/desktop/renderer/city.js:7941)).
- `partyLegacy()` still hashes fictional winners, producing scenery inconsistent with real elections: [city.js:11223](/home/deluxescout/CityLive/desktop/renderer/city.js:11223).

**P1**

- The tally is discarded after each election: [city.js:7788](/home/deluxescout/CityLive/desktop/renderer/city.js:7788), [city.js:7857](/home/deluxescout/CityLive/desktop/renderer/city.js:7857).
- Mayor death immediately empties the office with no succession: [city.js:7854](/home/deluxescout/CityLive/desktop/renderer/city.js:7854).
- Biasing scandal from `approvalNow()` would violate purity because approval reads live globals. Crimes are safe; “low approval” needs a new pure election approval input.
- The single mutable cache rewinds/refolds for arbitrary historical calls; calling it from HUD/almanac can cause avoidable full-life folds: [city.js:7893](/home/deluxescout/CityLive/desktop/renderer/city.js:7893).
- Economy, crime, ticker, war funding and policy code depend on stable `.k`; relabeling parties would silently alter behavior, e.g. [city.js:6200](/home/deluxescout/CityLive/desktop/renderer/city.js:6200), [city.js:14520](/home/deluxescout/CityLive/desktop/renderer/city.js:14520).

## Least-fragile path

1. Introduce one pure election-record helper keyed by `(life, engineTerm)`.
2. Make the citizen sim elect only when that engine term changes; persist winner, runner-up, tally and PID/gen.
3. Model recall/succession in that same record and update both citizens’ `office` values.
4. Have `mayorState` overlay only identity, parties and share onto its existing drama object; preserve every field and `FORCEELECT`.
5. Make `partyLegacy()` consume recorded winning parties.
6. Add PID fields to Chronicle snapshots while retaining names for backward compatibility.
7. Fix bounded-name rendering and loosen the full-name test.
8. Apply the identical generated `city.js` change to desktop, web, phone and KDE, then byte-compare all four copies.

This preserves the current HUD/ticker/news/almanac/Chronicle contracts and all `.k`-based effects while establishing one political truth.