# PLAN — "Living Streets" batch (→ v1.6.0)

Fable-planned 2026-07-16 (post-v1.5.0, engine ~10,300 lines). Branch `living-streets`.
Rules: canonical engine only + sync ×4 + md5; both-platform gate before merge/tag; pure
clock+hash determinism (NO Math.random in painters); KDE 3×10fps budget (QUAL 0/1/2);
render-verify via desktop/kde-repro.{html,js} (NOT verify-scale — CLDEATH/CLAPOC/CLAGE
still clobbered by index.html applyOverrides).

## Scope: #13 people/walk-cycles · #4 busier sky & streets · #25 drink & smoke ·
##        #24 climber expeditions · #16 helipad gate · #17 nicer stations · #18 bus stops

## Nick's locked answers (2026-07-16 AskUserQuestion)
- #13: SAME tiny scale, real 4-frame walk cycle + varied gaits/postures. No sprite growth.
- #24: MULTI-DAY real expeditions — basecamp day 1 → high camp day 2 → dawn summit + flag
  day 3-4; flag persists for the rest of the life. Check the wallpaper each morning.
- #25: ALL FOUR venues — street pub/biergarten patio, rooftop-bar drinkers, doorway
  smokers (ember glow), park picnics + 2am bus-stop flask.

## Key anchors (verified; engine lines at plan time)
- drawPerson 2170-2193 (3px wide, bob param 0/1 = stand/stride; hat/bag accessories by hseed).
  ~40 call sites pass 0/1 — signature MUST stay back-compatible (bob becomes frame 0..3;
  0/1 keep today's meaning byte-for-byte).
- walking-ped pool gen 1992-1993 (np=WW/16; {x0,dir,sp}); find + upgrade the draw loop
  (gaits: stroll/brisk/jog multipliers, posture variants: kid skip / elderly stoop+cane).
- K3 professions 529-560 (dawn garbage crew hop-off 544, movers 551, sunrise joggers 554-559).
- drawSkyBirds 427 (dusk flocks upgrade lives here); drawBike 2198 (cyclists exist).
- rooftop bar: gen 1855-1858 (rr2<0.14 "bar"), draw 2813-2830 (counter 2821) + call ~3121.
- drawPark 2745; holiday balloon prop idiom 2808 (colour-cycle balloon — reuse for kids/kites).
- busstops: sprop kind gen ~2021-2027 (kd==="busstop" → busstops.push(fpx)) — POSITIONS
  EXIST, NOTHING DRAWS THEM. drawBus 3661 (cruises; no dwell).
- train pattern for dwell: 2092-2103 (TRSTOPS, constant speed + 2.6s dwell path math) and
  stations draw 3307-3340 (platform slab 3312, canopy/stairs/signs/waiting riders,
  boarding when tr.stopped 3307/3354) — #17 beautifies THIS block.
- chopper: helipads built ONCE at world-gen 2060-2064 from FINAL b.h — but buildings rise
  at b.bAge (1859-1876: houseAge/bAge/band, crew) → early-life chopper lands mid-air = the
  "landing on nothing" bug. chopperNow 3379-3389 picks pads blind. FIX: store the building
  ref (or bAge+band+h) per pad; chopperNow filters to pads whose tower is FULLY built
  (cityG ≥ bAge+band); skip slot if none.
- mountains + climbers: drawMountains 6717+ (mts gen 1943-1957, MSC, sn snowline);
  current climbers = rope + 2px specks 6790-6792. #24 replaces with expedition state.
- weather/nice-day gates: fx flags in drawSky/weather block ~1425-1560; picnic/kite want
  clear + warm + weekend (nd day-of-week).

## Design specs
B1 (#13) walk cycle: drawPerson frame param f=0..3 → contact-L / pass (legs together,
  body +1px up) / contact-R / pass. Arms counter-swing on contact frames only. 0/1 today
  == stand/contact so all 40 legacy sites render unchanged. Ped loop: frame =
  floor(now/(140/gaitMul))%4... stride cadence per ped from hash: stroll .75 / walk 1 /
  brisk 1.3 / jog 1.8 (jog also +sp). Postures by hash slice: ~8% kid (1px shorter, skip
  cadence, balloon-holder variant on weekends), ~7% elderly (1px stoop, cane pixel ahead,
  0.55 cadence), rest adult. NO new allocations — all derived per-frame from p fields.
B2 (#4): dusk starling murmuration in drawSkyBirds (L in golden band + autumn/spring
  bias): 12-18 birds following a hash lissajous cloud centre, cheap sin/cos only.
  Daytime park: kids' balloons (reuse 2808 idiom, weekend/nice-day gate), 1-2 kites
  (diamond + wavy 3-seg tail) over the park on breezy clear days (weather.wind gate).
  More ped variety = B1 postures + jog cadence all day near park.
B3 (#25): PUB on the strip — reskin one near-row low building adjacent the busker pitch
  (deterministic pick like neChurches): warm sign "THE LANTERN", patio = 2 tables + 2-3
  patrons, pint-raise anim (arm pixel up/down ~1.4s offset per patron), warm window glow,
  22:00+ a stumbler weaves home (sin sway on x), closes 02:00. Rooftop bars: +2 drinkers
  clink (existing counter 2821), tiny cocktail-glass sign glow at night. Doorway smokers:
  night, office/shop doorways, 1px ember pulses brighter on 3s drag + 2-3px smoke wisp
  rising (reuse drawFireSmoke idiom at 1px); ~2 concurrent city-wide, hash-slotted.
  Park picnics: weekend clear daytime — blanket rect + 2 sitters + basket; bottle glint.
  2am flask: lone bus-stop sitter takes a swig (arm up) every ~9s.
B4 (#24) expeditions: per-life mountain pick (tallest near ridge). EXPED_SLOT = 6 real
  days from life start (cy hash offsets so lives differ). Day 0-1: basecamp at foot —
  2-3 tents (triangles, warm door glow at night) + campfire (drawFlame 3px). Day 2:
  rope team (existing specks idiom) ascends lower third; camp 1 tent appears at dusk.
  Day 3: upper route + camp 2 on the snowline. Day 4 DAWN (L rising through 0.25-0.45):
  summit push — specks reach peak, FLAG planted (2px pole + 3px pennant in city accent
  colour, waves 700ms). Flag + abandoned camps persist REST OF LIFE (pure f(dayIdx) —
  freeze-safe, no state). Next expedition next cycle picks the OTHER ridge/summit hash.
  All geometry f(mountain ridge polyline) — reuse 6717+ ridge sampling.
B5 (#16): helipads entries gain {bAge,band}; chopperNow filters built pads only; if none
  built → return null (no chopper until the first helipad tower tops out). Also verify
  pad y aligns with the CONSTRUCTED roof (pads only valid when construction done, so
  final h is correct by definition).
B6 (#17): station glow-up within 3307-3340 footprint: ribbed canopy with 1px valance +
  hanging line-colour signs, lit name board (city-name hash letters, night glow),
  2 benches w/ seated riders (mix stand/sit by hash), platform edge warning strip (1px
  dashes), stair shaft gets handrail pixel, riders lean/check-watch idle anims (2-frame,
  3-7s hash slots), arrivals board flicker 90s before train dwell (train position is
  already pure f(clock) 2092-2103 — compute lead time from same math).
B7 (#18): drawBusStops(): shelter (3px posts + 5px glass roof + bench) at each busstops[]
  fpx (arrive with furniture law: cityG gate like 3588), 0-3 waiting riders =
  f(hour: rush 7-9/16-18 max, none 3-5am except the 2am flask lonesoul), bus dwell:
  drawBus path gains stop dwell via train-pattern path math (constant cruise + 1.8s
  dwell centred at each stop); riders board (walk to door + vanish) during dwell,
  1-2 alight and disperse. Bus route direction alternates per bus like today.
## Perf & law
No new per-frame allocations in loops; expedition/pub/smokers all bounded (<20 rects
each); murmuration ≤18 birds × 1 rect; everything wraps ±WW for world props; every
lighter block restores source-over; QUAL===0 skips murmuration + smoke wisps + kites.

## Ordered steps & state  ⟵ UPDATE AS EXECUTED
- [ ] 0 branch `living-streets` + this doc committed
- [ ] 1 B1 walk cycle + gaits/postures (render: sidewalk close-up 4 frames + kid/elderly)
- [ ] 2 B5 helipad gate fix (render: young city no chopper; grown city lands on pad)
- [ ] 3 B7 bus stops + dwell + riders (render: rush-hour stop, bus doors, 2am flask)
- [ ] 4 B6 station glow-up (render: dusk platform, arrivals flicker, boarding)
- [ ] 5 B3 vice: pub + rooftop + smokers + picnics (renders: pub night, doorway ember,
      weekend picnic)
- [ ] 6 B2 murmuration + kites/balloons (render: dusk flock, breezy park day)
- [ ] 7 B4 expeditions (renders: NOWOVR day1 basecamp / day2 camp1 / day4 dawn summit +
      flag persistence at day 5)
- [ ] 8 sync ×4 + md5 + npm test (desktop 29 + geocode)
- [ ] 9 kde-repro matrix (tod × age + each feature force) — NO regressions on v1.5 visuals
- [ ] 10 BOTH-PLATFORM GATE (KDE live deploy + WinTest VM render) per standing rule
- [ ] 11 merge → main, bump 1.6.0, tag, watch release (expect fpm-download flakes → rerun)

## What NOT to do
drawPerson signature stays (frame overloads bob; 0/1 byte-identical). Don't touch train
path math constants (2092-2103) — stations read them. helipads fix must NOT alter
world-gen r() draw order (only append fields). Museum/finale/invasion renderers
untouched. mst anchoring untouched. No sound. Flags/camps = pure f(clock,dayIdx), no
persisted state (freeze-safe like ruin pattern).
