# CityLive v1.57 feature verification

Verified on 2026-07-21 from Linux with Node 22, Electron 33, Qt 6, and Plasma/QML tooling.
This is the acceptance ledger for **CityLive Foundation**. A pass means the feature was
executed, rendered, or exercised through its real host path; it does not mean merely that
a function exists.

## Result

**PASS with platform qualification.** The shared engine and all Linux-runnable hosts are
clean. Windows behind-icons integration, Windows `.scr` registration, and the macOS native
bundle cannot be runtime-certified on Linux; their code paths and package inputs were
reviewed, and the Electron Linux package completed successfully. They still need a short
native release-candidate check on those operating systems.

## Foundation acceptance targets

| Target | Result | Evidence |
|---|---|---|
| Canonical engine parity | PASS | Byte-identical KDE, Electron, web, and phone engines; parity guard passes. |
| Intended FPS and reduced work | PASS | Chromium samples: Performance 23 fg/2 bg, Balanced 30/3, Spectacle 33/6 over 3.1s. Performance also uses thinner engine effects. |
| Render exceptions visible | PASS | Controlled foreground exception was logged and shown in the visible recovery banner. QML foreground/background catches also report visibly. |
| Major events named and staged | PASS | Status smoke tests cover finales and all major long arcs; deterministic matrix visibly names each stage. |
| Settings persist and take effect | PASS | Sanitization and disk round-trips cover every persisted family; Electron/KDE quality selectors include Balanced; real scheduler changes were measured. |
| Offline remains attractive and labeled | PASS | Split-render smoke frame succeeds with network disabled and reports `OFFLINE MODE - SIMULATED FALLBACKS`. |
| Finale/story automation | PASS | All 12 finales at approach/impact/end plus every regime, plague, zombie-plague, Festival, and Addiction stage render without error. |

## Exhaustive engine and visual coverage

- **340/340 `draw*` functions executed** with instrumented coverage.
- **130 Qt Canvas conditions** completed through the real QML canvas with no exception.
- **197 whole-city Electron renders** completed with no setup/draw error.
- **197 full-resolution Electron renders** completed for street-level inspection.
- Day/night, eight growth stages, 12 WMO weather families, 11 public events, 15
  disasters in active/aftermath states, 12 finales in three phases, 12 takeover stages,
  20 health-crisis states, five Festival stages, five civics in construction/completed
  states, 12 building uses, 13 crowns, five window layouts, and 15 live/space/political
  systems are represented in the deterministic matrix.
- Non-regime containment remains byte-identical to the pre-takeover reference render.

## Functional groups

| Group | Result | What was verified |
|---|---|---|
| Growth and rebirth | PASS | Wilderness through metropolis, day/night, apocalypse reset paths, ruins, population/status progression. |
| Sky and astronomy | PASS | Sun/night lighting, Milky Way, aurora KP5/KP8, ISS, Starlink, Moon/colonies, space-age skyline. |
| Weather and seasons | PASS | Clear, overcast, fog, drizzle, freezing rain, rain, violent rain, snow/grains/showers, thunder/lightning, hail; weather remains readable over the city. |
| Streets and transport | PASS | Cars, pedestrians, trains, buses, crossings, aircraft, airport, ships, live-flight overlay, emergency and construction traffic draw paths. |
| Events | PASS | Market, parade, marathon, movie, concert, food festival, championship, ice rink, protest, film premiere, balloon festival. |
| Disasters and wars | PASS | Asteroid, volcano, zombie, alien, kaiju, tornado, flood, mech, kraken, sandstorm, ice age, rift, blackout, smog, and plane crash active/recovery paths. |
| Finales | PASS | Meteors, nuke, sunburst, AI, black hole, alien war, frost, kaiju, flood, kaiju war, pollution, and Moonfall at approach/impact/end. |
| Government and stories | PASS | Elections, parties, economy/hard times, THE ORDER and BILLS MAFIA stages/outcomes, protests/riots, Festival, plague/zombie plague, Addiction Crisis. |
| Buildings and landmarks | PASS | All use cues, crown types, window layouts, University, Grand Central, Zoo, Observatory, Marina, construction and completed states. |
| Sports and Buffalo mode | PASS | Sports district/scoreboard paths, gameday takeover, Bills takeover reskin, party legacies. |
| Data and clarity | PASS | Weather/air/aurora/ISS/flights/sports freshness states, concise status panel, offline label, render-error banner. |
| Configuration | PASS | Birthdays, timeline, location/name, wallpaper choice, quality, era, disasters, finale (including Moonfall), restart mode, flights, Bills, and status visibility sanitize and round-trip. |
| Hosts | PASS* | KDE QML lint/sweep, Electron runtime/cadence/Control Center/package, web/phone canonical engine and split scheduler. `*` Native Windows/macOS integration qualification above. |

## Defects found and corrected during certification

1. **Evacuation ships were unreachable.** `drawEvacuation` existed but nothing called it.
   It is now connected during late space-age apocalypse rendering.
2. **KDE Spectacle cadence was capped at 10fps.** KDE now schedules Performance/Balanced/
   Spectacle at 8/10/~12fps.
3. **Phone Spectacle still ran at Performance cadence.** Double-tap now changes foreground
   and backdrop cadence as well as effect density.
4. **Moonfall persistence coverage was incomplete.** The desktop store already accepted it,
   but the regression test and KDE schema description omitted the twelfth finale; both now
   cover the complete list.
5. **Visual matrix day/night claims were invalid.** The harness had used a daylight evening
   timestamp and pinned story time without astronomy time. It now pins true 1 PM/11 PM
   local samples to both clocks.

## Release history: what each update added

- **v1.0–1.1:** Cross-platform Electron packaging, clearer downloads, wallpaper-first Windows
  install, tray/settings workflow, and release hardening.
- **v1.2:** Location picker, wildfire smoke, and weather audit.
- **v1.3:** Selectable apocalypse and immediate world restart.
- **v1.4:** Godzilla-vs-Kong and pollution finales plus larger invasion spectacle.
- **v1.5:** “Beautiful Update” visual polish across the scene.
- **v1.6:** “Living Streets” activity and street detail.
- **v1.7:** Real sky and space systems.
- **v1.8:** Deep Space Age progression.
- **v1.9–1.9.1:** Building beauty overhaul and complete disaster throw-guard sweep.
- **v1.10:** Living World citizens, street events, and transit.
- **v1.11:** Votable civic landmarks.
- **v1.12–1.13:** Seasons/effects expansion and their render-test assets.
- **v1.14:** THE ORDER takeover story.
- **v1.15:** Expanded skies and airport.
- **v1.16:** Weather spectacle.
- **v1.17:** Nightlife district.
- **v1.18:** Mountain life.
- **v1.19:** Living harbor, port, and container traffic.
- **v1.20:** City Almanac.
- **v1.21:** Doomsday Clock.
- **v1.22:** Deeper Space Age.
- **v1.23–1.23.1:** Test-harness/CI separation and a fix ensuring “end world now” is witnessed.
- **v1.24:** THE ORDER Total Control.
- **v1.25:** Sky asterism correction.
- **v1.26–1.28:** Order rally, resistance, airship, parade, seizure-frame correction,
  hillside emblem, Ministry, motorcade, and renaming set pieces.
- **v1.29–1.30:** THE PLAGUE, plague extras, and ZOMBIE PLAGUE arcs.
- **v1.31–1.32:** Flight edge-case cleanup and disaster-intensity visual harness.
- **v1.33:** Meteor-shower/ISS news, Starlink trains, deeper real sky, and containment hardening.
- **v1.34–1.36:** Redrawn, less-blocky titan/kaiju finales and disasters; richer Order night
  lighting, uniforms, and satellite sky.
- **v1.37–1.37.1:** THE FESTIVAL/World’s Fair arc and bunting placement fix.
- **v1.38:** CITY 9 NEWS rooftop jumbotrons and plane-destruction fix.
- **v1.39:** Party legacy, multi-channel jumbotrons, and plane-motion fixes.
- **v1.40:** Hard Times makes the economy visible on streets.
- **v1.41:** Expanded visible homelessness story.
- **v1.42:** Escalating Addiction Crisis with visually distinct people and responses.
- **v1.43:** Regional four-team sports district.
- **v1.44:** Auto-location, bigger stadiums, and live game scores.
- **v1.45:** Monumental stadiums and apocalypse playback only while the computer is on.
- **v1.46:** Reserved in-season sports complex and anti-clutter layout.
- **v1.47:** Plane-crash disaster.
- **v1.49:** Construction overhaul, live game action, and economy tracker.
- **v1.50:** KDE self-updater and Linux `.deb` update notice.
- **v1.51:** Multi-monitor mountain-stripe/vertical-line correction.
- **v1.52:** Opt-in Buffalo Bills gameday takeover.
- **v1.53:** BILLS MAFIA takeover arc.
- **v1.54:** BILLS MAFIA promoted to a universal special event.
- **v1.55:** Buffalo crest, uniform mandate, football catch, and Moonfall fixes.
- **v1.56:** Protests and riots for every takeover, with suppression and victory outcomes.
- **v1.57:** Canonical cross-platform engine, split renderer, correct quality scheduling,
  Balanced persistence, visible diagnostics, data freshness, status clarity, and exhaustive
  feature certification.

## Recommended next update

Proposed **v1.58: “CityLive Observatory”** should focus on clarity without clutter:

1. **Event timeline drawer:** current event, stage, start/expected end, and the last three
   milestones, opened from the compact status card.
2. **Data details popover:** per-feed age, source, last success, and fallback behavior with
   plain-language green/amber/gray states.
3. **Accessibility controls:** status scale, high-contrast labels, reduced flashes, reduced
   motion, and color-safe emergency palettes.
4. **Performance HUD:** optional FPS/frame time, quality tier, canvas size, foreground and
   backdrop cadence—off by default, useful for support.
5. **Visual-regression baselines:** perceptual comparisons for the deterministic matrix so
   blank, clipped, or unexpectedly changed features fail CI automatically.
6. **Native release gate:** one scripted smoke checklist each for Windows wallpaper/screensaver,
   macOS bundle/fullscreen, KDE multi-monitor, web wallpaper, and phone/PWA.
7. **Guided first run:** a short, polished overlay explaining live data, status, controls,
   offline behavior, and where settings live.
8. **Event encyclopedia:** an Almanac section listing discovered events/finales and what their
   symbols mean, keeping future events hidden until witnessed.

