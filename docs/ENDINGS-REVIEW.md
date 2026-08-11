# THE ENDINGS REVIEW — one at a time

How this works: `finale` in config.local.json pins ONE ending, `demoApocSec` replays its whole arc
on a loop so it can actually be watched. Nick judges it on the three monitors, we fix it, tick it,
then pin the next. Order below is his own `_order` string.

```
./install.sh   # after changing "finale" in org.citylive.wallpaper/contents/config.local.json
```

⬜ not yet reviewed · 🔧 fixed this pass · ✅ he has signed it off

> 🚨 **THIS LEDGER HAS GONE STALE TWICE.** Ticks fail silently, so the counts here are not evidence on
> their own. **AUDIT METHOD (2026-08-11):** count `🔒` LOCKED CALLS inside each renderer's own span —
> a locked call is only ever written down after Nick has judged that ending, so it is the one signal
> that survives a missed tick. `git log -G <key>` does NOT work: `ai` matches "rain" and "detail",
> `nuke` matches the shared `nukeDist`/`nukeGZX` helpers, and both come back with 30–100 false hits.
>
> **RESULT: 43 endings · 17 have had at least one judged pass · 26 never have.** Nine rows below were
> marked ⬜ while carrying locked calls, and are corrected. `thechange` is ticked 🔧 but has NO locked
> call and only 67 lines — it got a colour fix, not a judged pass, and belongs with the 26.

## THE BLOOD TWELVE (v4.0.0 — newest, least reviewed)

| # | key | name | destroys? | egg needed | status | notes |
|---|---|---|---|---|---|---|
| 1 | `risen` | The Risen | strike @0.22 | — | ⬜ | |
| 2 | `plague` | The Plague | strike @0.3 | — | ⬜ | |
| 3 | `swarm` | The Swarm | sweep @0.2 | — | ⬜ | |
| 4 | `bloodmoon` | The Blood Moon | strike @0.4 | — | ⬜ | |
| 5 | `acidrain` | Acid Rain | sweep @0.24 | — | ⬜ | |
| 6 | `thepit` | The Pit | sweep @0.26 | — | ⬜ | |
| 7 | `glassrain` | Glass Rain | sweep @0.2 | — | ⬜ | |
| 8 | `thescream` | The Scream | strike @0.14 | — | 🔧 | Ledger audit 2026-08-11: this row said UNREVIEWED and its renderer carries 1 locked call (🔒), so it has been through at least one judged pass. Tick was never applied. |
| 9 | `crimsontide` | The Crimson Tide | sweep @0.34 | — | ⬜ | |
| 10 | `warmachine` | The War Machine | sweep @0.28 | — | 🔧 | Partly fixed 2026-08-10: the comment claimed "two of five hold near the epicentre" and the hash gave exactly ONE, seeded on the index so it was the same one forever — which is why the epicentre monitor emptied in the back half. Now exactly two, rotating per life. Hull rebuilt: legs were hgt*0.035 (4px on a 120px machine) under a hull only 19% of height — two thirds spindly strut by area. Hull to 26% and deeper, legs more than doubled, knee blocks and hip pivots, lit top plate / dark belly / shoulder pauldrons, and a small sensor head so the rest reads big. |
| 11 | `thefamine` | The Famine | strike @0.45 | — | 🔧 | Ledger audit 2026-08-11: this row said UNREVIEWED and its renderer carries 1 locked call (🔒), so it has been through at least one judged pass. Tick was never applied. |
| 12 | `thehollow` | The Hollow | sweep @0.3 | — | 🔧 | Ledger audit 2026-08-11: this row said UNREVIEWED and its renderer carries 1 locked call (🔒), so it has been through at least one judged pass. Tick was never applied. |

## THE TWENTY-FIVE (older cataclysms)

| # | key | name | destroys? | egg needed | status | notes |
|---|---|---|---|---|---|---|
| 1 | `meteors` | Meteor Storm | no | — | ⬜ | |
| 2 | `nuke` | Nuclear Strike | no | — | ⬜ | |
| 3 | `sunburst` | Solar Flare | no | — | ⬜ | |
| 4 | `ai` | AI Uprising | no | — | ⬜ | |
| 5 | `bh` | Black Hole | no | — | 🔧 | Rebuilt 2026-08-11 (his brief: Interstellar's Gargantua, spaghettify everything, every pixel affected). 🚨 It was a FOURTEEN-SECOND ending inside a 201-minute arc — `BH_FORM_MS` 3200 + `BH_WIPE_MS` 11000 are ms on `apocMs`, so the city was gone by ap 0.0012 and rendered at 30s / ap 0.20 / ap 0.60 the frame is pixel-identical: three hours twenty of one static dark rectangle with a 40px ring in the corner. Now on the arc (`BH_FORM_AP` 0.18 / `BH_FULL_AP` 0.88), and `bhFrontR` reads the same expression `apocHit` collapses buildings with. Gargantua is colossal and hangs over ground zero: solid annulus halo arcing over the top and back under the bottom, edge-on arms, photon ring, and a real Doppler gradient (blue-white approaching / amber receding). Stars world-anchored (were `%SW`). Sky goes to black, ground only desaturates. ⚠ REMAINING: no spaghettification yet — see the note in the renderer. `putImageData` is a SILENT NO-OP in QML Canvas, so the strip-warp lens I measured at 4 ms never wrote anything; `drawImage(<Canvas>,…)` does work and scales, but needs a second canvas in `main.qml`. |
| 6 | `alienwar` | Alien War | no | — | ⬜ | |
| 7 | `frost` | Deep Freeze | no | — | ⬜ | |
| 8 | `kaiju` | Kaiju Attack | no | — | ⬜ | |
| 9 | `flood` | The Flood | no | — | ⬜ | |
| 10 | `kaijuwar` | Kaiju War | no | — | ⬜ | |
| 11 | `pollution` | The Great Smog | no | — | ⬜ | |
| 12 | `moonfall` | Moonfall | strike @0.86 | — | ⬜ | |
| 13 | `gammaray` | Gamma-Ray Burst | strike @0.1 | — | 🔧 | Reworked 2026-08-10: pivoting beam that sweeps and glasses the ground; bleach+shade replacing the flat wash; aircraft shot down, traffic fried, ionisation arcs, hard pulse flashes; people burned into the road (KSP-scaled at last). |
| 14 | `rogueplanet` | The Rogue Planet | strike @0.3 | — | 🔧 | Rebuilt 2026-08-10 on real physics: no impact is possible (Roche limit). Staged timeline — auroras+superstorms, tides as walls, crustal quakes+volcanism, air leaking to space with daytime stars, rings we pass into, graze-burn, then the crust peels away. Banded surface no longer painted over; planet size capped. |
| 15 | `crustcrack` | The Crust Cracks | strike @0.2 | — | 🔧 | Reworked 2026-08-10: chasm moved from the horizon to the street band, propagating front with a fracture running ahead, buildings tip in, people flee then fall, water pours in and returns as steam, consumes the world, healed+bridged scar in later lives. ⚠ the scar still reads weakly — needs another pass. |
| 16 | `oceansboil` | The Oceans Boil | strike @0.45 | — | 🔧 | Reworked 2026-08-10: was a solid full-width white wall at 0.86 alpha climbing the frame, so everything went uniformly white and the city could never be seen disappearing into it. Now billowing steam columns with GAPS you glimpse the city through, violent geysers off the waterline, superheated water, and the final opacity held back to the very end. |
| 17 | `greygoo` | Grey Goo | strike @0.25 | — | 🔧 | Reworked 2026-08-10: was filling from y=0 and eating the SKY, so four fifths of the frame was blank. Now a chrome mass standing where the city stood, seething surface + specular glints, tendrils climbing what still stands; three human fates across the arc (taken screaming -> dissolved in place -> converted and walking with it); buildings both hollowed-then-falling and absorbed standing; spray 0.30 -> 0.88. **Second pass 2026-08-11 (his brief: one grain that keeps multiplying):** the ending had NO first act — nothing drew before ap 0.06 and the mass contradicted the ending's own `APOC_STRIKE_AP` of 0.25. The first quarter is now the COLONY: a lab at ground zero with one lit strip, a 2px speck with a contracting amber cordon ring + tick so it can be found, `N = 2^gen` doubling scripted from each grain's index, clumps that merge, the lab eaten first, the cordon fence and the people behind it going grey. The heap's silhouette IS the per-column grain count. Front now reads the SAME expression `apocHit` collapses buildings with (was `(ap-0.06)/0.86` against `(ap-0.25)/0.53` — two laws for one boundary). Surface no longer a sine curve: world-hashed CLUMPS written into the profile, a broken faceted crust with shade under it and shadow at the foot. Height now CLIMBS to the last frame (ap 0.70 and 0.92 used to be the same picture) and is gated low-and-wide while young (it erupted as a spire). 🚨 fixed: the front's bright edge was ungated and drew wobbling white ribbons down through EMPTY SKY for the first quarter of the arc. Skyline stays above the mass to the end — his call. Cost +0.2 ms/live frame, measured interleaved. **Third pass, same day:** the mass stopped at `HORIZON+GROUND*0.6` — mid-road — leaving the NEAR PROMENADE a clean strip along the bottom of every frame with pedestrians strolling under a world that had ended; it fills to `SH` now (the house rule THE HOLLOW records: `HORIZON+GROUND` is wrong on a water land). Plus DRAG TRAILS: world-hashed smears across all three ground bands, every one pointing at ground zero because the direction is the sign of the wrap-offset, confined to a band travelling with the front (drawn everywhere it had been, they were a red scribble buried inside the mass), four tapered segments each rather than 87 single pixels, gated on `goreK()`. +0.19 ms. **Fourth pass — he judged the A/B and said it still looked the same, and measured he was right:** old and new at ap 0.60 were near-identical, and ap 0.5–1.0 is half the ending's runtime. Fault was VALUE, not shape — `[146,152,164]` is the same value as the pale city and the pale sky. Mass is now gunmetal `[52,57,70]` with all the light in the crust and glints. Plus the two things the second half lacked: the BURIED CITY is readable inside it (real `near.blds` ghosts keeping their own top, base and floor lines, dissolving at per-building rates) and an EVENT (a replication wave travelling outward from ground zero brightening the crust as it passes; real towers taken one at a time at the front, leaning and losing detail; the converted walking the ridge outward). 🚨 fixed two screen-space bugs inside this ending's own life layer: 14 invented buildings and 40 people both at `((h>>>5)%SW)`. Cost +0.44 ms after two optimisations (opaque ghost fills; the pulse colour strings quantised to 8 and cached — the crust loop runs a few hundred times a frame and was building ~1400 rgba strings per frame, which was most of the +1.03 ms it started at). |
| 18 | `lastwinter` | The Last Winter | strike @0.4 | — | ⬜ | |
| 19 | `skyfall` | The Sky Falls | strike @0.25 | — | 🔧 | Reworked 2026-08-10: detach time was LINEAR in the sheet index so leading edges formed a perfect staircase. Hashed stagger + accelerating fall + per-row shear so plates tumble; the void behind is now a STARFIELD; cracks run along a sheet before it goes; late EXPOSURE phase (air venting, frost, lights out) because everything was down by ap 0.6 and nothing developed after. |
| 20 | `timestop` | Everything Stops | strike @0.18 | — | 🔧 | Reworked 2026-08-10: its own comment conceded it CANNOT freeze the movers, so EVERYTHING STOPS was a desaturation + vignette over a city still walking. It cannot stop what the engine moves, but it can ADD things already stopped — people caught mid-stride, cars dead in the road, debris that never came down — and stillness only reads AGAINST motion, so the traffic behind them is the contrast, not the obstacle. Nothing here depends on `now` for position. |
| 21 | `thecomet` | The Comet | strike @0.55 | — | ⬜ | |
| 22 | `thechange` | The Change | strike @0.35 | — | 🔧 | Reworked 2026-08-10: the wrong-anatomy creatures were drawn in pale flesh two shades off the buildings behind them, so the wrongness never registered. Darker, redder, hard dark outline down the torso — the silhouette has to win before the proportions can be read. |
| 23 | `theburst` | The Burst | strike @0.55 | — | 🔧 | Ledger audit 2026-08-11: this row said UNREVIEWED and its renderer carries 15 locked calls (🔒), so it has been through at least one judged pass. Tick was never applied. |
| 24 | `thetitans` | The Titans | sweep @0.4 | — | 🔧 | Ledger audit 2026-08-11: this row said UNREVIEWED and its renderer carries 14 locked calls (🔒), so it has been through at least one judged pass. Tick was never applied. |
| 25 | `ragnarok` | Ragnarok | sweep @0.35 | — | 🔧 | Ledger audit 2026-08-11: this row said UNREVIEWED and its renderer carries 2 locked calls (🔒), so it has been through at least one judged pass. Tick was never applied. |

## LAND-LOCKED (need their own egg pinned)

| # | key | name | destroys? | egg needed | status | notes |
|---|---|---|---|---|---|---|
| 1 | `massacre` | The Massacre | no | falador | 🔧 | Ledger audit 2026-08-11: this row said UNREVIEWED and its renderer carries 1 locked call (🔒), so it has been through at least one judged pass. Tick was never applied. |
| 2 | `logout` | The Server Shutdown | no | varrock | ⬜ | |
| 3 | `wilderness` | The Wilderness | no | ardougne | ⬜ | |
| 4 | `godwars` | The God Wars | no | lumbridge | ⬜ | |
| 5 | `banwave` | The Ban Wave | no | falador | 🔧 | Ledger audit 2026-08-11: this row said UNREVIEWED and its renderer carries 1 locked call (🔒), so it has been through at least one judged pass. Tick was never applied. |
| 6 | `ninetails` | The Nine-Tailed Fox | no | leaf | 🔧 | Ledger audit 2026-08-11: this row said UNREVIEWED and its renderer carries 3 locked calls (🔒), so it has been through at least one judged pass. Tick was never applied. |

## Fixed globally on 2026-08-10, affects every row
- **The backdrop city now collapses** (`f0e666f`) — on city-backdrop lands the tower bands are LAND,
  so no ending had ever damaged them. Now derived from `apocHit(worldX)`.
- **All 43 endings have display names** (`18ace3e`) — 12 had none and printed raw keys.
- **The top bar names the ending** during the demo loop (`18ace3e`).
