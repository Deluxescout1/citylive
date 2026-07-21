You are SOL, a senior reviewer. Do a rigorous, independent review of an in-progress feature for
"CityLive" — an animated pixel-city desktop wallpaper. Output a written review only; DO NOT edit files.

## The goal (the user's own words, condensed)
Biggest update ever: give the city ~150-200 NAMED, unique citizens with jobs, homes, families,
class, personalities and full life-cycles (born/age/marry/kids/career/crime/retire/die/replaced).
They must DRIVE the economy, DECIDE the elections, and BECOME the mayor / the fascist "THE ORDER"
strongman / the Bills-takeover ringleader. Region-aware names. Jobs mapped to real buildings; work
clothes when commuting. Visible class warfare + crime stats. A "TV station" economic readout. A
"Citizens" menu to see everyone (desktop + web + phone), hover/click to inspect on the wallpaper,
speech bubbles only when two citizens actually talk, an opt-in (off-by-default) drag-to-death gag.
MUST work identically on all 4 shells (KDE wallpaper / Electron / web / phone). Bills currently
takes over too often — fix it.

## Hard constraints of this codebase
- The engine is ONE ~15k-line pure-JS file `org.citylive.wallpaper/contents/js/city.js`, drawn to a
  QML Canvas, MIRRORED byte-identical to desktop/renderer, web, phone (checked by sha256; synced via
  `npm run sync:engine`; tested by `npm test`). QML V4 JS: use `var`, no arrow fns, no Array.fill.
- Everything must be a PURE FUNCTION OF THE OVERRIDE CLOCK (`NOWOVR`) so every screen/bezel and the
  freeze-render harness show the SAME city. No saved state on the wallpaper (QML has no filesystem).
  Only the Electron "Chronicle" persists — as a READ-MODEL of past civilizations, never the source.

## What has been built so far (Stages 1-2 core)
Read these to review:
- docs/PLAN-thepeople-v2.0.md   (the full design + decisions + stage plan)
- tools/thepeople-offload/people-core.js   (the sim core, standalone dev copy)
- The spliced section in city.js: search for "THE PEOPLE — CITIZEN SIM" (~line 7635).
- tools/thepeople-offload/jobs.json and names.json (the offloaded data).
Facts: deterministic forward-step sim, folds a full life for N=200 in ~3.9ms, 44/44 tests pass,
mirrored to all 4 shells, elects a real named citizen mayor. Core is currently DORMANT (nothing
draws or calls it yet). Decisions locked: fresh cast each life (no cross-reset dynasties; Chronicle
remembers past mayors), default 150-200 citizens seeded BY INDEX.

## What I want from you
1. VERDICT: is the architecture right to deliver the user's full vision on all 4 shells? Any
   load-bearing flaw (determinism, freeze-safety, the citizens↔economy↔elections↔policy coupling,
   the fold-once-cache, index-stable seeding, the read-only-interaction invariant)?
2. GAPS: what in the user's 30-point vision is NOT yet addressed or is at risk of being lost?
3. CORRECTNESS: skim people-core.js for real bugs, especially anything that could differ between a
   cold fold and an incremental advance (that would desync screens), or O(N^2) hotspots.
4. PLAN CRITIQUE: sharpen the remaining stage order (Citizens menu → homes/commute/clothing+inspect
   → elections/economy TV → rewire THE ORDER/Bills). What should move earlier/later? What's missing?
5. VERIFICATION PLAN: concrete headless + visual checks per stage that would catch regressions,
   given the freeze-render + 4-shell-parity constraints.
Be specific and terse. Prioritize the few things that actually matter.
