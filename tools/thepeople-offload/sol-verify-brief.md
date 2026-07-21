You are SOL, senior reviewer. VERIFY the current state of "CityLive — THE PEOPLE" (v2.0) end-to-end
and give a PRIORITIZED punch-list: real bugs first (P0/P1), then concrete suggestions. Be terse.
Do NOT edit files.

Context: deterministic pure-clock citizen sim spliced into the one ~15k-line `city.js` (mirrored
byte-identical to desktop/web/phone; QML V4 JS = var only, no arrow/const/fill). Stage 2 (Citizens
menu) done on all 3 shells. Stage 3 = putting named citizens on the wallpaper; the building-registry
module is prototyped + headless-tested (not yet spliced or drawn).

READ + VERIFY:
- The sim in city.js: search "THE PEOPLE — CITIZEN SIM". Check identity (idx,gen) safety, real
  children/parentage, read-only projections, honest living-pop stats, cache key/invalidation, and
  that cold-fold == incremental advance (freeze safety). Look for any remaining NaN/edge bug.
- tools/thepeople-offload/people-core.js  (dev copy of the same sim — should match the splice)
- tools/thepeople-offload/bind-proto.js   (Stage-3 registry: buildingBuilt/buildingStanding, bldUse,
  peopleBuildRegistry, rendezvous peoplePick, peopleHomeWork). Verify: bezel-sync (same WW/KSP),
  determinism, graceful reroute on destruction, and the central birth predicate vs the engine's
  existing `<` / `<=` drift. Any hole before I splice it into the draw path?
- desktop/test/people-sim.test.js  (11 contract tests) — are the assertions actually strong, or do
  any pass vacuously / miss a failure mode? Suggest missing tests.
- desktop/renderer/settings.html (Citizens tab) + web/citizens-overlay.js (web/phone overlay) — any
  correctness/XSS/perf issue in how they consume peopleRoster?
- jobs.json / names.json / speech.json (offloaded data) — validate ranges (speech <=32 chars ASCII?
  job building types valid?).

Deliver: (1) VERDICT ready/not-ready to proceed to drawing embodiment; (2) P0/P1 bugs with file:line;
(3) top concrete suggestions; (4) the 3 most important NEW tests to add. Prioritize what matters.
