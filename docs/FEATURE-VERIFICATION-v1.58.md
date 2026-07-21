# CityLive v1.58 verification — The City Chronicle

Verified on 2026-07-21 on Linux with Node 22, Electron 33, Qt 6, QML LocalStorage,
and the existing CityLive exhaustive render harnesses.

## Acceptance result

**PASS for Windows/Linux code and Linux runtime.** Windows uses the same tested Electron
store, renderer, IPC, and Control Center code; the new store is present inside the packaged
ASAR. Native behind-icons behavior remains unchanged from v1.57 and still requires final
physical-Windows release-candidate confirmation.

| Requirement | Result | Evidence |
|---|---|---|
| Chronicle lives in Settings | PASS | Dedicated responsive tab in the existing Control Center; KDE settings has a witnessed-history section. |
| Keep 25 civilizations | PASS | Unit test writes 30 lives and confirms only lives 6–30 remain; KDE SQL applies the same cap. |
| Record only while running | PASS | Hosts call `chronicleSnapshot` from their active one-second status timer. No reconstruction job exists. |
| Never expose the future | PASS | Snapshot API returns only currently active rendered state and returns `null` during ordinary frames. No future field is stored or rendered. |
| Attractive exports | PASS | Readable text, cropped PNG timeline, and complete JSON backup. |
| Named election citizens | PASS | Stable deterministic full names are used in campaign, debate, result, office, scandal, and recall states and stored as participant records. |
| Windows, Linux Electron, KDE | PASS* | Electron runtime and package pass on Linux; cross-platform Electron code has no OS-specific Chronicle branch; KDE database smoke passes. `*` Physical Windows confirmation noted above. |
| All entry points | PASS | Settings tab, clickable status card, application menu, tray menu, and `Ctrl+H`. |
| Privacy controls | PASS | Pause recording, delete one civilization, and confirmed clear-all. KDE provides pause and confirmed clear-all. |

## Automated evidence

- Nine automated test files pass.
- Chronicle store tests cover sanitization, witnessed-only gating, deduplication, 25-life
  retention, pause, individual deletion, and text export.
- Candidate smoke test verifies two stable full names and absence of future data.
- QML LocalStorage smoke test confirms database creation and unique-event deduplication.
- `qmllint` passes for wallpaper and configuration QML.
- Real Qt Canvas sweep: 130 conditions clean.
- Instrumented engine coverage: 340/340 drawing functions.
- Electron feature matrix: 197/197 deterministic feature renders.
- Control Center runtime verifies Chronicle, Almanac, wallpaper, screensaver, and settings
  initialize together without console/runtime errors.
- Chromium cadence remains Performance 23/2, Balanced 30/3, Spectacle 33/6 over 3.1 seconds.
- Runtime render-error/offline diagnostics remain green.
- Linux unpacked package completes and contains `chronicle-store.js`, `main.js`, and the
  updated Settings renderer.

## Visual review

The Chronicle tab uses the established dark glass/cyan/magenta Control Center language.
Recording rules and retention are stated at the top, export and privacy actions are clearly
separated, civilizations are collapsible, events form a readable timeline, and named people
appear as compact role/party chips. Singular/plural counts and redundant stage labels were
polished after screenshot review.

