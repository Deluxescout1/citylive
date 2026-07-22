## Verdict

Design direction is sound, but don’t call `peopleRoster()` from `regimeState()` or mutate `office`. Add one narrow citizen-sim selector, then overlay `{leaderPid, leaderCitizenName, leaderTitle, leaderName, leaderJob}` onto the otherwise unchanged regime object.

## P0

- **Stable identity cannot be selected from current `cy`.** Requiring “currently living adult” would let the leader change or disappear as deaths occur. Bind at the fixed takeover boundary `REGIME_STAGES[0]`, returning the same PID for stages 1–6. [web/city.js:11357](/home/deluxescout/CityLive/web/city.js:11357), [web/city.js:11397](/home/deluxescout/CityLive/web/city.js:11397)

- **Do not implement via `peopleRoster()` inside `regimeState()`.** It materializes, deduplicates, sorts, and calculates Gini, while also advancing/rewinding the shared sim cache. `regimeState()` is called independently by `mayorState`, Almanac, and every frame; this creates needless folds and order-sensitive performance. [web/city.js:7923](/home/deluxescout/CityLive/web/city.js:7923), [web/city.js:7963](/home/deluxescout/CityLive/web/city.js:7963), [web/city.js:11649](/home/deluxescout/CityLive/web/city.js:11649), [web/city.js:11790](/home/deluxescout/CityLive/web/city.js:11790)

- **Preserve `FORCEREGIME` verbatim.** Its early return may lack PID/title fields; all new consumers need graceful fallback. [web/city.js:11370](/home/deluxescout/CityLive/web/city.js:11370), [web/city.js:11373](/home/deluxescout/CityLive/web/city.js:11373)

## Six answers

1. **Yes, with a strict dependency direction.** Implement `peopleRegimeLeader(li, anchorCy, endCy)` beside `peopleElectionState`, using sim internals directly and returning a fresh projection. `regimeState → peopleRegimeLeader → P_fold/P_sim primitives`; never `peopleRoster → regimeState`, and never elections deciding the regime. This preserves SOL’s isolated override.

2. **Key by life plus the fixed regime anchor, not current `cy`.** Use `li` and `REGIME_STAGES[0]`/`cyStart`; `cyStart` is presently constant, but including its quantized tick makes future schedule changes explicit. Select deterministically from citizens adult and alive at the rise. Prefer a candidate also alive at `cyEnd`; otherwise retain the bound PID/name even if later deceased—never repick. Score with existing stable fields; don’t invent “ambition/conviction” unless those traits are added canonically.

3. **Badge in the UI projection, not sim office.** `office` already means council/mayor and drives roster sorting. [web/city.js:7941](/home/deluxescout/CityLive/web/city.js:7941), [web/city.js:7972](/home/deluxescout/CityLive/web/city.js:7972)  
   Have the overlay obtain `regimeState(now)` once, compare `leaderPid` while rendering, and show `RULER`/`RINGLEADER`. This avoids cycles and preserves election semantics. Update both card and inspect paths. [web/citizens-overlay.js:57](/home/deluxescout/CityLive/web/citizens-overlay.js:57), [web/citizens-overlay.js:113](/home/deluxescout/CityLive/web/citizens-overlay.js:113)

4. **Same PID mechanism; theme-specific title only.** Bills remains distinct from ordinary `curBills` gameday: only an active regime gets a ringleader. Keep Bills titles, but retire `REGIME_BILLS_NAMES` only as the normal fallback pool. `BILLS_EVENT` must receive the citizen overlay too. [web/city.js:11380](/home/deluxescout/CityLive/web/city.js:11380), [web/city.js:11889](/home/deluxescout/CityLive/web/city.js:11889)

5. **Show both, explicitly labeled.** Citizens summary should say `RULER <citizen>` and `DEPOSED MAYOR <mayor>` from stage 2 onward; do not overwrite the roster’s democratic mayor office. Rendering may continue using `mayorState`’s isolated regime overlay because existing civic consumers expect the effective ruler there. [web/city.js:11647](/home/deluxescout/CityLive/web/city.js:11647), [web/citizens-overlay.js:82](/home/deluxescout/CityLive/web/citizens-overlay.js:82)  
   Add `leaderPid` to `M` when overridden so identity survives downstream.

6. **Use separate display fields to control length.** Keep:

   - `leaderCitizenName`: `FIRST LAST`
   - `leaderTitle`: `CHANCELLOR`
   - `leaderName`: `CHANCELLOR FIRST LAST` for ticker/Chronicle compatibility

   The HUD does not currently show the leader, so no bezel change is needed. Rally/parade consume no name. Actual name consumers are regime ticker, mayor override, Almanac, and Chronicle. [web/city.js:11525](/home/deluxescout/CityLive/web/city.js:11525), [web/city.js:11651](/home/deluxescout/CityLive/web/city.js:11651), [web/city.js:11806](/home/deluxescout/CityLive/web/city.js:11806), [web/city.js:11885](/home/deluxescout/CityLive/web/city.js:11885)  
   Long ticker strings are acceptable scrolling content; cards and summaries should use the untitled citizen name.

## P1 / least-fragile implementation order

1. Add the narrow selector and fixed-boundary survival/stability tests.
2. Overlay fields in both normal and `BILLS_EVENT` regime returns; preserve abstract fallbacks.
3. Propagate PID through `mayorState`, Almanac, and Chronicle.
4. Add UI-only ruler/deposed-mayor badges.
5. Extend `regime-diff` to assert PID and name stability across every stage, frozen/rewound clocks, both themes, and forced-regime fallback.
6. Synchronize all four identical engine copies and both identical overlays; they are currently byte-identical.