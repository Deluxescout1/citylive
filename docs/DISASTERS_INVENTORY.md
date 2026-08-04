# Disasters — inventory (Phase 0 ground truth)

Everything here was **read out of the running engine**, not from memory or from the brief. Where the
expansion brief and this file disagree, **this file wins** — that is the brief's own instruction.

Measured 2026-08-03 against `org.citylive.wallpaper/contents/js/city.js`.

---

## 1. The headline: there are already 27 disasters

The expansion brief proposes ten "new" Tier-1 end-time events. **All ten already ship**, in some form.
It was written without the inventory it mandates in its own Phase 0.

| Brief calls it new | Already in the repo |
|---|---|
| Supervolcano | `volcano` disaster (`drawVolcanoDisaster`, `drawVolcanoLive`) |
| Nuclear strike | `nuke` end-time (`nukeStruck`, `nukeGZX`, `nukeFrontR`, per-block blast collapse) |
| Mega-tsunami | `flood` — exists as **both** a disaster and an end-time |
| Kaiju attack | `kaiju` disaster + `kaiju` and `kaijuwar` end-times |
| Eldritch rift | `rift` disaster (`drawRift`) |
| Alien harvest | `alien` disaster + `alienwar` end-time |
| Zombie endgame | `zombie` disaster + the PLAGUE system, which has its own zombie stage |
| AI uprising | `ai` end-time |
| The descending moon | `moonfall` end-time |
| The mist | `smog` disaster + `pollution` end-time |

**Genuinely new, and all in Tier 2:** earthquake · hurricane · reactor meltdown · dam break ·
firestorm · sinkhole swarm · blackout-riot · meteor swarm.

---

## 2. Survivable disasters — `DIS_TYPES` (15)

Selected per 7-minute slot; a disaster does **not** end the life.

| Type | `DIS_NAME` | Destroys? | Renderer |
|---|---|---|---|
| `asteroid` | ASTEROID | yes | `drawAsteroid` |
| `volcano` | VOLCANO | yes | `drawVolcanoDisaster` |
| `zombie` | ZOMBIES | yes | `drawZombies` |
| `alien` | ALIENS | yes | `drawAliens` |
| `kaiju` | KAIJU | yes | `drawKaiju` |
| `tornado` | TORNADO | yes | `drawTornado` |
| `flood` | FLOOD | yes | `drawFlood` |
| `mech` | MECH WAR | yes | `drawMech` |
| `kraken` | KRAKEN | yes | `drawKraken` |
| `sandstorm` | SANDSTORM | yes | `drawSandstorm` |
| `iceage` | ICE AGE | yes | `drawIceAge` |
| `rift` | RIFT | yes | `drawRift` |
| `blackout` | BLACKOUT | **no** | `drawBlackout` |
| `smog` | SMOG | **no** | `drawSmog` |
| `planecrash` | PLANE CRASH | yes | `drawPlaneCrash` |

`disDestroys(t)` is false only for `blackout` and `smog` — they veil the city, they do not level it,
and they therefore skip the collapse→rubble→rebuild machinery entirely.

**Three tables decide what a disaster IS. Read all three before adding a type:**
`DIS_NAME` (what the ticker calls it) · `disDestroys` (does it use the damage pipeline) ·
`disMinorEvent`.

## 3. End-time events — `DEATHS` (12, +1 off-array)

These terminate the life through the doom flow.

`meteors` · `nuke` · `sunburst` · `ai` · `bh` (black hole) · `alienwar` · `frost` · `kaiju` ·
`flood` · `kaijuwar` · `pollution` · `moonfall`

⚠️ **`ninetails` is deliberately NOT in `DEATHS`.** The array is indexed `h % DEATHS.length`, so
appending to it **re-maps every past life's fate** and rewrites recorded history. Anything new that
terminates a life must follow the same off-array pattern.

## 4. Cadence — measured constants

| Constant | Value | Meaning |
|---|---|---|
| `DIS_SLOT` | 420 000 ms (7 min) | one potential disaster window |
| `DIS_PROB_BASE` | 0.24 | ≈ one disaster per 29 min |
| `DIS_DUR` | 240 000 ms (4 min) | how long the impact lasts |
| `RUIN_CHANCE` | 0.20 | share of lost CAT-5s that scar permanently |
| `APOC_AT` / `APOC_BAND` | 0.98 / 0.02 | the end-time occupies the last 2% of a life |

Census over 40 000 slots: **9 647 disasters**, intensity spread almost perfectly even 1–5, **2 780
lost**, **706 lost CAT-5s**.

🔑 **Footprint is the single most important number for how a disaster reads:**
`w = (14 + intensity*11) * (win ? 1 : 1.7)` → a lost CAT-5 is **117 world px of 2269 — about 5% of the
world**, i.e. it fits inside a single monitor with room to spare.

⚠️ On his machine lives are **one hour** (`cycle:"test"`); the shipped default is a week. Any timing
expressed in real minutes will read completely differently on the two.

## 5. Maps — 28 lands

20 rolled (`BIOMES`) + 8 rare "egg" lands (`EGG_BIOMES`, reachable only via `FORCEEGG` / `egg=`).

| Land | Name | Water | Flags |
|---|---|---|---|
| `alpine` | ALPINE | — | snow |
| `forest` | OLD FOREST | — | |
| `mesa` | RED MESA | river | |
| `cliffs` | SEA CLIFFS | sea | |
| `plains` | OPEN PLAINS | river | skyRelief |
| `beach` | CORAL COAST | sea | |
| `swamp` | THE BAYOU | sea | |
| `volcano` | THE NEW ISLAND | sea | |
| `arctic` | THE PACK ICE | sea | snow |
| `sprawl` | THE SPRAWL | sea | |
| `hell` | THE ASHLANDS | river | |
| `heaven` | THE EMPYREAN | none | |
| `dunes` | THE DUNE SEA | none | dune |
| `karst` | THE KARST | river | tower |
| `fjord` | THE FJORD | sea | snow |
| `salt` | THE SALT MIRROR | sea | |
| `dam` | THE GREAT DAM | river | dam |
| `under` | THE UNDERCITY | sea | **roof** |
| `savanna` | THE SAVANNA | river | herd |
| `canyon` | THE GORGE | river | gorge |
| `leaf` *(egg)* | THE HIDDEN VILLAGE | river | |
| `core` *(egg)* | THE CORE WORLD | none | |
| `fire` *(egg)* | THE CINDER THRONE | river | |
| `air` *(egg)* | THE HIGH TEMPLES | none | |
| `falls` *(egg)* | THE FALLS CITY | river | |
| `orbit` *(egg)* | SPACE CITY | none | **orbit** |
| `plateau` *(egg)* | THE SEALED HEIGHT | river | shrine, snow |
| `rainv` *(egg)* | THE HIDDEN RAIN | river | |

**Water:** 12 river lands · 10 sea lands · 6 with neither.
🚨 **The disaster set predates maps 12–20 entirely** (heaven · dunes · karst · fjord · salt · dam ·
under · savanna · canyon) and has never been audited against them. **Expect the failure mode to be
"renders, but is invisible or nonsensical HERE" — not "throws".**

### The three lands that break the "every disaster everywhere" rule
- **`orbit` (SPACE CITY)** — in low orbit; the planet is the view, lit by planet-light, on a 90-minute
  orbital clock rather than the sun. There is no ground, no weather and no crowd.
- **`under` (THE UNDERCITY)** — has a **ceiling**, not a sky. Anything that arrives from above is
  meaningless.
- **`heaven` (THE EMPYREAN)** — floats; no terrain to crack, flood or bury.

The engine already has predicates for exactly this class of problem — `noOpenSky()` (roof‖orbit),
`underRoof()` (the narrow one) — plus the standing lesson that **two lands sharing one exclusion is
not one predicate**. Locked decision: *adapt where sane, exempt where absurd, and document the
exemptions in the matrix* rather than forcing every cell green.

## 6. Background / parallax layers

There is no generic layer stack. Each frame is built from:

1. **The land backdrop** — dispatched by `drawMountains(g,L,now,nd)` (the name is historical; it is
   the dispatcher). It branches on biome flags before the default three-band mountain range:
   `leaf→drawVillageCliff` · `forest→drawForestBackdrop` · `core→drawCoreWorld` · `gorge→drawGorge` ·
   `dune→drawDunes` · `tower→drawKarst` · `dam→drawGreatDam` · `roof→drawUndercity` ·
   `herd→drawSavanna` · `orbit→drawOrbit` · `shrine→drawPlateau`.
2. **Three city ranks**, all from `makeLayer(seed,y0,…)` at different baselines:
   `far` (`HORIZON-14*KSP`) · `mid` (`HORIZON-6*KSP`) · `near` (`HORIZON`).
3. **The ground band** — `HORIZON`→`SH`, 78 world px: far pavement, carriageway, promenade, taskbar
   allowance. Fully spoken for.

**The damage hook already exists.** `landDamageAt(wx, ww)` returns a graded 0..1 and is the shared
predicate every land feature can ask.
🚨 **It has TWO consumers in the entire engine.** The sweep never reached most lands — which is
exactly the brief's "background layers take damage" requirement, and it is mostly a matter of *using
the helper that exists*. **A helper existing is not the helper being used.**

Established scope rule, already written into the code and confirmed as a locked answer:
**vegetation and structures die; landform only scars.** A hill that vanishes reads as a bug rather
than as damage. Scars persist for the life; the city rebuilds around them.

## 7. How the HUD, ticker and population read disasters

⚠️ **There is no event bus, and there must not be one.** No entities, no simulation loop, nothing
subscribes to anything. Every consumer *pulls* from clock-derived state each frame:

- `disasterInfo(idx)` — the pure per-slot record (type, intensity, position, seed, win/lose).
- `disasterNow(now)` — the live one, or null. `curDis` is set from it **every frame** and read in 54
  places.
- **Ticker** — `tickerMsg(now)` reads `curDis`, `curWar`, `curPlague`, the named dead
  (`namedDeadAt` / `namedDeadRevealed`) and the mayor's emergency succession, in priority order. It is
  also the chronicle's source, so whatever it says is what gets written into `chronicles/life-N.md`.
- **Population** — `cityPop()` is derived from the built layout; `almanacPop()` is a pure estimate
  from growth for callers that must not touch render globals.
- **HUD / chrome** — `drawSkyClock`, `chromeClaim`, `cityStatus(now)`.

🔑 **This pull-from-clock architecture is not a gap to be filled — it is the reason three independent
monitor processes draw one agreeing world without communicating.** The determinism rule that follows
from it is stricter than "use seeded streams": **scripted from a hash, never simulated.** Anything
that accumulates state diverges across the three screens.

## 8. Forcing anything — the debug console already exists

The brief asks for a dev-only trigger. It is already here, via the render harness:

```bash
QT_QPA_PLATFORM=offscreen qml6 desktop/qml-land-frame.qml -- \
    land=<key>|egg=<key> woff=0|776|1629 age=0..1 hour=0..23 \
    dis=<type> disi=1..5 disf=0..1 disseed=N disx=<0..1 of WW> diswin=0 \
    death=<key> apocms=<ms> gore=full|…
```

Globals: `FORCEDIS {type,intensity,xf,w,seed,f,win,ruin}` · `FORCEAGE` · `FORCEBIOME` / `FORCEEGG` ·
`FORCEWX` · `NOWOVR`/`CLOCK`.
⚠️ `FORCEDIS.xf` is a fraction of **WW (2269)**, not of the screen.
⚠️ `FORCEAGE` short-circuits `cityGrowth` and returns `cy = age*0.78`, so the peak plateau and the
apocalypse band are **unreachable through `age=`**.

## 9. Known defects to sweep into this phase

- 🚨 **`drawVolcanoDisaster` raises a generic substitute cone on the 19 non-volcano lands.** A
  long-standing note, never verified for severity.
- The disaster set has never been audited against maps 12–20.
- **Phase 8 hangs off disasters** — named dead, the toll, emergency succession, memorials, recovery
  crews and the chronicle all read the disaster record. Anything that changes the disaster *shape*
  must be re-checked against it.

## 10. What Phase 9 actually is, after this inventory

Not "add ten disasters". It is:

1. **Retrofit all 27** to a uniform `warn → impact → ripple → recover | terminate` lifecycle.
2. **Make `landDamageAt` real** across every land's backdrop — the requirement that is currently a
   two-consumer helper.
3. **Audit and adapt** every disaster × every one of the 28 lands, with honest documented exemptions
   for `orbit`, `under` and `heaven`.
4. **Then** the eight genuinely new Tier-2 disasters.

Verification is **both** an automated matrix pass (so nothing is silently missing) **and**
signature-shot contact sheets (so the moment actually reads at wallpaper distance). Neither alone is
sufficient: the automated pass cannot see "invisible", and the sheets cannot cover 750 cells.

---

# The capability matrix — 23 disasters x 28 lands

**Generated, not written.** `desktop/qml-dis-matrix.qml` sets each biome up for real and asks
`disExemption`, `DIS_SIG`, `disDestroys` and `disMinorEvent` what they actually say. Regenerate with:

```
QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-dis-matrix.qml
```

420 cells typed by hand are correct on the day they are typed and wrong the first time somebody adds a
land — which is exactly how the disaster set came to predate maps 12-20 with nobody noticing. It has
already earned that: the generated pass found that THE HIGH TEMPLES had no exemptions at all (six
needle columns in open air, with floods), and that SPACE CITY was sending a **tornado** because the
landlocked-kraken rule matched and returned before the orbit table was ever read.

## Exemptions — "adapt where sane, exempt where absurd"

They **substitute**, they never skip, and they call `r()` zero times: every field of a disaster comes
off one ordered stream, so consuming or skipping a roll would silently re-roll `win`, `w`, `seed` and
`ruin` for every disaster on every land. Returning a different type for the same roll leaves the
stream untouched.

⚠ It does change what a PAST life is recorded as having suffered on these four lands, because the
almanac replays history through the same function. That was already true of the kraken rule. A fair
trade for not showing a tornado inside a sealed cavern — but a real cost, not a free one.

```
SIGNATURES (W=warn A=after): asteroid:WA volcano:WA zombie:WA alien:WA kaiju:WA tornado:WA flood:WA mech:WA kraken:WA sandstorm:WA iceage:WA rift:WA blackout:WA smog:WA planecrash:WA earthquake:WA hurricane:WA meltdown:WA dambreak:WA firestorm:WA sinkhole:WA riot:WA meteorswarm:WA
SIGNED 23/23   SUBSTITUTIONS 49
    alpine | ALPINE | ocean=Y | exempt=- | (all fifteen play here)
    forest | OLD FOREST | ocean=Y | exempt=- | (all fifteen play here)
    mesa | RED MESA | ocean=N | exempt=- | kraken->tornado
    cliffs | SEA CLIFFS | ocean=Y | exempt=- | (all fifteen play here)
    plains | OPEN PLAINS | ocean=N | exempt=- | kraken->tornado
    beach | CORAL COAST | ocean=Y | exempt=- | (all fifteen play here)
    swamp | THE BAYOU | ocean=Y | exempt=- | (all fifteen play here)
    volcano | THE NEW ISLAND | ocean=Y | exempt=- | (all fifteen play here)
    arctic | THE PACK ICE | ocean=Y | exempt=- | firestorm->blackout
    sprawl | THE SPRAWL | ocean=Y | exempt=- | (all fifteen play here)
    hell | THE ASHLANDS | ocean=N | exempt=- | kraken->tornado
    heaven | THE EMPYREAN | ocean=N | exempt=heaven | volcano->asteroid, flood->tornado, kraken->tornado, sandstorm->tornado, earthquake->asteroid, dambreak->tornado, sinkhole->asteroid
    dunes | THE DUNE SEA | ocean=N | exempt=- | kraken->tornado, dambreak->flood
    karst | THE KARST | ocean=N | exempt=- | kraken->tornado
    fjord | THE FJORD | ocean=Y | exempt=- | (all fifteen play here)
    salt | THE SALT MIRROR | ocean=Y | exempt=- | (all fifteen play here)
    dam | THE GREAT DAM | ocean=N | exempt=- | kraken->tornado
    under | THE UNDERCITY | ocean=Y | exempt=roof | tornado->flood, sandstorm->smog, iceage->blackout, planecrash->blackout, hurricane->blackout
    savanna | THE SAVANNA | ocean=N | exempt=- | kraken->tornado
    canyon | THE GORGE | ocean=N | exempt=- | kraken->tornado
egg leaf | THE HIDDEN VILLAGE | ocean=N | exempt=- | kraken->tornado
egg core | THE CORE WORLD | ocean=N | exempt=- | kraken->tornado, dambreak->flood
egg fire | THE CINDER THRONE | ocean=N | exempt=- | kraken->tornado
egg air | THE HIGH TEMPLES | ocean=N | exempt=air | volcano->asteroid, flood->tornado, kraken->tornado, earthquake->asteroid, dambreak->tornado, firestorm->tornado, sinkhole->asteroid
egg falls | THE FALLS CITY | ocean=N | exempt=- | kraken->tornado
egg orbit | SPACE CITY | ocean=N | exempt=orbit | volcano->asteroid, tornado->asteroid, flood->asteroid, kraken->asteroid, sandstorm->asteroid, iceage->asteroid, smog->blackout, planecrash->asteroid, earthquake->asteroid, hurricane->blackout, dambreak->asteroid, firestorm->blackout, sinkhole->asteroid
egg plateau | THE SEALED HEIGHT | ocean=N | exempt=- | kraken->tornado
egg rainv | THE HIDDEN RAIN | ocean=N | exempt=- | kraken->tornado
```

## Lifecycle signatures — 23 of 23

`W` = a bespoke WARNING, `A` = a bespoke AFTERMATH. Everything unsigned still gets the generic arc
(evacuation, medics, crews, scaffolding) — it is not missing, it is just not yet its own.

| Signed | What it does |
|---|---|
| `volcano` | fissures venting and glowing before it blows · lava cooling orange→black, ash drifts swept away · **and the cone stays for the life** |
| `kaiju` | flocks leaving, water humping, a footfall from past the district · tracks filling in, the beast receding on the horizon |
| `blackout` | brownout dips rolling through · a **restoration front** sweeping across, crews at its edge |
| `smog` | a lid forming at roof height · lifting from the bottom, street first, masks coming off |

All fifteen of the original set are signed, and so are the eight Tier-2 additions — `earthquake`
(foreshocks · a fissure that never quite levels again) · `hurricane` (shutters going up · a wrack line)
· `meltdown` (deliberate venting, buses leaving · a zone nobody reopens) · `dambreak` (the leak before
the wall · a waterline far above the street) · `firestorm` (glow over the ridge, ash ahead of it ·
ground that stays burnt) · `sinkhole` (the road sags first · plates and barriers, never filled) ·
`riot` (it gathers · boarded frontages) · `meteorswarm` (the first few, high · many small craters).

**Tier 2 arrives through a cutover**, exactly as the cadence change did. `DIS_TYPES` is INDEXED, not
hashed by name — `(r()*DIS_TYPES.length)|0` — so growing it from 15 to 23 would re-map every past slot
and retroactively change what every life in the chronicles suffered. That is the `DEATHS` trap one
array over. Slots before `DIS_TYPE_CUTOVER` roll the frozen 15; after it, all 23. One `r()` call either
way, so the stream is untouched.

## Where the landscape damage reaches

`landDamageAt` had **two** consumers in the whole engine before this phase. Now:

| Coverage | Lands |
|---|---|
| **Full profile** — relief follows its own cached height field | the 14 on the shared dispatcher (alpine, mesa, cliffs, plains, beach, swamp, volcano, arctic, sprawl, hell, heaven, fjord, salt + variants) · savanna · dunes · karst · gorge · Hyrule |
| **Base band only** — the shallow strip at the horizon, no relief treatment | forest boles · the dam · the cavern ceiling · the village cliff |
| **Ground + vegetation** — every land | via `drawTerrain` and `drawTree`/`drawAcacia` |
| **Exempt** — no ground to scar | SPACE CITY · THE CORE WORLD |

⚠ The four "base band only" entries are honest gaps, not oversights that got written up as features.
