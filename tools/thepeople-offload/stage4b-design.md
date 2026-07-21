# Stage 4b design — UNIFY THE ELECTIONS (one mayor, drawn from the citizens)

## Problem
Two parallel political truths today:
- `mayorState(now)` (~engine): pure-clock, picks a SURNAME from LNAMES + an abstract party
  {GREENS/TRANSIT/BUILDERS/...}, with a rich drama arc (term math, campaign/debate/electionDay/
  justElected/scandal/recallVote/ousted/hold/share/approval). Consumed EVERYWHERE: HUD mayor pill
  (~3218), ticker (~6717), news POLITICS beats (~6877), almanac, Chronicle ingestion, and it nudges
  the economy (BUILDERS party juices curEcon ~14503).
- The citizen sim elects `econ.mayor` — a REAL tracked citizen (name/job/family/party 0-3) via
  peopleRoster().mayor. Shown in the Citizens menu. Does NOT match the HUD mayor.

Goal (Nick Q16-20): the mayor IS a named citizen with a backstory; parties come FROM citizens
(incl. later THE ORDER strongman + Bills ringleader); citizens vote by class/interest and can change
their minds; a followed citizen rises to Mayor and can fall (scandal/recall); the city remembers past
mayors by name.

## Constraints
- `mayorState` MUST stay a pure fn of the clock (HUD/almanac call it at arbitrary `now`). It may call
  `peopleRoster(now)` (also pure-clock, cached). No new state.
- Preserve the drama arc + the exact fields every consumer reads (winName, loseName, party.k, share,
  campaign, debate, electionDay, justElected, scandal, recallVote, ousted, hold, approval, term...),
  so the HUD/ticker/almanac/Chronicle keep working unchanged.
- Freeze-safe + bezel-identical. Chronicle must keep ingesting witnessed elections by name.

## Proposed approach (for review)
Keep mayorState's TERM/timing/drama SCAFFOLDING (campaign windows, debate, electionDay, scandal/
recall hashes) exactly as-is — it's the theatre. Replace only WHO:
1. `winName`/`loseName` ← the citizen-sim mayor at this term + the runner-up citizen (highest-
   conviction living adult of a losing party). Full "First Last".
2. `party` ← map the citizen mayor's party 0-3 to a stable engine party object (keep the k-labels the
   ticker/economy already branch on, e.g. reuse GREENS/TRANSIT/BUILDERS/CIVIC by index), OR relabel
   parties as citizen coalitions. Keep `.k` values that curEcon (~14503) + tickers switch on.
3. `share`/`approval` ← derive from the citizen vote split (peopleRoster gives winParty; the sim
   already tallies v[4]). Store the tally so share is real.
4. `scandal`/`recall` ← bias toward a mayor citizen who actually has crimes/low approval, but keep the
   existing scandal hash cadence so timing/drama is unchanged.
5. Reconcile term cadence: the engine TERM vs the sim ELECT_EVERY(90 ticks). Options: (a) keep engine
   TERM as the display cadence, sample the sim's current mayor at each term boundary; (b) drive terms
   from the sim's elections. Prefer (a) — least disruption; the sim mayor is stable across a term.
6. The citizen who is mayor gets office=2 already; ensure the SAME citizen the sim elected is the one
   named — bind by pid so HUD name == Citizens-menu name == Chronicle name.

## Open questions for SOL
1. Is sampling the citizen mayor into the existing mayorState scaffolding (approach a) sound and
   freeze-safe, or must the engine TERM and sim ELECT_EVERY be reconciled to one clock to avoid a
   winName that flips mid-term when they disagree?
2. Party model: reuse the 4 engine party objects (keep .k labels the economy/ticker branch on) mapped
   from citizen party 0-3, or replace with citizen coalitions and update every consumer? Which is less
   fragile?
3. `share`/vote tally: expose the sim's v[4] party tally through peopleRoster so share is the real
   split — any determinism/perf concern?
4. Consumers to audit for "surname-only" assumptions (textW(nm)>iw fallbacks, Chronicle candidate name
   sanitize) when winName becomes "First Last".
5. Anything that breaks freeze/bezel parity if mayorState now calls peopleRoster.
6. Sequencing vs Stage 5 (THE ORDER/Bills as citizen-led): should the party/coalition model be built
   now to also carry the regime leader, or kept minimal for elections first?
