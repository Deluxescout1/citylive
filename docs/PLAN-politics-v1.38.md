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
