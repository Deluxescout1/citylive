# Stage 5 design — THE ORDER + BILLS rise from named citizens

## Goal (Nick Q16, Q6)
When THE ORDER (fascist takeover) or the Bills Mafia seizes power, the strongman / ringleader is a
REAL named citizen who rose from the roster — a person with a job, family and backstory you can follow
to power — not an abstract "GENERAL SO-AND-SO". Bound by pid so the HUD rally banner, the Citizens menu,
and the Chronicle name the SAME person.

## What exists
- `regimeState(now)` (~11372): pure-clock; returns the arc {active,stage,sub,theme(order|bills),
  outcome(putdown|win),party,leaderName,path,...} or null. `leaderName` = an abstract TITLE + NAME from
  REGIME_*_TITLES/NAMES. Consumed by drawRegimeHud/Streets/Rally/Parade + ticker; `curRegime` set each frame.
- The citizen sim + `peopleElectionState` already surface prominent citizens; `office`/party exist.
- SOL (4b Q6): KEEP the regime override ISOLATED — do NOT merge it into the democratic election tally.
  Add extensibility (leaderPid/kind/label). The mayorState overlay pattern is the template.

## Proposed approach (mirror the mayor overlay — least fragile)
1. A narrow pure API `peopleRegimeLeader(li, cy)` → the citizen who becomes the strongman this life:
   deterministic pick of a high-ambition / high-conviction living adult (a plausible demagogue), stable
   across the arc (bound to one pid for the whole takeover). Returns {name, pid, job, party}.
2. `regimeState` OVERLAYS leaderName ← that citizen's name (+ keep a regime TITLE prefix so it still reads
   as a strongman, e.g. "CHANCELLOR <Name>" / a Bills title). Keep every other regime field + the isolated
   override intact. Vacant/none → keep the abstract fallback.
3. The strongman's citizen gets a cosmetic marker in the roster projection (e.g. office=3 "regime" or a
   `regime:true` flag) ONLY while the regime is active — for the Citizens menu to badge them. Must stay a
   pure fn of the clock (regime is pure-clock) and NOT corrupt the election office semantics.
4. Chronicle: the regime leader recorded by name (already) + pid.
5. Keep it isolated: the regime does NOT run through elections/mayorState; the strongman is separate from
   the elected mayor (indeed the arc SUSPENDS elections — "NO ELECTIONS" under THE ORDER).

## Open questions for SOL
1. Is overlaying leaderName from a narrow peopleRegimeLeader(li,cy) sound + freeze-safe, mirroring the
   mayorState fix, with the regime override kept fully isolated?
2. How to pick the demagogue deterministically so it's ONE stable person across the whole arc (stage 1→6)
   and doesn't flip — key off (life) only, or (life + regime cyStart)?
3. Marking the strongman in the roster while the regime is active: safe as a pure-clock projection flag,
   or does reading regimeState() from inside peopleRoster risk a cycle / perf / freeze issue? (regimeState
   calls cityGrowth; peopleRoster is called a lot.) Prefer computing the flag in the menu, not the sim core?
4. Bills ringleader vs THE ORDER strongman — same mechanism, just different title pool? Any theme-specific
   trap (Bills is also the gameday path)?
5. Interaction with the mayor: during a regime the elected mayor is suspended — should the menu show the
   deposed mayor, the strongman, both? Any consumer that assumes exactly one "leader"?
6. Consumers of leaderName to audit for length/format now that it's "TITLE First Last".
