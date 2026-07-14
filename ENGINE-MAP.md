# CityLive engine map (`contents/js/city.js`)

A navigation + labelling guide to the whole engine. `city.js` is **one ~6970-line
file** of pure JavaScript, loaded by `contents/ui/main.qml` and drawn into a QML
`Canvas` 2D context. There is no build step and no framework — every subsystem is a
plain function drawing pixels.

> Line numbers below are **approximate anchors** (they drift as the file is edited);
> the **section order** is stable. Search for the quoted banner comment to jump.

---

## 1. Entry points & the two calls QML makes

| Function | Line ~ | Role |
|---|---|---|
| `setup(scene, opts)` | 1764 | Builds the world for this screen. `opts = {cw,ch,woff,ww,taskbarWp,pxk,zoom,quality}`. Called on bring-up and whenever geometry/scene changes. |
| `draw(g, pass)` | ~6142 | Paints one frame. `pass`: `undefined` = single canvas · `"bg"` = slow backdrop · `"fg"` = moving content. Called every timer tick (8–12 fps by quality). |

`main.qml` computes per-screen geometry (device-pixel-ratio, zoom, world offset,
taskbar height) and passes it in; **all world geometry inside `city.js` is in world
pixels**, mapped to canvas pixels by `ZOOM`.

### Coordinate system & key globals (lines ~30–70)
- `WOFF` — this screen's left edge in world px · `WW` — whole-city width · `SW` — this screen width.
- `HORIZON` — the y of the street baseline · `KSP` — resolution scale (speeds/masses adapt to `pxk`).
- `wrapW(x)` — wrap a world-x into `[0,WW)` so vehicles/trains cross screen seams in sync.
- `LANE[]` — the 4 traffic lanes (`.d` direction ±1, `.o` y-offset from HORIZON).

### Test / override hooks (used by the render harness)
- `NOWOVR` — override `Date.now()` to render any moment (past or future; the sim is deterministic).
- `FORCEDIS = {type,intensity,xf,w,seed,f}` — force a specific disaster at phase `f∈[0,1]`.
- `CLOCK` — mirror of the override clock used by some subsystems.
- Offscreen render recipe: `QT_QPA_PLATFORM=offscreen qml6 <file.qml>` with a `Canvas`
  that sets `City.NOWOVR`, calls `City.setup(...)`, then `City.draw(g)` and
  `grabToImage(...).saveToFile(...)`. See `tools/timelapse.sh` and the scratch
  `render_dis.sh` for working examples.

---

## 2. Regional & world identity (lines 15–139)
- `regionOf(lat,lon)` / `REGION` (15–25) — the city wears the vernacular of its LAT/LON.
  Norwich CT ⇒ `"newengland"` (clapboard, brick, **steep slate roofs**, steeples, barns).
  **Note:** REGION is fixed by *location*, not per-life — every life here is New England.
- `PEDC / SKINC / HAIRC` — pedestrian clothing / skin / hair palettes (expanded 2026-07 for crowd variety).
- `NOTIF_ROWS / notifLane(pref) / resetNotifLanes()` (~68) — **alert-lane allocator**: every
  banner (disaster/war/apocalypse/election/mayor) claims a free row each frame so simultaneous
  alerts never overprint. Reset at the top of `draw()`.
- `DISTRICTS` (80–131) — `downtown` (glassy core), `entertainment` (neon strip), `residential`,
  `oldtown` (brick), `industrial`. Each carries its palette, window `layouts`, `crowns` pool,
  and per-feature probabilities (neon, billboard, fire-escape, tank, awning, laundry, brick…).

## 3. Sky, sun, moon, stars (lines 140–305)
- `sun` (NOAA-simplified) 140 · `moon phase` (real lunation) 169 · **real Norwich night sky**
  (actual bright-star positions rotating with the wall clock + a filler star field) 191 ·
  celestial calendar 283.

## 4. Ambient life & rare spectacles
- "STREET LIFE 2 & RARE SPECTACLES" 306 · songbirds/gulls/UFO/whale/cows 349–453 ·
  **REALISTIC FIRE** shared flame primitive 633 · forest fires 660 · grazing/butterflies 725–800.
- "THE DOZEN" (hail, heat-shimmer, fishing, night market, performers…) 813.
- "THE FAMILY" — generations you can watch grow, weddings, the elder passing 1032 ·
  little lives / skaters / regatta 1150–1290 · aurora / meteors / great comet 1291–1412.

## 5. Weather & rhythm (lines 1413–1605)
- Live weather fetch + nowcast + 12h projection 1413 · daily rhythm (rush-hour density) 1537 ·
  season → foliage 1559 · special calendar days 1569 · `cwInst()` (crosswalks paint in as roads pave) 1604.

## 6. World generation (lines 1606–1935)
- **Massing** — setback segment stacks → unique silhouettes 1641.
- **Crowns** — pool per district; NE override forces gable/gambrel/hip on low/mid-rise
  (tall towers + `watertower` are exempt) 1674.
- **Window systems** per district layout 1683 · natural growth (a plot starts as a house,
  then redevelops into its designed tower) 1731.
- Geography (ocean ~60%, mountains) 1796 · street furniture & lamps 1876.
- **Vehicle fleet** built here 1851: mix of `sedan/taxi/van/pickup/suv/hatch/sport/convert`,
  20-colour palette. `cars[] = {lane,x0,sp,c,kind}`.
- Pedestrians `peds[]` 1849 · crosswalks `crosswalks[] = {x,ph,seed}` 1852 · drones/bats/cables/searchlights.

## 7. Core sprite primitives
- `drawCar(g,x,y,col,dir,L,kind)` **2048** — 8 body types, left-anchored 11px body,
  shared `gear(len)` for wheels/hover-underglow + head/tail lamps.
- `sig(now,ph)` **2087** — signal phase: green `<8500` · yellow `<9000` · red else (of a 12000ms cycle).
- tiny 3×5 pixel font 2211 · sky-clock HUD pill 2257 · birthday banner 2340.
- **`drawCrown(...)` 2374** — 17 roof types: gable, gambrel, hip, steeple, step, peak, dome,
  tank, chevron, battlement, blade, spire, antenna, helipad, stack, **billboard**, **watertower**.
- park/greenspace 2454 · pre-development house 2487 · **building body** (segmented silhouette,
  night radiance halo) 2563.

## 8. Big set-pieces & transit (lines 2743–4342)
- Elevated train + stations 2743 · helicopter 2845 · airport (control tower, departures) 2845 ·
  street furniture/steam/pigeons/bus/window-washers/dock-cranes 2979–3129 · buskers 3130 ·
  harbour 3147 · rooftop parties 3326 · meteor showers 3396 · **rival city across the bay** 3415 ·
  newspapers-on-the-wind 3568 · farmers' market / marathon / outdoor movie 3734.
- **LANDMARKS** 3847 — stadium, cathedral, ferris wheel, hot-air balloons, ad-blimp.
- **LIVING NATURE** 4195 · parade / construction site 4209.

## 9. Disasters (lines 4343–4835)  ← heavily revised 2026-07
- Scheduling: `DIS_SLOT/DIS_PROB/DIS_DUR`, `disasterInfo(idx)`, `disasterNow(now)`,
  `rebuiltZones()` (a struck block rebuilds into a new reseeded tower) 4343–4430.
- Response: `drawJetPass` / `drawTank` / `drawMilitaryResponse` (barricades, tanks, jets, searchlights, EMS) 4489–4530.
- **The 12 threats** 4528: `drawAsteroid, drawVolcano, drawZombies, drawAliens, drawKaiju,
  drawTornado, drawFlood (+submerged car), drawMech, drawKraken, drawSandstorm, drawIceAge, drawRift`.
- **`drawDisasterAtmosphere` (~4750)** — citywide sky wash in the threat's signature colour
  (additive glow for fire/energy threats, dark tint for storm/flood/plague). `DIS_ATMO` map.
- `drawDisaster` dispatch + core glow · `drawDisasterHud` flashing alert bar (uses `notifLane`).
- `drawDisasterBuilding` — per-phase warn→strike→rubble→rebuild→new tower.

## 10. City lifecycle (lines 4836–6141)
- **Grand cycle** — 1 week per life: wilderness → metropolis → cataclysm → rebirth 4836.
  `GROW_EPOCH`, `GROW_CYCLE`, `GROW_OFFSET_DAYS` (fast-forward knob), reincarnation theme library, economy swings.
- Settlers / lumber camp / hunters / farms / barns / founders' caravan 5023–5410.
- **ELECTIONS** 5554 · **WAR** (tiers by era; election funds the army) 5620 ·
  grand cataclysm 5770 · **THE SPACE AGE** 5844 · sun explodes / AI takeover 6065.

## 11. The frame: `draw(g, pass)` (lines ~6142–6971)
Order per frame: reset alert lanes → rebirth check → weather → sky/celestial → mountains →
rival city → skyline (bg buildings → near buildings, with night radiance & eclipse) → street +
lane markings + **crosswalks** → **traffic** (queue at red lights; see below) → buses/EMS/crash →
pedestrian signals → pedestrians (flee during disasters) → building foot-traffic → calendar events →
**disaster overlay + HUD** → grand cataclysm veil → weather FX (rain/snow layers).

### Traffic & the intersection stop (~6520)
Cars are positional functions of time (`carWX`), not physics bodies. Approaching a **red**
crosswalk, a car's **nose** (`noseWX`, accounting for the left-anchored 11px body + heading)
parks 2px short of the zebra; cars already *in* the box clear it instead of freezing. Queue
rank backs each car off one body length. `STOPZ` = detection zone, `CARLEN` = body length.

---

## Change log of this pass (2026-07-11)
1. **Intersection fix** — nose-aware stop line so no car parks on the crossing (~6520).
2. **Alert allocator** — `notifLane` per-frame row booking so banners never overlap (~68, reset in `draw`).
3. **Disasters** — `drawDisasterAtmosphere` citywide sky wash; scaled-up kraken/mech/tornado/flood(+car)/zombie sprites.
4. **Variety** — 5 new car body types + wider palette; expanded ped clothing/hair/skin + hats/bags;
   `billboard` + `watertower` crowns.

## Still open
- **#5 Asset accuracy audit** — walk every `drawX` for proportion/colour correctness.
- **#7 Cross-OS** — reconcile the stale `phone/` browser fork (missing ~40 functions) with this
  engine so one `city.js` runs in both QML and any browser (`city.js` is already nearly QML-free).
