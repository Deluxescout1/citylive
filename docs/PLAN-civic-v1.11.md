# CityLive v1.11.0 — "CIVIC PROJECTS" (votable landmarks)  + v1.12 almanac (Phase B)

**Roadmap:** #6 New landmarks (elections-voted) · #9 City almanac (**Phase B, separate ship**).
**Locked with Nick (2026-07-18, AskUserQuestion):**
1. **Separate civic-projects pool** — landmarks vote in their OWN independent ballot pool (own salt), so existing measures (stadium/casino/park/policies) keep their current rate, landmarks reliably appear, and there's **no `hh%len` shift to past lives**. (Advisor: adding 5 into the 8-item MEASURES pool would make everything rarer and each landmark visible in only ~half of lives.)
2. **Landmarks now, almanac next.** Phase A = votable landmarks (pure engine, clean both-platform → v1.11.0). Phase B = the almanac as its own ship with BOTH surfaces (Electron Control Center + a QML page in the KDE plugin, so it reaches Nick on his wallpaper), verified headless.

Branch: `landmarks-almanac` off `main` @ v1.10.0.

---

## Anchors (read + confirmed)
- **MEASURES pipeline** (city.js): `MEASURE_SALT=0x51ED2701` (~8214), `MEASURES[]` + `MEASURE_LABEL` (8219), `termMeasures(li,term)` draws `n=1+(mh&1)` props/term (8224), `passedBuilds(now)` = life-scoped standing builds w/ lifecycle `cons`(0.06-0.30)→`open`(0.30-0.37 ribbon)→`done` (8238), `cityHasBuild(t)` (8254), `curBuilds` set each frame.
- **Draw dispatch** `drawBuilds(g,L,now,night)` (8453): monorail→drawMonorail, seawall→drawSeawall, zone-builds (`isZoneBuild` 8452: stadium/park/casino) placed at cx → drawArena/drawCasino/drawCityPark, `drawBuildSite` for cons phase. Voted-zone ground-clear at ~3598.
- **Functional-effect pattern:** `cityHasBuild("casino")` drives crime up + tourism (4672, 5079); `cityHasBuild("park")` approval (5081, 8211). Landmarks add the same way.
- **NAME-COLLISION history:** `drawStadium`(civic-landmark ~5695) vs `drawArena`(voted build); `drawPark`(near-row greenspace ~3277) vs `drawCityPark`(voted). **GREP before naming any new draw fn.**
- **Landlocked swap** precedent: `termMeasures` swaps seawall→stadium when `!hasOcean` (8231) — marina needs the same guard.
- **Almanac data path (Phase B):** reuse `desktop/test/ticker-life.js`'s `loadEngine()` (vm + stub canvas + clock-stepping) to recompute history headless — NO new engine→app channel.

---

## Landmarks (5) — each: ballot label · placement · draw · functional effect
| Landmark | Placement | Functional effect |
|---|---|---|
| **University** | normal zone (reserve an x) | approval↑ + hastens space age (there's an `EDUB` schooling hook); "GRADUATION DAY" event |
| **Marina / yachts** | needs `hasOcean` (swap out if landlocked) | tourism↑; moored yachts, boats come & go |
| **Zoo** | normal zone | tourism↑; family crowds, animal enclosures |
| **Observatory** | elevation/edge (near mountains if any, else city edge) | ties to the night sky (a dome + telescope slit; stargazers) |
| **Grand Central** | transit hub near downtown | transit↑; crowds stream in/out, trains/trams call |

---

## Phases

### LA0 — Civic-projects pool  *(the spine)*
- `CIVIC_SALT` (own constant, ≠ MEASURE_SALT/CORP/CITIZEN). `civicProjects(li,term)` mirrors `termMeasures` but over a `CIVIC[]` landmark list; 1-2 per term; ~65% pass; landlocked-swap for marina.
- `passedCivics(now)` mirrors `passedBuilds` (cons→open→done lifecycle, life-scoped term scan). Merge into `curBuilds` (or a parallel `curCivics`) so `cityHasBuild`/effects/`drawBuilds` see them.
- Extend the **node-vm ticker/coherence harness**: civic projects appear across lives, lifecycle monotone (never regress cons→pre-vote), marina only when `hasOcean`, no name/ticker junk.

### LA1 — Landmark draws + placement + dispatch
- 5 draw fns (grep names first), placement anchors (LM_* fractions; marina on the shore, observatory at an edge/hill, grand central near downtown). Add to `drawBuilds` dispatch + `isZoneBuild`/special-placement as needed. `drawBuildSite` covers the cons phase for each.
- Each new draw fn → a **qml-sweep** job (active + cons phase).

### LA2 — Functional effects + ticker
- Effects via `cityHasBuild(...)`: university→approval/space-age, zoo+marina→tourism, grand central→transit life. Ballot/opening ticker headlines ("ON THE BALLOT — NEW UNIVERSITY", "UNIVERSITY OPENS — FIRST CLASS ENROLLS", "GRADUATION DAY").

### LA3 — Ship gate v1.11.0
Harness clean · qml-sweep clean · perf · KDE live + WinTest VM · merge→main · bump 1.11.0 · tag. **Commit hygiene: add specific paths, never `git add -A`** (v1.10 ship lesson — it swept scratch renders/ci-win into git).

### Phase B (separate, v1.12.0) — CITY ALMANAC
Recompute pop / mayor history / disasters survived / corps risen-fallen headless via `loadEngine()`. Surfaces: Electron CC page (`desktop/renderer/settings.html`) + a QML almanac page in the KDE plugin. Verify = headless recompute + coherence asserts (pop≥0, mayor terms contiguous, disaster count monotone), not a screenshot. Its own both-platform gate + tag.
