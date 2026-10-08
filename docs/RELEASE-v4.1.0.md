# v4.1.0 — THE END TIMES GET THEIR MIDDLES

**Status: CUT — v4.1.0.** Both release legs are green (KDE on Nick's desktop; Windows on the CI-built
installer). Version bumped in `desktop/package.json` **and** `org.citylive.wallpaper/metadata.json`;
tag `v4.1.0`. `docs/RELEASING.md` is the procedure; this file is the payload.

75 commits since `v4.0.0`. The theme: v4.0.0 shipped 43 endings, and then he watched them.

---

## The fault that ran through all of it

Endings that decorated the frame instead of happening to the city. Concretely, three shapes of the
same bug, found in four different endings:

1. **A clock answering a question about a place.** The flood deleted every person in the world the
   instant a *global* water level crossed a threshold — including everyone on the dry side of a wave
   that would not reach them for another two minutes. Moonfall's only damage rule was one arc
   threshold with no x in it, so the whole world fell in a single frame. The kaiju used the *nuke's*
   symmetric radius, so blocks fell on both sides of the animal and none fell because it touched them.
2. **Renderers that were replaced but never deleted.** The kaiju shipped with three creatures drawn on
   top of each other. He reported it as *"2 of them behind each other"*, which is exactly what it was.
3. **Real-seconds constants inside a 201-minute arc.** `flood` was never added to `apocSpanMs()`, so
   the city was submerged 1.3 thousandths of the way in and the remaining three hours nineteen was one
   static frame — 370 pixels of 1.49 million differ between ap 0.05 and ap 0.90.

## What shipped

- **KAIJU** — it walks. One predicate (`kaijuCrushed`) decides what is wrecked and every consumer
  reads it; ahead of it the city is whole, behind it there is nothing. Walking also puts it on all
  three monitors without cloning it, which was the locked constraint. ✅ signed off.
- **MOONFALL** — breaks up on the way in; fragments rain ahead of the core; the moon is drawn BEHIND
  the skyline (`APOC_X_BACK`) so the towers give it scale; the impact sends a travelling blast front
  out of ground zero under a burning sky and leaves the moon buried in the city as faceted rock.
- **THE FLOOD** — re-timed onto the arc, and rebuilt as Miller's planet: a wall of water taller than
  the skyline entering from the world seam and crossing all three screens, four times. People swim,
  tire, and drift at depth.
- **KAIJU WAR** — the fight travels and wrecks what it is fought over (it used to SPARE the
  battleground). Titans at twice the tallest tower. A real fight rhythm: anticipation, a one-frame
  snap, recoil — and being hit moves you.
- **LIMBS** — both creatures got two-segment limb chains with joints, and a gait phase derived from
  WORLD x so a planted foot is stationary on the ground and all three monitors agree.
- **THE GOLDEN WOOD** — the forest variant whose canopy, trunks, ground, haze and sky were all one
  hue. Gold canopy against a blue sky now.
- **`nowDate`** — took no argument while five callers passed it one. Found by the release gate.

## And the 2026-08-13 audit

The whole-project sweep that turned this engine's recurring fault classes into predicates. Two of its
findings are timing faults of the same shape as the flood's, and one is a calendar fault nobody was
looking for:

- **Six endings finished inside the first 1% of the apocalypse.** `massacre · logout · wilderness ·
  godwars · banwave · ninetails` are authored in real seconds and were never added to `apocSpanMs()`,
  so each completed in its opening seconds — the fox's in 14.2 — and left **3 h 20 m of one frozen
  frame**. They were missed by three audits because they are not in `DEATHS` (five are the OSRS
  land-triggered pool, the sixth the fox). Re-timed from each ending's own constants, gated by a test
  that derives the offenders from the pools rather than naming them.
- **The omen that never built.** `apocApproachF()` reached full intensity in eight *real* seconds and
  then held for twenty minutes on the 26 arc-native endings — a warning you cannot see coming is a
  state, not an omen. The window is now each ending's own approach constant expressed against its own
  strike point, so the authored contrast between a long cosmic dread and a short close-range one
  survives.
- **The life boundary drifted when the clocks moved.** The rollover grid was anchored to a fixed
  absolute epoch, so after the DST fall-back a life chosen to roll at `00:00` rolled at `23:00`. The
  grid is read in local wall-clock terms now, and only for those who actually chose an hour.
- Six dead functions deleted, two (`hyruleSolo`/`hyruleRotate`) deliberately kept and marked as an
  *unbuilt* single-monitor feature rather than mistaken for dead code.

## How it was cut

1. **Leg 1 (KDE)** — `./install.sh` on Nick's desktop: installed `city.js` byte-identical to the
   canonical engine, personal config baked in, journal clean.
2. **Leg 2 (Windows)** — the **CI-built** installer (not a local build) on a real Windows machine: the
   packaged `app.asar` verified byte-identical to the CI artifact, the engine inside it identical to
   the canonical one, then launched and rendering (processes alive in the console session, live CPU).
3. **Triggers are real now.** `gh` is authenticated and pushes are wired to a credential helper. CI
   run `37780461018` built this branch before the merge, and both legs were taken green off it.

⚠ **Both versions were bumped this time** — `package.json` *and* the KDE plugin's `metadata.json`.
That second file is the one `citylive-update` compares the downloaded tarball against, and its absence
from the procedure is why **every update since v2.0.0 was rejected and every install was manual**.
`docs/RELEASING.md` now names both files, with the scar written next to the step.

## Known-open, deliberately shipped as-is

- Flood: drowned bodies read blocky at KSP 2; waves 2-4 over an already-flooded city unjudged.
- Kaiju War: the titans trade rather than grapple; the loser-falls-across-the-city aftermath is unbuilt.
- Moonfall: the impact flash is a smooth ellipse against a hard-pixel city.
