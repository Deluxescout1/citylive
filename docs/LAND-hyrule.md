# THE SEALED HEIGHT — the Hyrule land (`egg` key: `plateau`)

The land currently under active work. An N64-Ocarina-of-Time homage: rolling green field with a
castle on a bluff, a volcano at one end and a lake at the other, and the **modern city growing below
it all**. The two halves of the frame are the point — an ancient kingdom above, a corporate skyline
underneath.

**Reach it with `egg=plateau`.** See [`LANDS.md`](LANDS.md) §1 — `land=plateau` silently renders a
different land and has cost more than one session.

> ⚠ **The on-screen name is still the shipped string "THE GREAT PLATEAU"**, which is the game's own
> place name and breaks the homage rule stated in the comment directly above it. The intended rename
> is **THE SEALED HEIGHT**; it is open and needs Nick's confirmation now the land is explicitly OoT.

---

## 1. Geography — where everything is, in world fractions

West → east, following his own map:

| Fraction | Feature | Constant | Notes |
|---|---|---|---|
| `0.12` | **Lake Hylia** + the **Water Temple** on its island | `HY_LAKE_X` | A band with two shores, set back in the field |
| `0.30` | **Lon Lon Ranch** | `HY_RANCH` (local) | Barn, silo, farmhouse, corral with stock |
| `0.44` | **The castle bluff** — castle, walled town, Temple of Time | `HY_BLUFF_X` | The one big object |
| `0.68` | **Kakariko** | `HY_KAKARIKO` (local) | Where the highway ends; a trail carries on up |
| `0.80` | **Death Mountain** + the **cave** | `HY_DEATH_X` | Ring of cloud, rock folk on its flanks |
| `0.965` | **The Great Deku Tree** + its grove | *(inline)* | Kokiri Forest, far east |

The world is 2269 px wide across three monitors (`woff` 0 / 776 / 1629), so roughly: the **lake and
the ranch are on screen 1**, the **castle on screen 2**, **Death Mountain and the Deku Tree on
screen 3**. `hyruleSolo()` / `hyruleRotate()` exist for one-monitor desktops, where a third of the
world is a whole screen.

---

## 2. The shared accessors — read these, never re-derive them

This land has produced the same class of bug **five times**: something positioned off a constant, or
off a stale copy of where another thing used to be. Every position that more than one feature needs
now lives in exactly one function. **If you need to know where something is, call the accessor.**

| Accessor | Answers |
|---|---|
| `plateauSurfaceAt(wx)` | the height of the LAND at a world x (field / hill / mountain) |
| `hyRoadY(wx)` | where the highway is — **the traffic, the signposts and the spurs all read this** |
| `hyRoadFirm(wx)` | is the road on dry ground here? (false inside the lake's band) |
| `hyRoadOn(wx)` | does the road EXIST here? (firm ground **or** a bridge over the shallows) |
| `hyMountainTop(wx)` | Death Mountain's silhouette at a world x, or `-1` off it |
| `hyHillTop(wx)` | the castle bluff's dome, or `-1` off it |
| `hyOpenField(wx,y)` | is this point open grass, not the flank of a mass? |
| `hyLakeY/W/H/Top/Bot/T` | Lake Hylia's geometry — surface, width, depth, both shores |

> 🔑 **`plateauSurfaceAt` is the OUTLINE, not the FACE.** Seating figures on it balances them on the
> silhouette edge like beads on a wire. To put something *on* a mass, take its top and push down into
> it — that is what `hyMountainTop` + an offset is for.

---

## 3. What is built

**Backdrop (`drawPlateau`, ~line 24146)** — far range · two rolling field bands · the Great Deku Tree
and its grove · Lake Hylia (two shores, hazed, island) and the **Water Temple** · Death Mountain, its
crater and the **cave** · the castle bluff with its cut shelf, the **walled town** (battlements,
gatehouse, Triforce over the gate, market stalls, chimney smoke), the **Temple of Time** inside the
walls and the **castle** on the crown · signposts and roadside shrines · **Lon Lon Ranch** · the
**road network**.

**Live (`drawHyruleLive`, ~line 23006)** — shrine glow (it pulses) · the mountain's burning ring ·
`drawFieldLife` (carts, riders, walkers on the road; horses in the field and in the ranch's corral) ·
`drawHyruleFolk` (rock folk on the mountain, water folk at the lake).

**Landmark renderers** — `drawHeightCastle` · `drawTempleOfTime` · `drawWaterTemple` · `drawRanch` ·
`drawDekuTree` · `drawTriforce`.

**The road network.** One highway the length of the field, drawn **in runs** (not per column) with a
crown, cart ruts, a verge and a bank; **spurs** that leave it and recede toward each landmark,
narrowing as they go; a **straight ramp** climbing the bluff to the town gate; and a worn trail from
Kakariko up to the mountain cave. Bridged where it meets water — which, since the lake moved back,
it currently never does. That is correct and self-restoring: `hyRoadFirm` still asks honestly.

**Damage.** `landDamageAt` is sampled across the land, so the field scorches, the town burns, towers
are lost outward-in and the castle's great spire snaps (taking the Triforce with it).

---

## 4. The traps this land has already sprung

Each of these shipped and had to be found the hard way. They are all restated at the code site.

1. 🪤 **`land=plateau` renders a different land.** Egg lands need `egg=`/`FORCEEGG`.
2. **The temple was seated off a constant** (`HORIZON*0.30`) instead of off the plateau it stood on,
   so it floated 38 px above one rim and was buried 9 px under another — *for months*, reading as a
   cloud.
3. **The gate and its Triforce were pinned to the hill's centre**, so when the town shifted to clear
   the castle they were left standing on open grass.
4. **The road moved and nothing on it moved with it** — the traffic kept a private copy of the road's
   old y and was drawn 100 px above the road for weeks. The land looked empty *and* the road looked
   pointless, from one cause.
5. **The lake's surface height was written out four times**, so moving the lake meant finding all
   four — and the fourth (the highway's own bridge test) was missed, leaving 145 px of road missing.
6. **The switchback climbed to the hill's centre**, 130 px from the gate it existed to reach — and
   retargeting alone made it *worse*, because leg length has to come from the climb, not from `hW`.
7. **The castle was a comb of pencils** — nine towers of one width, evenly spaced, on a flat slab.
   The fault was composition, not detail; ornament on a comb is an ornate comb.
8. **The curtain wall's "coursing" ran vertically**, which is a palisade, not masonry.
9. 🪤 **Three inverted triangles in one session** (silo cap, farmhouse roof, temple steps): a loop
   that grows `y` while shrinking the width draws the shape **upside down**.
10. **Horses grazed up Death Mountain** — a predicate replaced by a cheaper one has to answer the
    same *question*, not merely return true where you happened to look.

---

## 5. Open

- **The rename to THE SEALED HEIGHT** — decided before the land became explicitly OoT; worth
  re-confirming.
- **The modern city's furniture crosses Hyrule Field** — monorail gantry, billboards, CURFEW/brand
  signage and the aircraft tag-plates paint over the field and the mountain. Nick's locked answer was
  *"strip the branding, keep the buildings"* (`curNoBrands`, the village's call) and it was never
  applied: `curNoBrands` is currently set only for the village / air / fire lands.
- **Zora's River** (0.965 on his layout) is not built, so the water folk live at the lake.
- **GANON — the slow takeover.** Fully specified and not started: effects → a lone rider crossing the
  field at night → a huge dark presence over the castle, peaking exactly as the city below peaks, with
  the modern city reacting using machinery that already exists (curfew, blackouts, emergency ticker).
  `deathUnrest(now)` is the existing hook the folk and the traffic already read.
- From the earlier brief and still unbuilt: **an old cabin and a campfire**, **waterfalls ringing the
  height**, **one snowy end**, **ruined walls and a field town** between the cliff foot and the city.
- One **rooftop solar array at woff 0** still lands across a taller neighbour's facade. It is *on* a
  building rather than in the sky; fixing it means drawing roof furniture during the building pass.
