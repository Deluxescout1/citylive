You are SOL, implementing Stage 5 of "CityLive — THE PEOPLE" end-to-end in this repo. You have write
access (workspace-write sandbox). IMPLEMENT it fully, run the tests, keep everything in sync. Do NOT
git commit or git push — leave your changes in the working tree for review.

## Task
Make the regime leader (THE ORDER strongman / Bills Mafia ringleader) a REAL named citizen who rises from
the citizen sim, bound by pid, per the design + your own review:
- READ FIRST: tools/thepeople-offload/stage5-design.md and tools/thepeople-offload/sol-s5.md (your review).
- Follow YOUR P1 implementation order (1..6) and honour every P0 in sol-s5.md.

## HARD INVARIANTS (do not violate — the build breaks otherwise)
1. The CANONICAL engine is `org.citylive.wallpaper/contents/js/city.js`. EDIT ONLY THAT FILE for engine
   changes. The paths in your review like `web/city.js:NNNN` are SYNCED COPIES — do not edit them directly.
   After editing the canonical, run `cd desktop && npm run sync:engine` to mirror byte-identically to
   desktop/renderer/city.js, web/city.js, phone/city.js AND web/citizens-overlay.js -> phone/. The overlay
   canonical is `web/citizens-overlay.js`.
2. Everything must be a PURE FUNCTION OF THE OVERRIDE CLOCK (freeze-safe, identical across bezels). No
   Date.now/Math.random in engine logic. QML V4 JS dialect: use `var` only — NO arrow functions, NO
   `const`/`let` in the engine file, NO `Array.prototype.fill`.
3. Do NOT call peopleRoster() inside regimeState() (P0). Add a narrow `peopleRegimeLeader(li,anchorCy,endCy)`
   beside `peopleElectionState` that uses P_sim/P_fold primitives directly and returns a fresh projection.
   Bind identity at the FIXED takeover boundary (never repick as citizens die). Never let elections decide
   the regime, and keep the regime override ISOLATED. Preserve FORCEREGIME verbatim with graceful fallback.
4. Do NOT mutate citizen `office` for the regime (office = council/mayor, drives roster sorting). Badge the
   ruler in the UI projection only: the overlay reads regimeState(now) once and compares leaderPid; show
   RULER/RINGLEADER on the card + inspect card, and "DEPOSED MAYOR <name>" in the summary from stage 2 on.
5. Overlay {leaderPid, leaderCitizenName, leaderTitle, leaderName, leaderJob} onto BOTH the normal regime
   return AND the BILLS_EVENT return; keep abstract fallbacks. Propagate leaderPid onto mayorState's M when
   the regime overrides the mayor, and through Almanac + Chronicle (keep names for back-compat).

## DEFINITION OF DONE (verify before you stop)
- `cd desktop && npm test` passes (currently 57 tests; ADD assertions to `desktop/test/regime-diff.js` or a
  new test: leader PID + name stable across all regime stages, frozen AND rewound clocks, both themes
  order+bills, and the FORCEREGIME fallback path — per your review step 5).
- `npm run sync:engine` run so all 4 city.js copies + both overlays are byte-identical (the test
  `check:engine` enforces this — it must pass).
- `node --check org.citylive.wallpaper/contents/js/city.js` passes.
- Print a short summary of what you changed and the final `npm test` result.
Work now. Do not commit.
