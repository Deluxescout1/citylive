# The Lands

Every life the world reboots onto one **land** (biome). The land decides the backdrop, the palette,
what grows, what lives there and — on several of them — what the *city itself* is allowed to do.
This file is the map: which lands exist, what draws each one, how to render one on demand, and the
rules that apply to all of them.

Companion docs: [`ENGINE-MAP.md`](../ENGINE-MAP.md) for the engine as a whole,
[`LAND-hyrule.md`](LAND-hyrule.md) for the land currently under active work.

---

## 1. The two pools

```js
var BIOMES     = [...]   // ~line 3199 — the 20 ordinary lands, rolled every life
var EGG_BIOMES = [...]   // ~line 4096 — 8 rare "egg" lands, rolled separately and much less often
```

### 🪤 THE TRAP THAT COSTS EVERY NEWCOMER A SESSION
**An egg land is NOT reachable through `FORCEBIOME`.** They live in a separate array and are chosen
by a separate roll, so `FORCEBIOME = "plateau"` silently falls through to an ordinary land and you
spend an hour judging the wrong frame. Egg lands need `FORCEEGG`:

```js
City.FORCEEGG = "plateau"; City.FORCEBIOME = null;    // correct
City.FORCEBIOME = "plateau";                          // WRONG — renders a different land entirely
```

The render harness exposes this as `egg=` versus `land=`. **If a land is in the egg list, use `egg=`.**

| Ordinary (`land=`) | | Egg (`egg=`) | |
|---|---|---|---|
| `alpine` | ALPINE | `leaf` | THE HIDDEN VILLAGE |
| `forest` | OLD FOREST | `core` | THE CORE WORLD |
| `mesa` | RED MESA | `fire` | THE CINDER THRONE |
| `cliffs` | SEA CLIFFS | `air` | THE HIGH TEMPLES |
| `plains` | OPEN PLAINS | `falls` | THE FALLS CITY |
| `beach` | CORAL COAST | `orbit` | SPACE CITY |
| `swamp` | THE BAYOU | `plateau` | *(the Hyrule land — see `LAND-hyrule.md`)* |
| `volcano` | THE NEW ISLAND | `rainv` | THE HIDDEN RAIN |
| `arctic` | THE PACK ICE | | |
| `sprawl` | THE SPRAWL | | |
| `hell` | THE ASHLANDS | | |
| `heaven` | THE EMPYREAN | | |
| `dunes` | THE DUNE SEA | | |
| `karst` | THE KARST | | |
| `fjord` | THE FJORD | | |
| `salt` | THE SALT MIRROR | | |
| `dam` | THE GREAT DAM | | |
| `under` | THE UNDERCITY | | |
| `savanna` | THE SAVANNA | | |
| `canyon` | THE GORGE | | |

---

## 2. How a land gets drawn

`drawMountains(g,L,now,nd)` (~line 36634) is the **dispatcher**, despite the name. It is called once
per backdrop frame and the first thing it does is hand off to a land-specific renderer:

```js
if(curBiome.k==="leaf")  { drawVillageCliff(...); return; }   // the range is a WALL here
if(curBiome.k==="forest"){ drawForestBackdrop(...); return; }
if(curBiome.k==="core")  { drawCoreWorld(...); return; }
if(curBiome.gorge)       { drawGorge(...); return; }
if(curBiome.dune)        { drawDunes(...); return; }
if(curBiome.tower)       { drawKarst(...); return; }
if(curBiome.dam)         { drawGreatDam(...); return; }
if(curBiome.roof)        { drawUndercity(...); return; }      // a CEILING, not a range
if(curBiome.herd)        { drawSavanna(...); return; }
if(curBiome.orbit)       { drawOrbit(...); return; }          // the PLANET is the view
if(curBiome.shrine)      { drawPlateau(...); return; }        // the Hyrule land
// …otherwise: the ordinary three-band mountain range
```

Note the dispatch is **on biome FLAGS** (`gorge`, `dune`, `tower`, `roof`, `herd`, `shrine` …) as
often as on the key. A flag is set in the biome row, so several lands can share one renderer.

Lands with motion also register a **live-pass** renderer (`drawSavannaLife`, `drawUndercityLive`,
`drawHyruleLive`, …). The split matters:

| Pass | Rate | What belongs in it |
|---|---|---|
| `bg` | ~0.5 fps | Landform, buildings, anything static |
| `live`/`fg` | 8–12 fps | Anything that **moves, pulses or flickers** |

> ⚠ **A pulse drawn in the `bg` pass does not pulse — it steps**, and stepping light in an otherwise
> still backdrop is what reads as the whole background juddering. If it changes, it goes live.

---

## 3. Rules that apply to every land

These are earned, each one from a shipped bug. They are restated in the code at the sites that broke.

1. **THE THREE THINGS EVERY LAND THAT READS HAS** — one big object · extreme value contrast ·
   scale references. A land failing to read is nearly always failing one of these three.
2. **World-anchor everything — placement AND size.** A size derived from `SW` draws one monument at
   three different sizes on a three-monitor desktop. Derive from `HORIZON`/`WW`.
3. **Anything that belongs to a thing is positioned FROM that thing.** Not from a constant, not from
   a formula that happens to agree today. This is the single most repeated fault in this engine — a
   temple seated off a constant instead of its plateau, a gate off the hill's centre instead of its
   town, a road's whole population off the road's *previous* position.
4. **Regularity must break three ways** (position, width, length). Alpha alone will not do it, and
   `(i*K + salt) % WW` is an arithmetic progression, not a scatter.
5. **A reflection must be DARKER than the water.** Six lands have now taught this.
6. **Scripted from a hash, never simulated** — three monitors run three independent processes, and
   anything that accumulates state diverges between them.
7. **Per-column detail is a choice, not a requirement.** If the thing you are drawing only changes
   every N columns, accumulate a run and flush when it *actually* changes. Two features this way
   went from +5.4 ms and +9 ms on the backdrop to cheaper than what they replaced.
8. **`buildingHasRoof(b,cityG)` before mounting anything on a roof** — built, *and* no construction
   site, *and* no civic landmark on the plot. `b.h` is a tower's FINAL height and the tower is not
   drawn until it has grown.

---

## 4. Looking at a frame

### Render any land at Nick's real geometry
```bash
QT_QPA_PLATFORM=offscreen qml6 desktop/qml-land-frame.qml -- \
    egg=plateau woff=776 age=0.45 hour=13 out=/tmp/land
```
`land=` or `egg=` · `woff=` 0 / 776 / 1629 are his three monitors · `age=` 0…1 is the city's growth ·
`clock=` renders an absolute moment (and **overrides `hour=`**) · `dis=`/`death=` force disasters.

> 🚨 **RENDER YOUNG AS WELL AS GROWN.** The harness default is `age=0.85`, and at least two shipped
> bugs were *invisible* at that age — rooftop decorations that only exist while buildings are ungrown,
> and a hole in a road that a grown skyline paints over. His machine runs 1-hour lives, so he passes
> through every age constantly. Check 0.2 and 0.45 too.

### Find out what drew a pixel
```bash
node desktop/tools/whodrew.js <x0> <y0> <x1> <y1> egg=plateau woff=1629 age=0.45
```
Loads the engine into a `vm`, hands it a recording canvas, and prints the **function and line** of
everything that filled inside that box. Use it instead of reasoning about the code — the companion
move is to sample the colour out of the user's screenshot first and grep for it. *A colour is an
index into the source.*

### Time a change
```bash
QT_ASSUME_STDERR_HAS_CONSOLE=1 QT_QPA_PLATFORM=offscreen qml6 desktop/qml-perf-hyrule.qml
```
Interleaves the land under test with a **matched control land** at the same hour, sky and age, and
reports a per-pass delta. Comparing a land against a *different* land's weather measures the weather.

### Put a land on the real desktop
Edit `org.citylive.wallpaper/contents/config.local.json` — `"land": "<key>"` or `"egg": "<key>"` —
then `./install.sh`. Verify it landed by grepping the **installed** `localcfg.js`, not the repo copy.
⚠ `install.sh` restarts plasmashell; check nothing is mid-game first.
