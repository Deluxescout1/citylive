You are SOL, senior engine reviewer. INSPECT the Stage-3 on-wallpaper draw code for "CityLive — THE
PEOPLE" and give a terse PRIORITIZED punch-list (P0/P1 bugs first, then concrete suggestions). Do NOT
edit files. Prior reviews (design, verify) are all addressed; 57/57 tests pass; 4 shells byte-identical.

The citizen SIM is deterministic/pure-clock (idx,gen identity, real children, death ledger, read-only
projections). Stage 2 (Citizens menu) done. Stage 3 now DRAWS named citizens on the wallpaper. Engine is
one ~15k-line city.js (mirrored to desktop/web/phone; QML V4 = var only, no arrow/const/Array.fill).

READ + INSPECT (all in org.citylive.wallpaper/contents/js/city.js):
- Search "THE PEOPLE — WORLD BINDING + EMBODIMENT". Functions: buildingBuilt / buildingStanding (uses
  nukeStruck/nukeHit/curRuins+inZone), bldUse, peopleWorldKey, peopleBuildRegistry (cached on
  near._peopleReg, keyed), workPool, rvw (rendezvous weight), peoplePick, peopleHomeWork, frontX, lerpWX,
  drawNamedCitizens(g,now), SPEECH_LINES, bubbleLine, drawSpeechBubble, drawSpeechBubbles(g,now,night).
- The frame calls (search "drawNamedCitizens(g, now);"): drawNamedCitizens then drawSpeechBubbles are
  invoked after the anonymous ped loop; the anonymous keep-cull is ×0.4 when embodiment is active.
- drawnNamed[] entries: {idx,gen,pid,k,sx,y,order}.
- Coordinate/help: disX(wx) (~9147, screen-x with wrap), HORIZON, WW, wrapW, drawPerson(g,x,y,cloth,skin,
  bob,kind) (~2865), drawUiText(g,str,x,y,col,sc)+textW (~3198), PEDC/SKINC palettes, cityG, cityPhase,
  curDis, curOutbreak, nowDate() (NOWOVR-aware), QUAL, PEOPLE_N.

VERIFY specifically:
1. DETERMINISM/FREEZE: is everything a pure fn of the effective clock (nowDate/now, all NOWOVR-aware)?
   Any Date.now / Math.random / real-time drift in embodiment, commute lerp, bob, or speech selection
   that would desync bezels or break freeze-render? The commute position must be identical on two
   screens showing the same world-x at the same NOWOVR.
2. BEZEL SYNC: frontX/lerpWX/peoplePick use world-x + seed only? Any per-screen (WOFF/SW) leak into
   WHICH building or WHICH line, vs only into culling/projection?
3. PERF at 8-12fps KDE: per-frame cost of peopleHomeWork (registry cached? rendezvous scan O(pool)?),
   the drawnNamed sort, speech O(n) adjacency. Any per-frame alloc/closure to hoist? Budget ~1ms.
4. CORRECTNESS gaps: night/shelter gates; citizens standing INSIDE ruined/destroyed buildings during a
   non-apoc disaster (curDis) since buildingStanding's nuke check is apoc-only; road-validity (peds use
   onPavedRoad — do named citizens ever stand on unpaved/sea tiles?); self-employed placement; the ≤2
   speech cap + overlap check; bubble clipping at screen edges.
5. Anything that could throw (undefined global at call site, empty pools, N changes).

Deliver: VERDICT (ready to finalize Stage 3 / not); P0/P1 with file:line; top suggestions; and the single
most important fix. Prioritize what actually matters for a live 8-12fps multi-monitor wallpaper.
