# THE ENDINGS REVIEW — one at a time

How this works: `finale` in config.local.json pins ONE ending, `demoApocSec` replays its whole arc
on a loop so it can actually be watched. Nick judges it on the three monitors, we fix it, tick it,
then pin the next. Order below is his own `_order` string.

```
./install.sh   # after changing "finale" in org.citylive.wallpaper/contents/config.local.json
```

⬜ not yet reviewed · 🔧 fixed this pass · ✅ he has signed it off

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
| 8 | `thescream` | The Scream | strike @0.14 | — | ⬜ | |
| 9 | `crimsontide` | The Crimson Tide | sweep @0.34 | — | ⬜ | |
| 10 | `warmachine` | The War Machine | sweep @0.28 | — | ⬜ | |
| 11 | `thefamine` | The Famine | strike @0.45 | — | ⬜ | |
| 12 | `thehollow` | The Hollow | sweep @0.3 | — | ⬜ | |

## THE TWENTY-FIVE (older cataclysms)

| # | key | name | destroys? | egg needed | status | notes |
|---|---|---|---|---|---|---|
| 1 | `meteors` | Meteor Storm | no | — | ⬜ | |
| 2 | `nuke` | Nuclear Strike | no | — | ⬜ | |
| 3 | `sunburst` | Solar Flare | no | — | ⬜ | |
| 4 | `ai` | AI Uprising | no | — | ⬜ | |
| 5 | `bh` | Black Hole | no | — | ⬜ | |
| 6 | `alienwar` | Alien War | no | — | ⬜ | |
| 7 | `frost` | Deep Freeze | no | — | ⬜ | |
| 8 | `kaiju` | Kaiju Attack | no | — | ⬜ | |
| 9 | `flood` | The Flood | no | — | ⬜ | |
| 10 | `kaijuwar` | Kaiju War | no | — | ⬜ | |
| 11 | `pollution` | The Great Smog | no | — | ⬜ | |
| 12 | `moonfall` | Moonfall | strike @0.86 | — | ⬜ | |
| 13 | `gammaray` | Gamma-Ray Burst | strike @0.1 | — | 🔧 | Reworked 2026-08-10: pivoting beam that sweeps and glasses the ground; bleach+shade replacing the flat wash; aircraft shot down, traffic fried, ionisation arcs, hard pulse flashes; people burned into the road (KSP-scaled at last). |
| 14 | `rogueplanet` | The Rogue Planet | strike @0.3 | — | ⬜ | |
| 15 | `crustcrack` | The Crust Cracks | strike @0.2 | — | 🔧 | Reworked 2026-08-10: chasm moved from the horizon to the street band, propagating front with a fracture running ahead, buildings tip in, people flee then fall, water pours in and returns as steam, consumes the world, healed+bridged scar in later lives. ⚠ the scar still reads weakly — needs another pass. |
| 16 | `oceansboil` | The Oceans Boil | strike @0.45 | — | ⬜ | |
| 17 | `greygoo` | Grey Goo | strike @0.25 | — | ⬜ | |
| 18 | `lastwinter` | The Last Winter | strike @0.4 | — | ⬜ | |
| 19 | `skyfall` | The Sky Falls | strike @0.25 | — | ⬜ | |
| 20 | `timestop` | Everything Stops | strike @0.18 | — | ⬜ | |
| 21 | `thecomet` | The Comet | strike @0.55 | — | ⬜ | |
| 22 | `thechange` | The Change | strike @0.35 | — | ⬜ | |
| 23 | `theburst` | The Burst | strike @0.55 | — | ⬜ | |
| 24 | `thetitans` | The Titans | sweep @0.4 | — | ⬜ | |
| 25 | `ragnarok` | Ragnarok | sweep @0.35 | — | ⬜ | |

## LAND-LOCKED (need their own egg pinned)

| # | key | name | destroys? | egg needed | status | notes |
|---|---|---|---|---|---|---|
| 1 | `massacre` | The Massacre | no | falador | ⬜ | |
| 2 | `logout` | The Server Shutdown | no | varrock | ⬜ | |
| 3 | `wilderness` | The Wilderness | no | ardougne | ⬜ | |
| 4 | `godwars` | The God Wars | no | lumbridge | ⬜ | |
| 5 | `banwave` | The Ban Wave | no | falador | ⬜ | |
| 6 | `ninetails` | The Nine-Tailed Fox | no | leaf | ⬜ | |

## Fixed globally on 2026-08-10, affects every row
- **The backdrop city now collapses** (`f0e666f`) — on city-backdrop lands the tower bands are LAND,
  so no ending had ever damaged them. Now derived from `apocHit(worldX)`.
- **All 43 endings have display names** (`18ace3e`) — 12 had none and printed raw keys.
- **The top bar names the ending** during the demo loop (`18ace3e`).
