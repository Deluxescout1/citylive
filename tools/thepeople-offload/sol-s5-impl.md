Implemented Stage 5 end-to-end.

- Added deterministic, fixed-boundary `peopleRegimeLeader()` citizen selection.
- Bound regime leaders by stable PID across stages, frozen clocks, and rewinds.
- Added citizen identity fields to normal and `BILLS_EVENT` regimes.
- Propagated PID through mayor overrides, Almanac, and Chronicle.
- Added UI-only `RULER` / `RINGLEADER` badges and `DEPOSED MAYOR` summary.
- Preserved `FORCEREGIME` verbatim with graceful fallbacks.
- Expanded regime regression coverage for both themes and all required clock scenarios.
- Synchronized all four engine copies and both overlay copies byte-identically.
- No commit or push performed.

Validation:

- `node --check org.citylive.wallpaper/contents/js/city.js` — passed
- `npm run check:engine` — passed
- `cd desktop && npm test` — passed, all 8 test files
- `git diff --check` — passed

Existing untracked `sol-s5-impl*.md` files were left untouched.