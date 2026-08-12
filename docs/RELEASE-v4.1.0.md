# v4.1.0 — THE END TIMES GET THEIR MIDDLES

**Status: PREPARED, NOT CUT.** Leg 1 is green. Leg 2 has not run. No version bump, no tag — see
"What is left" at the bottom. `docs/RELEASING.md` is the procedure; this file is the payload.

69 commits since `v4.0.0`. The theme: v4.0.0 shipped 43 endings, and then he watched them.

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

## What is left before this can be cut

1. **Leg 2 (Windows).** `WinTest` is defined but shut off, and the leg needs the **CI-built**
   installer, not a local build.
2. **Credentials.** `git push` has no stored credentials and `gh` is not logged in, so nothing can be
   pushed, no workflow can be triggered or watched, and no release can be confirmed published.
3. Then, and only then: merge to `main`, bump `desktop/package.json` to 4.1.0, tag `v4.1.0`, push the
   tag **by name**, and confirm both the run fired and the release published.

## Known-open, deliberately shipped as-is

- Flood: drowned bodies read blocky at KSP 2; waves 2-4 over an already-flooded city unjudged.
- Kaiju War: the titans trade rather than grapple; the loser-falls-across-the-city aftermath is unbuilt.
- Moonfall: the impact flash is a smooth ellipse against a hard-pixel city.
