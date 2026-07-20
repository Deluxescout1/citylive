# THE POLITICAL CITY — design plan (Nick-locked 2026-07-20)

One connected system: **the economy and disasters move voters → voters decide elections → the winner
visibly rebuilds the city → crisis radicalizes parties into factions → factions rig the vote → unrest →
the fall.** Everything below was decided by Nick via 16 questions. Ships INCREMENTALLY, news TV first.

## LOCKED DECISIONS
1. **One ladder, not two systems.** The ordinary parties ARE the pipeline: a party that wins too much /
   rides a crisis can radicalize into a takeover faction. THE ORDER becomes one endpoint among several.
2. **Party effects: dramatic + persistent.** GREENS → parks/trees/solar/green roofs; BUILDERS → cranes,
   taller towers; TRANSIT → monorail/bike lanes/trams; SAFETY → cameras/patrols/checkpoints. Changes
   persist and STACK across terms so the city's political history is legible in its skyline.
3. **News = giant ROOFTOP jumbotrons**, above the skyline (clears the viaduct/crowd occlusion lesson),
   big enough for a readable anchor + headline. Scattered, 3-5 in view.
4. **Voting is fully visible**: polling places, queues, ballot boxes, "I VOTED".
5. **Vote influences**: recent events (disaster/crime/plague/scandal) · neighborhood/district · quality of
   life on their own block · campaigning + media · **economy & job market**.
6. **Election night = a live results show** on the jumbotrons: anchor, precincts reporting, bars filling,
   lead changes, called winner, concession, victory rally.
7. **Full drama**: close races, recounts, upsets, landslides, occasional disputed result → street unrest.
8. **Elections run as a full season**: all parties field candidates → primaries narrow the field →
   campaign (rallies/ads/polls) → debate night → election day → results.
9. **4-5 factions, each a DISTINCT ideology** (militarist, corporate technocracy, eco-authoritarian,
   theocratic order, …) — own colour, emblem, leader style AND takeover playbook. **All fictional, no
   real-world symbols** (standing constraint from THE ORDER).
10. **Radicalization triggers**: disasters/crisis · economic collapse · winning too much · scandal+chaos.
11. **Factions RIG elections** as they gain power. Fraud is **visible but deniable** — ballot boxes out
    the back, impossible precinct jumps, opposition posters torn down, polling places closed in districts
    that vote wrong — while the news insists the vote was free and fair.
12. **Disaster → militarization chain, in full**: disaster → voters swing → security party wins → troops,
    checkpoints, emergency powers → repeated crises slide into a full faction takeover.
13. **Economy: big board + street decay.** Live market index on the jumbotrons (symbols, green/red, crash
    days) + a financial district that reacts + the street reality: homeless camps, fewer cars, boarded
    shops, litter and neglect in a depression; visible prosperity in a boom.
14. **Political unrest**: protests with fire, barricades, burning barrels — handled by POLICE or MILITARY
    depending on who holds City Hall. "Don't be shy" — but the standing **no-gore** rule holds: riot
    lines, shields, water cannon, gas plumes, barricades, burning barrels/cars. No injuries, no blood.
15. **Cleanup pass wanted on**: election events (too small/missable), the HUD/banners (clearer, better
    organized), street-level events (lost behind the viaduct), the ticker (hard to read).

## BUG (confirmed, Nick spotted live)
`city.js:12650` — `if(!nukeFull()){ drawHighFlights; drawHelis; drawRealFlights; }`. Aircraft simply STOP
BEING DRAWN when the nuke goes full, so they pop out of existence. **Planes must be DESTROYED by
disasters like everything else** — blown away by the blast wave, tumbling, trailing smoke. Same audit for
the other finales (meteors/sunburst/alienwar) and for balloons/blimp/helis.

## SHIP ORDER (each its own gated version)
- **v1.38 CITY 9 NEWS** — rooftop jumbotrons + pixel news anchor + readable headlines, rotating segments
  (politics · breaking disasters · economy/market · crime · tech/AI · astronomy · weather · city life).
  Builds on `drawNewsScreens`/`drawStateScreen`, does not replace them. **+ the plane-destruction fix.**
- **v1.39 PARTY CONSEQUENCES** — per-party persistent city changes (decision 2).
- **v1.40 ECONOMY & THE STREET** — market board + financial district + boom/bust street reality. Lands
  BEFORE the election engine because voting reads it.
- **v1.41 THE ELECTION** — full season, per-citizen voting, districts, polling places, live results show,
  drama. **Riskiest**: touches `mayorState` purity → will require regenerating the containment and
  regime-diff baselines. Own branch, own checkpoint.
- **v1.42 UNREST** — protests, fire, police vs military response.
- **v1.43 THE FACTIONS** — 4-5 ideologies, the radicalization ladder, rigging.
- Legibility cleanup (HUD/ticker/events) folded through all of the above.

## ARCHITECTURE CONSTRAINTS (non-negotiable, from prior ships)
- Every state fn stays a **pure deterministic f(now)** — `almanacData`, the containment guard and
  `regime-diff` all depend on it. New arcs mirror the plague/regime pattern exactly; mutual exclusivity
  must be EMPIRICALLY tested (OVERLAP 0), never assumed.
- Any per-building overlay MUST replicate `drawLayer`'s standing-tower predicate (overSite/overLandmark/
  born>=bandOf) or it floats. Three bugs of this class so far.
- Anything new that draws in the pinned containment night scene needs a NOLIVESKY-style suppressor.
- Works on BOTH Linux(KDE/QML Canvas) and Windows(Electron/Chromium). **NO sound.**
- Gate every version: `npm test` · qml-sweep · regime-contain.sh CONTAIN_OK · KDE live deploy ·
  Windows build. Push version tags ONE AT A TIME.

## ADDENDUM — THE HOMELESS + ADDICTION CRISIS (Nick-locked 2026-07-20, "push more into the homeless")
Two gated versions, building on v1.40's curSlump/drawHardTimes:

### v1.41 THE STREETS (rich homeless) — locked
- **Placements (all):** tent city UNDER THE OVERPASS (clear span beneath the elevated-train viaduct — reads
  well); a growing TENT CITY in a vacant lot that visibly expands with the slump + shrinks in recovery;
  individuals in DOORWAYS/BENCHES/corners; PANHANDLERS with signs at the crosswalk medians.
- **Behaviors (all):** BARREL FIRES at night (glowing → reads through clutter), pushing SHOPPING CARTS,
  CARDBOARD SIGNS (HELP/HUNGRY), a FOOD LINE queue.
- **City response = MAYOR-DEPENDENT:** GREENS/TRANSIT build a SHELTER + SOUP KITCHEN (camps smaller, people
  helped, a line); SAFETY SWEEPS camps (police clear them — fewer tents, a darker path); a neglectful
  mayor lets it SPRAWL bigger.
- **Driver = economy now** (curSlump), with a RECOVERY arc (camps shrink as econ heals + a "SHELTER OPENS /
  RECOVERY" news beat). War/disaster refugees + faction crackdowns wired in LATER.
- **KEY READABILITY FIX:** draw the homeless AFTER the pedestrian loop (currently before → peds occlude
  them). Foreground = visible. Make camps bigger/clustered; barrel-fire glow is the night anchor.

### v1.42 THE ADDICTION CRISIS — locked (its own escalating arc, like THE PLAGUE)
- **Scope:** a full escalating crisis arc — EMERGING → SPREADING → EPIDEMIC → PUBLIC-HEALTH EMERGENCY →
  RECOVERY. Own state (addiction level/stage), HUD, news beats.
- **Reach:** STARTS in the camps/hardest-hit, SPREADS citywide as it worsens (feels like a real epidemic).
- **Tone: TASTEFUL & IMPLIED (strict no-gore).** Slumped/nodding figures, somber, news ("OPIOID CRISIS
  DECLARED"), and the RESPONSE shown — NO drug use or paraphernalia depicted. Dignified, not exploitative.
- **Fightback (all):** recovery CLINICS/REHAB centers (buildings, GREENS/TRANSIT invest more), NARCAN/
  OUTREACH vans + medic teams working the streets, SAFETY-mayor CRACKDOWN (police sweeps/arrests instead of
  treatment — a darker path that can worsen it), and RECOVERY/AWARENESS wins (banners, a memorial, sober-
  community beats, the crisis receding).
- Economy-driven emergence (deep/prolonged recession seeds it); mirror the plague arc architecture (pure
  state fn, life-scoped, staged, containment-suppressed via a NO- flag).

## ADDENDUM 2 — SPORTS ARENAS OVERHAUL (Nick-locked 2026-07-20) → v1.43
- **Real local teams, real names**, by DISTANCE from the user's detected location (Norwich CT → Boston+NY:
  Celtics, Red Sox/Yankees, Bruins, Rangers/Islanders, Patriots/Giants/Jets…). Every city shows the USER's
  teams (like real weather). Build a team dataset (NBA/MLB/NHL/NFL, each with metro lat/lon) → nearest-per-
  sport by haversine to user coords; if the state has none / several are close, randomly pick among the few
  closest (stable per life).
- **One arena per sport (4): a SPORTS DISTRICT** that appears as the city matures.
- **4 DISTINCT venues** (revamp the single drawStadium at LM_STADIUM=0.63): baseball PARK (open diamond +
  outfield), domed BASKETBALL/indoor arena, HOCKEY rink arena, football BOWL — recognizable by silhouette,
  each named + team-coloured for its real team. Existing: teamOf(li,era) procedural team + drawStadium bowl.

## ADDENDUM 3 — APOCALYPSE ONLY WHILE PC IS ON (Nick-locked 2026-07-20) → own version
End-time disasters must only fire while the PC is ON. If an apoc is scheduled during off/sleep time, it
should play a LITTLE AFTER the PC turns back on (so the user never misses it). Currently the apoc is a pure
f(clock) at cy 0.955 → if the PC is off during that window the user resumes to a dead/reborn city and misses
it. Implementation: detect a large inter-frame time gap (PC was asleep/off); if the gap crossed the apoc
run-up unwitnessed, DEFER the apoc to ~N sec after resume (persist a per-life apoc-time offset). The DOOMSDAY
CLOCK (v1.21, apocAtOf) MUST reflect the deferred strike time. Delicate (breaks pure-f(now) for the apoc,
needs persisted state + time-gap detection) → build in isolation, test resume scenarios.

## ADDENDUM 4 — SPORTS + LAYOUT + CONSTRUCTION OVERHAUL (Nick-locked 2026-07-20)
Clutter problem: big features (jumbotron + stadium) overlap; viaduct hides arenas. Nick wants everything
visible; normal buildings overlapping is fine. World is landmark-packed → only clear zone is [0,0.175].
- **v1.46 SPORTS COMPLEX + IN-SEASON + ANTI-CLUTTER:** a reserved SPORTS COMPLEX in the left clear zone
  (4 big arenas adjacent, a realistic complex), reserved in lmFoot so NO buildings/jumbotrons land on it.
  Draw arenas IN FRONT of the viaduct (currently drawTrainLine @13647 draws after → occludes; move it
  before drawSportsDistrict). Arenas ONLY SHOW WHEN THEIR SPORT IS IN SEASON (MLB Apr-Oct, NBA/NHL Oct-Jun,
  NFL Sep-Feb, by real month). Jumbotrons reserve/avoid each other + landmarks + the complex.
- **v1.47 LIVE GAME ACTION:** when a game's on, see it played — an OPEN stadium (baseball) has a ball fly
  out occasionally, fans emoting/cheering/screaming, and FANS WEAR THE PLAYING TEAM'S COLORS.
- **v1.48 CONSTRUCTION OVERHAUL:** arena BUILD ARC (empty lot + "FUTURE HOME OF [TEAM]" → cranes/foundation
  → stands rise → grand opening); richer construction SITES (cranes/scaffold/workers/materials/phases); a
  BRANDED construction company (name/logo on hoardings + crane booms); buildings visibly RISE floor-by-floor.
- **v1.49 PLANE CRASHES:** add plane crashes (a real aircraft goes down — smoke/fire, emergency response).
  Keep no-gore.

## ADDENDUM 5 — MORE (Nick 2026-07-20)
- ECONOMY TRACKER on the news: the CITY 9 news reports should also show the economy tracker + whether the
  JOB MARKET is booming or not (add a market/jobs segment/ticker to drawJumbotron/newsBeat — marketIndex +
  econOf + a JOBS status). Small add to the news system.
