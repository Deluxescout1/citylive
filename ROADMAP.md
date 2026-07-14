# CityLive Roadmap — user notes from watching cycles (2026-07-05)

Status legend: [ ] todo · [~] in progress · [x] done

**REMAINING:** C4 gov+schools, C5 mega towers, H1 single-screen, I3 museum relic, L1 blackouts,
L3 coaster district, N3-N10 sim depth, H3 restore 30-day cycle. Everything else DONE (2026-07-05).

## A. Bugs (clear defects)
- [x] A1. Window washers clean buildings that don't exist yet — gate by bAge like everything else
- [x] A2. Trees spawn on water — exclude water spans from tree placement
- [x] A3. Cars appear before roads exist — cars only on built road; per-lane gating as road paves in;
        exception: jeeps/offroad + early construction vehicles may drive on grass
- [x] A4. Some buildings have no windows — ensure every building gets windows
- [x] A5. Crosswalk signals must actually govern crossing: people only cross on WALK;
        some jaywalkers may dash across if no cars are coming

## B. Nature / terrain
- [x] B1. Wider variety of trees (more species/shapes/sizes)
- [x] B2. More water (bigger ocean spans)
- [x] B3. Ocean looks wrong "behind the buildings" — make the shoreline read naturally
- [x] B4. Puddles on the ground when it rains
- [x] B5. If there is a river, there must be a bridge over it
- [x] B7. (user 2026-07-05) MOUNTAINS: per-life two-ridge range behind everything (72% of lives;
        life 0 always) — connected base ridge + craggy peaks, ABSOLUTE snowline (tall summits only),
        snowline drops in winter/after snow, sunset alpenglow, moonlit night caps; silhouette cached
        per screen (zero per-frame cost beyond column fills)
- [x] B6. (user 2026-07-05) Water looked blocky/unnatural — new `waterTex` (smooth depth gradient +
        rolling irregular swell) shared by sea & harbour; meandering beach w/ lapping foam + breakers;
        night moon-glint path; young-city bay wears a sand ring until the quays pave in; river got
        soft banks + drifting current glints

## C. Growth narrative ("a group of people came together to start a town…")
- [x] C1. Founders arrive first (people show up, then build); more builders on a structure = faster build
        (caravan treks in over first ~1.6h of a week-life; camp+campfire+tents while the cabin rises
        course-by-course; per-building crew of 1-3 = build speed; crews visible on every grow site)
- [x] C6. (user 2026-07-05) HORSES era: horse riders / log carts / covered wagons until pavement
        (fade out cityG .38-.46); motor rigs only from cityG .26; both routed on DRY LAND only
- [x] C7. (user 2026-07-05) BUG: cars drove over open water — landRoute() squeezes all overland
        crossers onto land; strolling peds skip sea spans pre-causeway; a poled raft FERRY
        (wagon aboard, bow lantern at night) works each sea span until the causeway is paved
- [x] C2. Construction vehicles (offroad-capable) drive on grass during early build-out
- [x] C3. After reset: ONLY ruins remain — a true start-over (no leftover city)
- [x] C4. CITY HALL (columns/dome/flag, evening uplights, 0.415WW at cityG .52-.60) and the
        SCHOOLHOUSE (bell tower, flagpole, recess kids + kickball weekdays 10-15h; build timing
        varies per life 0.38-0.54)
- [x] C5. Two MEGA-TOWER arcologies (0.44/0.565WW, cityG .86-.98, ~2x the skyline): two-tone
        shafts, glass floor bands, bright sky lobbies, crown spires + beacons, topped out by a
        mega-crane; the space age claims their edge seams early

## D. City life & people
- [x] D1. People-per-building scales with building size (bigger buildings = more foot traffic)
- [x] D2. People look more like people: 3×5 sprites (hair/face/shoulders/torso/striding legs,
        trouser shade); cars are 11-wide sedans (glasshouse, B-pillar, rockers, wheel shadow),
        vans/taxis/EMVs matched; lanes respaced 5/10/16/21, queues+crash+crosswalks retuned
- [x] D3. More neon signs once the city is established
- [x] D4. Rooftop house parties
- [x] D5. More window lights come on as the evening deepens (gradual, time-driven)
- [x] D6. Facade detail: cornice caps + setback terrace shadows every tier, stone quoins on brick,
        window AC units, residential balcony rails, structural slab lines on glassy layouts,
        lit ground-floor storefronts (downtown/entertainment/oldtown)
- [x] D7. Sports team per city: name/colors/mascot per life, tied to the stadium
- [x] D8. More crime + fires; police & fire department respond visibly

## E. Sky / weather / lighting
- [x] E1. Dynamic sun lighting (directional light/shadows through the day)
- [x] E2. Dynamic clouds — cotton-candy sunsets
- [x] E3. (verified existing) Lightning in storms (verify + intensify)
- [x] E4. (verified existing) Weather + time of day always match reality at EVERY stage (verify)
- [x] E5. (verified existing) City glow when big enough (verify/strengthen light-pollution dome)
- [x] E6. Local time + date displayed top-center of each monitor, styled to sit in the sky

## F. Events / disasters / war
- [x] F1. Block disasters must actually DESTROY buildings visibly (individual crack + crumble),
        with people panicking (running, screaming poses) — not just road-level effects
- [x] F2. People can WIN against normal disasters — but not always (military sometimes loses → worse damage)
- [x] F3. Endtimes are never winnable
- [x] F4. Endtimes variety — NOT asteroids every time. New death events:
        nukes · sun explosion · AI takeover · (keep meteor storm as one of several)
- [x] F5. True endtimes destruction: the whole skyline visibly cracks/collapses before reset
- [x] F6. Wars: invaders attack, military defends. Hidden military-funding variable (per life)
        affects win odds; citizens vote (election theater). If invaders win: they take over and
        re-skin the civilization to THEIR culture for the rest of the life
- [x] F7. Extensive fireworks on the holidays that deserve them
- [x] F8. Parades for holidays/events that deserve a parade

## G. Space age
- [x] G1. Mass-Effect future (2026-07-05): every building gets `spAge` (core towers first) —
        as curSpace rises each one visibly retrofits (shrouded hull + climbing spark work-line)
        then re-emerges as a gunmetal tower with light-band floors, glowing edge seams and a
        spire/halo/tapered crown; sky-bridges link transformed neighbours; lane paint crossfades
        to a lit cyan guideway; the fleet converts to hovercraft (underglow, no wheels); street
        lamps go cyan-orb. Fully deterministic + witnessable at any cycle speed.

## H. Meta / platform
- [x] H1. Single-screen mode (SMALLW = WW<1000wp): laptop worlds keep stadium/city hall/school/
        museum/Ferris/one mega-tower and skip cathedral/coaster/2nd mega so landmark plazas
        don't eat the compact world; everything else scales by world fraction. Verified 1080p.
- [x] H2. Finer pixel resolution ("64-bit style"): PXK 6→4 LIVE since 2026-07-05. `KSP=6/pxk`
        scales world speeds (crosser/train/cars/peds/boats) + building masses so timing &
        composition are preserved; PXK-6 stays a byte-identical no-op. CPU ~29%→41% of one core
        early-growth (≈60% expected at full metropolis, was ~43%). Follow-ups: people/car/tree
        sprites still 1×-scale (finer/smaller now) → D2 sprite upgrade is the natural next step;
        landmarks/stations also 1×.
- [ ] H3. (When testing done: restore GROW_CYCLE to 2592000000 = 30 days)

## I. Story & civilization depth (brainstorm round 2 — user approved ALL)
- [x] I1. City NAME per life + founding plaque (water tower, stadium, blimp, doom HUD uses it)
- [x] I2. News ticker narrating real sim events (disasters, line openings, elections, weather)
- [x] I3. MUSEUM (0.275WW): classical hall + gilded frieze; on the plinth outside stands a relic
        of the PREVIOUS life's death — meteor chunk / scorched hazard sign / charred ember
        obelisk / a mostly-dead AI core that still blinks; uplit at night
- [x] I4. Live population counter (grows with cityG, dips after disasters)

## J. Sky & atmosphere 2
- [x] J1. Aurora borealis on rare cold clear nights
- [x] J2. Real-date meteor showers (Perseids Aug, Geminids Dec)
- [x] J3. Balloon festival: 2nd Saturday of June 6-11am — 11 extra striped balloons rising across the sky
- [x] J4. Premiere nights: ~45% of Fri/Sat ≥20h (cityG>0.7) — two crossing searchlights, red carpet,
        rope posts, crowd, arriving star, camera flashes; venue alternates 0.30/0.70·WW

## B2. Nature batch (user 2026-07-05 evening) — ALL DONE
- [x] Big trees: 4 size classes up to 3.4× old-growth giants (thick trunks, layered canopies);
        forest density +55%; parks got more/bigger trees; crews can't fell giants
- [x] Wildflower meadows (seasonal colours, paved over as the city grows) + park flowerbeds
- [x] Wildlife: deer herd + rabbits (rediscovered & rewired orphaned system, now land-only),
        dawn/dusk fox, butterflies, migrating geese Vs, river fish, harbour dolphins +
        spouting whale (also rewired orphans); trees fully seasonal (bare winter/gold autumn/blossom spring)

## C2b. Settlement survival (user 2026-07-05 late) — DONE
- [x] Hunters stalk out with bows (46s cycles, 45% success: quarry drops & is carried home,
        else it bolts); gatherers forage berry bushes with baskets (stoop-pick, return brimming)
- [x] Cook-fire: stone ring + spit; at meal times (6-8/11-13/17-21h) a roast turns, a cook tends
        it and folk sit eating; night glow. Drying rack with curing strips; firewood stack
- [x] The FIRST FARM (cg 0.028+, fades with the homestead): post-and-rail fence, tilled furrows,
        crops sprout → ripen golden by late summer → bare in winter; scarecrow; farmer hoeing
        the rows by day; three hens pecking the yard

## R. Perf pass 2 (2026-07-06): 15→12fps (83ms) + drawTree 1×-scale fast path + water swell/
starlight thinned → CPU ~88%→~77% of one core at the wilderness peak (city eras cheaper).

## Q. Night water + wildfires (user 2026-07-06 ~00:00) — DONE
- [x] Water v3: patchy swell (calm lanes between chop, sin-modulated), irregular row strides,
        night depths lifted to readable blue, starlight glints twinkling on the surface,
        moon path breathes wider/narrower per row
- [x] FOREST FIRES: ~18% of 9-min slots in forest eras — flame front races outward from the
        ignition point, trees burn (flames/smoke/night glow + firelight), rain douses active
        burns, charred snags with dying embers stand ~25min, then the forest NATURALLY REGROWS
        over ~2h (saplings scale up); scorched earth fades as the green returns; flowers skip
        fresh ash; ticker warns while it burns

## P. Art polish & variety pass (user 2026-07-05 late) — DONE round 1
- [x] Sun is a round disc w/ core + long dawn/dusk rays; clouds are puffy 3-variant lobed shapes
        (cumulus/tower/wisp) with lit crowns + shaded bases
- [x] Train: roof sheen, underframe, bogies, door seams; bus: sheen/door/AC pod/wheel wells;
        EMVs: glass, wheels, sheen; boats: 4 hull + 4 sail palettes, bellied sails, wakes,
        tug stack+smoke, tire fenders
- [x] Road: asphalt patina speckle, sidewalk expansion seams, curb highlight
- [x] Day glass: unlit panes on near towers show faint sky-glass (kills the flat-facade look)
- [x] Variety: birch (chalk trunk+flecks) & poplar tree species; flower fields drift to 1-2
        colours each; pedestrian brimmed hats & bags/briefcases
- [x] Round 2: viaduct pillar caps + deck edge light, harbor-bridge vertical suspenders,
        streetlamp curved arms + head fixtures (ruins/airport were already detailed)

## K. Street life 2
- [x] K1. Seagulls wheel over the coast by day (7, flapping/gliding, coastal lives)
- [x] K2. Lone saxophonist, 10pm-2am ~45% of nights, causeway (or 0.31WW inland), amber notes + lamplight
- [x] K3. Time-locked professions: 5-7am stop-and-go garbage truck + loader; 11-14h two mail carriers
        w/ satchels; 5:30-8am three joggers in bright vests
- [x] K4. Ice-cream truck (Jun-Aug 12-18h): white+pink, roof cone, jingle notes; kids chase it moving
        and queue at the window when it stops
- [x] K5. Stray cats loaf on fire escapes at night (≤6), tails flick, eyes glint green in deep dark

## L. Systems with drama
- [x] L1. STORM BLACKOUTS: thunder (55%) or rain (18%) per ~6-min slot kills a 46-116wp block's
        windows at night; final quarter a bucket-truck crew (boom, lineworker aloft, welding
        sparks) flickers it back; ticker reports both phases
- [x] L2. Economy cycles: booms (extra cranes/neon) & recessions (dark storefronts, FOR LEASE)
- [x] L3. AMUSEMENT PARK (0.885WW, beside the Ferris wheel): 9-point coaster track on posts,
        night bulbs along the rails, entrance arch, and a 2-car train with riders that runs
        the full track every 13s
- [x] L4. RIVAL CITY across the bay: grows on its own, source of war invasions (they sail over)

## M. Rare spectacle moments
- [x] M1. UFO abduction: wilderness nights ~28% of 8-min slots — glowing saucer descends, green tractor
        beam, a cow spirals up, saucer darts off; 3 cows graze the young meadow as fodder
- [x] M2. Whale breach: coastal daylight ~30% of 10-min slots — arcs out of a sea span w/ spray + ring
- [x] M3. Blimp mishap: ~6% of hours (3-min event) — sagging descent onto the tallest 0.6WW tower,
        draped envelope + 2 hi-vis crew + amber flasher, hauled away; ad blimp suppressed meanwhile
- [x] M4. Time-capsule ceremony at each civilization's half-built mark (cityG≈0.5, ~1.5h window):
        mayor + crowd at the plaza, capsule lowered into a pit, flag, confetti

## N. Simulation depth (round 3)
- [x] N1. MAYORAL ELECTIONS: 5-6 terms/life, campaign posters + plaza rally, election-day queues,
        results banner; winner's PLATFORM governs (BUILDERS boost economy, GREENS plant street
        trees, SAFETY curbs crime & hardens the army, TRANSIT speeds the buses)
- [x] N2. Systemic link: recessions breed crime (crime rate follows the economy)
- [x] N3. Ticker: CITY APPROVAL n PCT (econ/war/mayor-driven) + BUDGET SURPLUS/DEFICIT nM
- [x] N4. A named family per life: wedding, child, first day of school, graduation, bakery
        opening, 40-year celebration — ticker milestones at fixed life-fractions
- [x] N5. OUTBREAK (30% of lives, cy .55-.72, ~4% of cycle): crowds thin 40%, half the walkers
        masked, sirens double, ticker advisory then recovery
- [x] N6. CRUISE SHIP calls (~45% of 8-min slots, coastal, cityG>.7): sails in, docks w/ gangway,
        lit decks; a guide with a little red flag leads 6 tourists downtown and back
- [x] N7. POWER PLANT at the industrial edge (2 cooling towers + steam, turbine hall,
        transformer masts, beacon); brownouts merged with L1
- [x] N8. Early-schooling lives (schoolAt<0.46) reach the space age sooner (EDUB shifts curSpace onset)
- [x] N9. Rush-hour gridlock scales with the life's POPK (big cities crawl at rush)
- [x] N10. Elections: if the economy is in a bust at election time (econOf at the stable election
        moment), the incumbent party loses ~70% of otherwise-won races

## S. The Dozen (2026-07-06) — ALL DONE
- [x] S1 hail bounces in some thunderstorms · S2 heat shimmer over hot asphalt
- [x] S3 dawn fishing fleet w/ nets + working gulls · S4 lighthouse w/ sweeping beam + foghorn rings
- [x] S5 summer weekend night market (lantern stalls, grill smoke) · S6 juggler + chalk artist
        whose drawing grows through the day (rain washes it)
- [x] S7 hanami blossom picnics (April) + harvest fair (Sep/Oct hay bales & pumpkins)
- [x] S8 grow-site cranes hoist girders w/ weld sparks · S9 snowmen that melt with the pack +
        autumn leaf piles & the raker
- [x] S10 mail-chasing dog, pigeon-stalking cat, lost balloon + heartbroken kid
- [x] S11 aurora reflects in tower glass · S12 museum relic garden (one plinth per fallen life)
- [x] S13 game-night stadium roar (light pulses) + postgame crowds streaming home
