# CityLive v1.10.0 — "LIVING WORLD" plan

**Roadmap items:** #5 Citizens with stories · #7 More street events · #8 More transit life.
**Almanac (#9) DEFERRED** (host-side Control Center capstone, separate both-platform parity).
**Locked with Nick (2026-07-18, AskUserQuestion):** Citizens = a **civic/professional cast, ticker-first**, *distinct* from the existing domestic FAMILY (`famInfo`); reuse `corpState` + existing storefronts for any world presence — **no new visible-character subsystem**. Almanac deferred.

Branch: `living-world` (off `main` @ v1.9.1). Pure-engine batch → `city.js` shared → lands Linux/KDE/Windows/web/phone at once. Ship under [[citylive-verify-both-platforms]].

---

## The anchors this builds on (all read + confirmed)

- **`corpState(now)`** (city.js ~5380) + **`corpNews(now)`** (~5412): the gold pattern — a pure-clock deterministic cast (`CORP_SALT=0x436F7270`), each firm with a rise/fall arc (founding cy, riseDur, cap, decline), surfaced as ticker headlines. **Uses `econOf`/`cityGrowth`, never the mutable `cur*` globals** → freeze-safe. Citizens copy this exactly.
- **`famInfo(now)`** (~1331): the DOMESTIC cast — surname, parents pA/pB, 1–2 kids w/ JOBS, grandchild, wedding cy 0.62, elder 0.88, family storefront, flee-wagon at world-end. Milestone headlines fired in `tickerMsg` via the `FMS` cy-threshold array (~5013-5026). **Citizens must NOT re-emit weddings/kids** — that's this system's job. Civic layer only.
- **`tickerMsg(now)`** (~4987): flat priority chain then `msgs[Math.floor(now/12000)%msgs.length]` rotation. Business news appended via `corpNews`. **Problem:** a flat rotation can't make a story *followable*. → add a **priority story-beat slot** (see P1).
- **`cityEvents(nd)`** (~2061): calendar flags market/parade/marathon/movie/balloonfest/protest/film. Street events extend this map + get draw fns + ticker lines.
- **Transit:** `subways[]` entrances (~2437), ferries (~2452), `drawBus` (~4315), `drawTrainLine` (~3886). No tram yet. `busstops[]`, `gameNight`/`teamName` exist.
- **Names/jobs:** `FNAMES` (~1329), `LNAMES` (~7942, 12 surnames), `JOBS` (~1330). Newspaper "extra" system ~5046.

---

## Guardrails (carry from prior batches + advisor)

1. **Determinism firewall:** `CITIZEN_SALT` = its own isolated hash stream (own constant, e.g. `0x4369747A` "Citz"). Never reuse CORP/election/disaster salts.
2. **Freeze-safe / pure clock:** `citizenState` reads `econOf(now)`/`cityGrowth(now)`/`lifeIndexOf(now)` — **never** `curEcon`/`curMayor`/`curCorps` mutable globals. (Exactly why `corpState` uses `econOf` not `curEcon`.)
3. **wmood-class QML trap:** no draw-local `var` read by a top-level draw fn — the plugin `onPaint` has no try/catch, an uncaught throw blanks the whole frame. Every new draw fn is self-contained.
4. **Every new draw fn gets a `qml-sweep.qml` job**; every new `cityEvents` flag gets exercised there (the tornado lesson — sweep hits the path so a throw is caught offline).
5. **No contradiction with `famInfo`:** civic cast covers founders/rivals/servants/councilors/stars — *not* domestic weddings/births.

---

## Verification strategy (different surface than last batch)

Story arcs are **text logic over time**, not draw paths — a screenshot proves one headline rendered, not that an arc *progresses coherently*. So:

- **P0 node-vm harness** (`desktop/test/ticker-life.js`): load `city.js` headless, pin a life, step the clock across the full life (cy 0→1 + apoc), dump `tickerMsg`/`citizenNews`/`citizenState` each step. Assert **arc coherence**: no "founder ACQUIRED and opens 100th store same week", founder phase tracks its corp, rivalry resolves once, servant milestone fires once, no famInfo/citizen collision. Run across several `lifeIndex` values.
- **qml-sweep** for all new draws (concert/foodfest/championship/icerink/tram/balloon/subway-crowd) at active + off phases.
- Perf: `draw()` stays within budget (≤~7-8ms/frame at the KDE 3-canvas scale).
- Both-platform gate: KDE live (install.sh, journal clean) + WinTest VM.

---

## Phases

### P0 — Scaffold + harness  *(task #6)*
- Add `CITIZEN_SALT`, stub `citizenState`/`citizenNews`.
- Write `desktop/test/ticker-life.js` node-vm harness (clock-stepper + ticker dump + coherence asserts). Prove it runs on the current engine first (baseline: family + corp beats only).
- kde-repro params for forcing new events (`?event=concert|foodfest|champ|icerink`) + a `probe=citizen` title dump.

### P1 — Civic cast (citizens)  *(task #7)*  — item #5
`citizenState(now)` — pure clock, `CITIZEN_SALT`. A small deterministic cast (~4–5), each an arc over `cy`:
- **The Founder** — bind to `corpState`: take the king/startup firm, name a founder (FNAMES+LNAMES), arc = the firm's phase (startup→IPO/growing→juggernaut/acquire→fade/bankrupt). Beats *derive from* corp phase so they can't contradict `corpNews`.
- **The Rivalry** — two named shopkeepers (bakers/chefs/brewers) feuding; escalates over cy; resolves once (a winner crowned, or they merge).
- **The Public Servant** — beloved bus driver / librarian / park ranger; arc = long-service → anniversary → honored/retires.
- **The Councilor** — a scandal-prone public figure; light tie to the election/scandal season (read-only), own arc so it's freeze-safe.
- **(maybe) The Rising Star** — street artist / athlete gaining fame over the life.

`citizenNews(now)` → followable beats. **Priority story-beat slot:** `citizenBeat(now)` returns ONE featured beat that holds for a stretch (changes on a slow clock, e.g. `~/ (3–4 in-world hours)`), inserted high in `tickerMsg` so it gets airtime instead of 1-in-N rotation. Big turning points also spawn a **newspaper extra** (reuse ~5046).

### P2 — Street events  *(task #8)*  — item #7
Extend `cityEvents(nd)` + draw + ticker:
- **Concert** at the amusement park (summer weekend nights): `drawConcert` — stage, crowd, light beams.
- **Food festival** (a weekend on market row): `drawFoodFest` — stalls, awnings, crowds, string lights.
- **Sports championship + celebration** (tie to `gameNight`/`teamName`; a win → parade/confetti day): `drawChampionship`.
- **Winter ice rink** (plaza, Dec–Feb): `drawIceRink` — rink, skaters, rink lights.
Each: a `cityEvents` flag, a ticker headline, a `qml-sweep` job.

### P3 — Transit life  *(task #9)*  — item #8
- **Trams** — a new surface line `drawTram` (distinct from the el-train), on a boulevard.
- **Cyclists** — more cyclists woven into street traffic.
- **Balloon rides** — passenger hot-air balloons rising on nice-weather days.
- **Subway rush crowds** — commuter clusters at `subways[]` entrances during rush hours (07–09, 17–19).
Each new draw fn: a `qml-sweep` job.

### P4 — Ship gate v1.10.0  *(task #10)*
node-vm arc-coherence clean · qml-sweep clean · perf ok · KDE live + WinTest VM · merge→main · bump 1.10.0 · tag v1.10.0 (release CI → auto-update).

---

## Open question answered in-plan
**Ticker airtime** (advisor): don't just `msgs.push` story beats into the flat rotation — a beat would flash 1-in-30. Use a dedicated **priority beat slot** (`citizenBeat`) that surfaces the *current* turning point and holds it for a few in-world hours, so a viewer can actually follow "Founder Voss: startup → IPO → richest in the city" across a session.
