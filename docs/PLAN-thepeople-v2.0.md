# CityLive v2.0 — "THE PEOPLE" (the biggest update ever)

> **The city becomes its people.** ~100 named, unique citizens with jobs, homes, families,
> class, personalities and full life-cycles. They *drive* the economy, *decide* the elections,
> *become* the mayor (and the strongman, and the Bills ringleader), rise and fall, marry, feud,
> commit crimes, get rich, go broke, and die — and you can watch any one of them across their
> whole life. Every disaster, election and boom bends their stories. This is the master plan.

Status: **DESIGN LOCKED** (2026-07-21). Author: Nick + Claude. Reviewed by advisor.

---

## 0. The prime directive (never break this)

**The citizen simulation is a PURE FUNCTION OF THE OVERRIDE CLOCK.** It is the single source
of truth on **all four shells** (KDE wallpaper / Electron desktop / web / phone) so every screen,
every bezel, and the freeze-render harness (`NOWOVR`, `timelapse.sh`, the diff tests) show the
*same city with the same people*. Nothing about a citizen is ever read from disk to decide what
happens to them.

- **Nick's "a mix" (Q1)** = deterministic backbone (schedules, life trajectories) + deterministic
  *reactions* to city events (which are themselves already pure-clock: disasters, elections,
  economy). It is NOT a saved/persistent simulation. QML has no filesystem — a persistent sim
  can't exist on the wallpaper, and "must work on everything" (Q28) is absolute.
- **The Electron Chronicle is a persisted READ-MODEL only** — a record of past lives/events for
  cross-reset memory + export. It is NEVER the source of truth. The "see everything" Citizens menu
  (Q25) recomputes history *from the clock* on every shell, so wallpaper/web/phone show the same
  history as desktop. Chronicle only lets the desktop *remember past civilizations*.
- **Every user interaction is read-only or cosmetic.** Hover/click inspect = read-only. The
  drag-to-death gag (Q15) is a **local cosmetic overlay that does NOT mutate the roster** — if a
  drop actually killed citizen #47, that screen would diverge from every other screen and from
  freeze-render. Off by default (Nick: don't disturb desktops).

## 0b. Stage 1 timing proof — PASSED (2026-07-21)

Built the real deterministic forward-step sim as a headless node prototype
(`scratchpad/sim-proto.js`) and cold-folded founding→now, 12 reps, deterministic RNG
(no `Math.random`), stable state-hash across reps (freeze-safe confirmed):

| N | steps | cold-fold | vs ~30ms budget |
|---|---|---|---|
| 150 | 780 | **1.24 ms** | 24× under |
| 175 | 780 | **1.38 ms** | 22× under |
| 200 | 780 | **1.59 ms** | 19× under |
| 200 | 1000 | 1.69 ms | 18× under |
| **300** | 1000 | **2.74 ms** | **11× under** |

**Conclusion:** performance is NOT a constraint. 150–200 is locked with enormous headroom;
we could go higher if we ever want. State hashes are stable across reps → deterministic &
freeze-safe as designed.

**Modeling notes the proof surfaced (tuning work for later stages, not perf):**
- **Replacement pipeline required.** With deaths but no replacement, the cast drains to ~0 by
  end of life. Real sim must keep the living cast full via newcomers arriving + newborns aging
  in (Nick Q3 die/retire/replace, Q5 generations). Seed replacements by a rolling id so they're
  still index-stable.
- **Inequality must persist.** In the naive proto wealth only accumulates → nobody stays poor →
  crime=0, unemployment≈0. The real economy needs sticky class (rent, shocks, job scarcity) so
  class-warfare/crime (Q10/Q14/Q23) actually happen.
- Births are currently a counter; they must become **real tracked citizens** entering the cast.

## 0c. Stage 2 sim core — BUILT & PROVEN WITH REAL DATA (2026-07-21)

- **Offload worked.** GameServer LiteLLM generated both datasets in ~50s:
  `tools/thepeople-offload/jobs.json` (**37 jobs**, all building-types valid & in-engine, class
  spread 6/14/11/6 poor→wealthy, all hex/districts valid) + `names.json` (region-aware:
  newengland 51/49, generic 52/47 first/last, deduped/ASCII-clean).
- **Sim core** `tools/thepeople-offload/people-core.js` (QML-safe: var-only, no arrow/const/fill)
  headless-tested against the REAL data: **N=175 folds in 3.4ms, N=200 in 3.9ms**, deterministic
  (stable hashes), **cast stays full** (replacement pipeline), poverty/crime/marriage/elections all
  fire, and **elections elect a real named citizen** (e.g. "ZOE TOWNSEND (PARAMEDIC)" as mayor).
- **Stage-4 tuning noted:** upper class too thin (cost-of-living eats everyone → rich=1); rebalance
  for a visible wealthy class + weight mayoralty toward higher-profile citizens.
- **SPLICED & VERIFIED (2026-07-21).** Core+data (232 lines) inlined into `city.js` after §CIVIC
  CAST, `cfg.people` config read added. Synced to all 4 shells (parity OK), **44/44 tests pass**,
  and `peopleSim` runs INSIDE the real engine (region-aware, full named cast, elects a real mayor —
  e.g. "NICK VAUGHN, MUSEUM GUARD"). Build sources kept in `tools/thepeople-offload/` (jobs.json,
  names.json, people-core.js, insert-block.js — regen the block from these). Core is DORMANT (no
  draw/menu calls it yet), so zero rendering risk. NOT committed (staged only).
- **Next:** read-only "Citizens" menu (desktop Control Center + web dashboard + phone), + a headless
  people-sim regression test in the suite. Then Stage 3 (on-wallpaper) & Stage 4 (economy/election
  tuning: thicken the rich class, weight mayoralty to higher-profile citizens).

## 0d. Core hardened per SOL's review + Citizens menu (desktop) — 2026-07-21

SOL (gpt-5.6-sol via codex) reviewed the whole goal/design/code (read `tools/thepeople-offload/
sol-review.md`). Verdict: architecture right, but harden the core contract BEFORE UI. Done:
- **`class`/`klass` NaN bug fixed** (offload data uses `klass`; core read `J.class` → NaN wealth →
  everyone "poor"). Now a real pyramid: **poor 23% · working 47% · professional 25% · wealthy 5%**.
- **Identity = (idx, gen)** with lazy reference cleanup (dead spouse → widowed; dead mayor → vacancy).
  No more "dead mayor becomes a newborn."
- **Real children**: replacements are births into living couples (inherit surname + parent pids),
  else adult immigrants. Lineages exist within a life.
- **Read-only projections**: consumers call `peopleRoster()`/`peopleStats()` (fresh objects);
  canonical state never escapes. Mutation-proof.
- **Honest stats**: living-population denominators, cumulative crime, a real bounded **Gini**.
- **Capital compounds** above a cushion → a visible wealthy elite + widening gap (class-warfare fuel).
- **Index-stable** founder/arrival (seed from idx+life, not N) — raising N never rewrites anyone.
- **Regression suite** `desktop/test/people-sim.test.js` (11 tests) locks determinism (cold==
  incremental==jumps), no-NaN, identity, purity, class spectrum, index-stability. **Full suite 55/55.**
- Native perf budget still ~6ms/fold@200 (verify-core.js); in-vm test uses a generous O(N²) guard.
- **Citizens menu (desktop Control Center)**: new "Citizens" tab in `settings.html` — searchable
  roster, class filters, in-memoriam view, summary bar (mayor/unemployment/poor-rich/Gini/crime),
  reads `peopleRoster`. Cards show name/job/class/net-worth/family/parents/rap-sheet. JS parses OK.

**STAGE 2 COMPLETE (all 3 surfaces, visually verified):**
- Desktop Control Center "Citizens" tab ✅ (screenshot verified).
- Web + phone shared "Citizens" overlay ✅ — `web/citizens-overlay.js`, mirrored to `phone/` (now in
  `sync:engine`), included after `city.js` in both index.html. Slide-in panel, NOWOVR-aware (mirrors
  the rendered city), same roster/filters/summary. Screenshot verified at phone viewport.
- Offscreen screenshot harnesses: `desktop/tools/shot-cc.js` (Control Center) + `shot-web.js` (web/
  phone) — capture without opening a visible window.

**Stage-3 content pre-generated:** `tools/thepeople-offload/speech.json` — 140 speech-bubble lines
(14 × greet/gossip/economy/politics/weather/work/family/class_rich/class_poor/smalltalk) from the
GameServer, for citizen conversations. Validate ≤32 chars/ASCII when wiring in.

SOL's deferred items → later gates: world-binding (real building registry, Stage 3), event ledger
for biographies/follow-feed, career changes, job/retiree labels.

## 0e. Stage 3 designed + SOL-reviewed + foundation proven — 2026-07-21

- **Design:** `tools/thepeople-offload/stage3-design.md`. **SOL review:** `tools/thepeople-offload/
  sol-s3.md`. Speech content ready: `speech.json` (140 lines).
- **World-binding foundation PROVEN headless** (`bind-proto.js`): every citizen deterministically gets
  a real home+workplace from `near.blds` via `useFor()`/`b.use` (functional type, NOT `b.type` which
  is "tower"/"park"); **100% coverage**, deterministic, and standing-state gates by growth (hamlet→
  few up, metropolis→all up). Fallback chain covers cityhall/docks/corp.
- **SOL's Stage-3 corrections (must-do):**
  1. Registry uses **`b.use`** (functional), not `b.type`. Recompute `useFor` only as fallback.
  2. **Bezel-sync only, NOT cross-shell identity.** Binding is identical across KDE bezels (shared
     WW/KSP) but web/phone (different WW/KSP) legitimately differ. Don't promise cross-form-factor
     address identity (would need a geometry-independent canonical registry — defer).
  3. **Separate immutable binding from dynamic standing.** Give each citizen a **rendezvous-hashed
     ranked candidate list**; each frame pick the first candidate passing ONE shared
     `buildingStanding(b,now)` predicate. If none, hide the citizen (no vague "nearest" fallback).
  4. **Centralize the birth predicate** — engine has both `cityG-bAge < bandOf` and `<=`; canonical
     is `built = bAge===undefined || cityG-bAge > bandOf(b)` (matches line 6232). Fix before embodiment.
  5. **Effective clock everywhere** (NOWOVR-aware); never `Date.now()` in embodiment/bob/speech/hit.
  6. Embodiment = read-only fn of (roster snapshot, registry, effective clock). Cosmetic only in
     Stage 3 — never feed render/apoc geometry back into the pure sim (that's a Stage-4 canonical adapter).
- **SOL's Stage-3 sub-staging (each with tests, KDE in the FIRST gate):**
  1. **Registry correctness** — central `buildingStanding`, stable IDs, `b.use` map, explicit
     policies (houses/parks/docks/cityhall/unborn/ruins/rebuilds) + determinism/freeze/bezel tests.
  2. **Static embodiment** (KDE + all shells) — draw named citizens at valid anchors, spatial cull,
     thin anonymous `peds` by a quality factor (do NOT cap named by prominence — pop-in/bias),
     apoc gates, ≤1ms perf budget (degrade bubbles→density→named).
  3. **Commute** — shortest wrapped world displacement, staggered shifts, clothing transitions,
     freeze tests.
  4. **Hit-test/inspect** — retain a `drawnNamed[]` list `{idx,gen,sx,y,order}` during draw; use the
     exact `disX` used to draw; resolve overlaps containment→dist→order→(idx,gen); click/tap w/o hover.
  5. **Speech** — spatial buckets (not all-pairs), rate-limited, deterministic, quality-gated, 1-2/screen.
  6. **Drag gag** — final optional polish, out of the embodiment gates.

**NEXT:** implement Stage-3 step 1 (registry module: rendezvous candidates + central buildingStanding
+ determinism/freeze/bezel tests), then static embodiment.

## 0f. SOL verify fixes + Stage 3 Step 2 (people ON the wallpaper) — 2026-07-21

**SOL verify pass** (`sol-verify.md`) found 4 real P1s — all fixed:
- **Death ledger** — deceased now persist in a bounded `econ.deadLedger` (48) → "In memoriam" works.
- **Births counted** — `P_respawn` signals a child; `econ.births` increments (was always 0).
- **`cy` non-finite guard** — clamps instead of a misleading empty roster.
- **`buildingStanding` destruction hooks** — wired to real `nukeStruck`/`nukeHit`/`curRuins`+`inZone`.
- Plus: registry world-identity cache key; clothes hex-validation in both UIs; strengthened the
  (previously vacuous) index-stability test to assert immutable identity; hardened the population
  hash; added lifecycle + full-state-convergence tests. **Suite now 57/57.**

**Stage 3 Step 2 — STATIC EMBODIMENT DONE & visually verified.** `drawNamedCitizens(g,now)` (spliced
after §CITIZEN SIM; called after the anonymous ped loop) draws every embodied named citizen at their
real home/work building (via `peopleHomeWork` rendezvous binding), spread across the frontage, in
**job clothing during work hours / civvies off-shift**, spatially culled by `disX`, capped by quality,
recording `drawnNamed[]` for inspect. Anonymous `peds` thinned ×0.4 where embodiment is active so the
street isn't overpacked. Verified: **170 citizens embodied** in a mature metropolis (screenshot
`scratchpad/embody4.png`); `node --check` + 57/57 tests + all shells synced.

**Harnesses:** `desktop/tools/embody-frame.html` + `shot-frame.js` render a single forced-age/-time
frame offscreen (bypass the web app's live-age loop) to inspect embodiment.

**Stage 3 Step 3 — COMMUTE DONE & verified.** `drawNamedCitizens` now walks each citizen through a
daily schedule: staggered shifts (±0.9h from seed), `lerpWX` shortest-wrapped path home↔work, work
clothes on-clock / civvies off, self-employed mill near home by day, most sleep inside at night,
everyone shelters home during `curDis`/`curOutbreak`. Pure fn of the effective clock (freeze-safe).
Verified at 08:24 (morning spread), midday (at work), 18:36 (evening home). 57/57 tests, all synced.

**Stage 3 remaining:** Step 4 hover/click inspect (use `drawnNamed[]`) · Step 5 speech bubbles (spatial
buckets, `speech.json`) · Step 6 drag gag. Then Stage 4 economy TV + elections, Stage 5 ORDER/Bills.

## 1. Time model (the load-bearing decision)

- Citizen life runs on **its own clock, not shown to the user** (Q13). Weather + time-of-day stay
  real-world; lifespans compress so a full human life fits inside a city-life.
- **Key it to the EXISTING city-life clock** (`cityGrowth().cy` / elapsed-since-founding via
  `lifeIndexOf(now)`), NOT a new parallel clock. `cy` already drives corp arcs, elections, and the
  Civic Cast thresholds (0.30/0.42/0.56/0.72…). A parallel clock is a desync/freeze bug waiting to
  happen.
- **Fold-once → cache → advance incrementally.** Never re-fold the whole population per frame.
  The binding cost is the **cold fast-forward** to an arbitrary `now` (freeze-render + cold start).
  Bound the step count (hundreds–low thousands). Target **~20–30ms cold fold** for N=100.

## 2. Forward-step simulation (no iterative solver)

Citizens↔economy↔elections↔policy are mutually recursive. Do NOT solve — **forward-step** on a
fixed coarse tick:

```
each tick:  update agents (age, job, wealth, relationships, reactions to this tick's city events)
         →  roll up economy AGGREGATES *from* the agents  (Q21: citizens drive the economy)
         →  run elections at scheduled ticks (candidates/parties/votes are the agents)
         →  policy outcome feeds the NEXT tick
```

Bounded, deterministic, cheap, freeze-safe.

## 3. The citizen model

Each citizen = pure function of `(citySeed, index)`. **Seed by INDEX, not by N**, so raising the
(configurable) population later ADDS people without renaming existing ones.

- **Identity:** region-aware name (every location the picker offers gets its own name pools),
  distinct sprite (clothes/skin/hair — engine already has `PEDC/SKINC/HAIRC`), personality/traits.
- **Job:** real occupation mapped to a **real building on the map** (bakery/cafe/hospital/school/
  fire/apartment + corp HQs already exist as typed buildings). **Work clothes when commuting to
  work; normal clothes otherwise** (Q8) — readable status by dress. Jobs adapt as the city evolves.
- **Home:** a specific house or apartment building (Q9); commutes home↔work.
- **Class/wealth:** visible via home + dress + what they own (car vs bus) → enables **class warfare**
  (Q10/Q23). Economy can move them up/down.
- **Life-cycle (Q3/Q5/Q11):** born or arrive → grow → job/career → marry → children (next
  generation) → house → maybe office/business/crime/scandal → retire → die → replaced. Natural
  lifespans on the citizen clock.
- **Relationships (Q12):** friendships, rivalries, marriages, feuds, partnerships — citizens
  interact with each other (extends the existing shopkeeper rivalry).

## 4. Integrations

- **Elections (Q16–20):** candidates ARE tracked citizens; parties emerge from citizen coalitions
  — **including THE ORDER's strongman and the Bills ringleader** (they're a named citizen who
  rises). Citizens **vote by interest/class/personality**, and can **change their minds** (Q17).
  Policy outcomes make specific named citizens **win or lose** (casino ruins one family, enriches
  another — Q18). A followed citizen can **rise to Mayor if alive** and later **fall**
  (scandal/recall) — max drama (Q19). City remembers past mayors by name (Q20).
- **Economy (Q21–24):** citizen employment/wages/business ownership **are** the economy source
  data. Businesses owned by named citizens (extends founder binding). Visible **rich/poor gap /
  gentrification** storyline. A **TV STATION** surfaces the economic readout — GDP, unemployment,
  a citizen's net worth (Q24). Crime stats fully visible (Q14).

## 5. Seeing them

- **Wallpaper:** **speech bubbles only when two citizens actually interact** (Q26 — no floating name
  labels). Opt-in hover/click **inspect** panel. Opt-in drag-to-death gag (cosmetic, off by default).
- **Citizens menu (Q25):** full searchable roster/directory — portraits, jobs, class, life stories,
  relationships, follow-feed. Built on **desktop Control Center + web dashboard + phone app**, each
  reading from the sim (NOT from chronicle-store).
- **Phone app (Q27):** updated + working, installable on Nick's Android; **follow specific citizens**
  and get their life updates as a feed.

## 6. Build order — each stage clears the both-platform (Linux KDE + Windows Electron) gate

1. **Sim core + headless determinism/timing test.** Extend `desktop/test/ticker-life.js` to
   cold-fold the whole 100-person population founding→arbitrary `now` and time it. **Prove it
   (~20–30ms, deterministic) BEFORE any visuals.**
2. **Roster data model + read-only "Citizens" menu** (desktop/web/phone).
3. **Positional model:** homes/workplaces + commute + job-clothing + hover/click inspect. (A real
   rewrite of the anonymous `np=round(WW/16)` ped pool — its own chunk.)
4. **Elections-from-citizens + economy TV-station readout.**
5. **Last (most coupling):** rewire **THE ORDER + Bills** to emerge from named citizens. Here also
   **flip the Bills `billsEvent` DEMO flag OFF** and **raren the organic cadence** (Nick: Bills
   takes over too frequently — the demo force flag is the main cause).

Branded/revealed as ONE giant "THE PEOPLE" mega-update; built and verified in these staged chunks.

## 7. Offloading (SOL/Codex on desktop, Hermes on GameServer LiteLLM, Opencode)

**Guardrail: the agents produce DATA FILES and PROPOSALS only — they must NOT edit `city.js`**
(merge + determinism hazard). Claude integrates everything by hand.

- **Codex/SOL (desktop, GPU/SOL):** region-aware name pools (one set per picker location), job
  taxonomy + job→building map, personality/trait tables, job→clothing palettes, 100-bio flavor.
- **Hermes (GameServer LiteLLM, Nick's preference):** hundreds of ticker-line templates, life-event
  narration variants, speech-bubble lines.
- **Claude:** engine surgery, deterministic sim core, elections/economy rewiring, all-4-shell
  integration, tests, both-platform verify.

## 8. Decisions (confirmed 2026-07-21)

- **Within-life fresh cast (CONFIRMED).** Each civilization (life) gets a **fresh cast** who
  live/age/die/replace and have children (next generation) *within* that life. **No cross-reset
  dynasties** — clean, no cross-reset state, identical on all 4 shells. The **Chronicle remembers
  past civilizations by name** (past mayors, notable deaths) as its persisted read-model.
- **Default population ~150–200 (CONFIRMED, pending timing proof).** Nick chose the denser cast
  for a richer social web + elections. **Stage 1 MUST prove the cold-fold still hits ~20–30ms at
  N≈175** before this is final; if it can't, fall back toward 100 and report the number. Count is a
  config value regardless.
