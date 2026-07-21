# CityLive v1.58 — The City Chronicle

CityLive can now remember the story the user actually witnessed. The Chronicle is a
separate tab in the Control Center on Windows/Linux Electron and a witnessed-history
section in KDE wallpaper settings.

## Added

- Witness-only event recording: nothing is reconstructed from shutdown time and no future
  event or outcome is exposed.
- A polished Chronicle timeline grouped by civilization, capped at the latest 25 lives.
- Stable full names for election candidates, allowing a citizen to be followed through a
  campaign, debate, election, term, scandal, and recall.
- Recorded elections, public events, disasters, wars, finales, takeovers, health crises,
  the World Expo, Bills gameday, and power outages with clear stages and participants.
- Chronicle access from the Control Center tab, “What’s happening?” card, application menu,
  tray menu, and `Ctrl+H`.
- Text, PNG, and JSON exports.
- Pause recording, delete one civilization, and confirmed clear-all controls.
- KDE-local witnessed-history storage with the same 25-civilization cap.

## Privacy and behavior

- The Electron Chronicle is stored as `chronicle.json` in CityLive's OS user-data folder.
- KDE stores its Chronicle in Qt's local application database.
- Recording happens only while the renderer is active and only when an event is visibly in
  progress. Ordinary idle frames are not stored.
- Repeated one-second observations are deduplicated and do not continuously rewrite disk.
- Chronicle data remains separate from update-safe CityLive preferences.

## Verification targets

- Store sanitization, deduplication, pause, deletion, export, and 25-life retention.
- Full candidate names remain deterministic for a life and election term.
- Chronicle UI loads without regressing wallpaper, screensaver, city settings, or Almanac.
- KDE QML static/runtime validation and Electron packaging include the new store.
- Existing exhaustive engine, visual, FPS, offline, and diagnostics suites remain green.

