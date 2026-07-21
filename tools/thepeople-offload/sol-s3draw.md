VERDICT: **Not ready to finalize Stage 3.** No P0/crash found, but three P1 correctness/invariant failures remain.

### P1

1. **Freeze/NOWOVR violation — schedule and commute position use real wall time.**  
   [city.js:8034](/home/deluxescout/CityLive/org.citylive.wallpaper/contents/js/city.js:8034) calls `nowDate()`, which ignores `NOWOVR` at [city.js:179](/home/deluxescout/CityLive/org.citylive.wallpaper/contents/js/city.js:179). Thus pinned renders can show citizens at real-time home/work/commute positions while bob and speech use overridden `now`. Two bezels can also disagree around minute/shift boundaries.

2. **Citizens occupy actively destroyed buildings.**  
   `buildingStanding()` excludes nuked and permanent-ruin buildings only ([city.js:7959](/home/deluxescout/CityLive/org.citylive.wallpaper/contents/js/city.js:7959)). Active destructive disaster zones are omitted, although rendering replaces those buildings with destruction at [city.js:4857](/home/deluxescout/CityLive/org.citylive.wallpaper/contents/js/city.js:4857). Worse, `shelter` forces everyone to those nominal homes ([city.js:8035](/home/deluxescout/CityLive/org.citylive.wallpaper/contents/js/city.js:8035), [city.js:8046](/home/deluxescout/CityLive/org.citylive.wallpaper/contents/js/city.js:8046)).

3. **Named citizens ignore road/sea validity.**  
   Home fronts, commute interpolation, and self-employed offsets never call `onPavedRoad()` or reject sea ([city.js:8042](/home/deluxescout/CityLive/org.citylive.wallpaper/contents/js/city.js:8042)–[8057](/home/deluxescout/CityLive/org.citylive.wallpaper/contents/js/city.js:8057)). Named embodiment begins at `cityG=0.22`, when paving is only starting. Commutes can cross unpaved regions or water; self-employed citizens can wander ±20 world pixels into either. Anonymous peds explicitly enforce this at [city.js:15123](/home/deluxescout/CityLive/org.citylive.wallpaper/contents/js/city.js:15123).

### Top suggestions

- **Perf:** Registry construction is cached, but assignments are not. Every frame can scan the entire home pool plus a work pool for every living citizen ([city.js:8004](/home/deluxescout/CityLive/org.citylive.wallpaper/contents/js/city.js:8004)–[8040](/home/deluxescout/CityLive/org.citylive.wallpaper/contents/js/city.js:8040)); each candidate may additionally scan all ruin zones. Cache base rendezvous rankings/bindings and only revalidate when standing-state identity changes. This is the main risk to the ~1 ms budget.
- `drawnNamed.slice().sort(function…)` plus `taken=[]`/pair arrays allocates every frame ([city.js:8099](/home/deluxescout/CityLive/org.citylive.wallpaper/contents/js/city.js:8099)). Small today, but reusable scratch arrays or insertion during drawing would remove churn.
- Bubble overlap is horizontal-only; both bubbles share essentially the same vertical lane. The ≤2 cap works, but clipping logic fails if text width exceeds `SW`, and the tail remains at unclamped `cx` ([city.js:8089](/home/deluxescout/CityLive/org.citylive.wallpaper/contents/js/city.js:8089)).
- Caller passes `night = 1-L`, not a boolean ([city.js:15250](/home/deluxescout/CityLive/org.citylive.wallpaper/contents/js/city.js:15250)); almost any nonzero twilight/daylight value selects the night bubble palette.
- Use `P_job(p)` rather than raw `JOB_TAX[p.job]` at [city.js:8040](/home/deluxescout/CityLive/org.citylive.wallpaper/contents/js/city.js:8040). Current simulation appears to keep indices valid, but the existing fallback prevents a future taxonomy/config change from aborting the frame.

Bezel logic itself is otherwise sound: building choice, frontage, commute world-x, bob, and line text contain no `WOFF`/`SW`; those enter only at projection/culling and bubble layout.

**Single most important fix:** derive `hh` from the passed effective `now`—for example, `new Date(now)`—then use that same effective clock consistently for schedule, commute, bob, and speech. This restores the advertised freeze and multi-monitor invariant.