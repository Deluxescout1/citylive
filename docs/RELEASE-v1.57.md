# CityLive v1.57 — Foundation

This release strengthens performance, consistency, diagnostics, and clarity across
KDE, Windows/macOS/Linux desktop, web wallpaper, and phone builds.

## Added

- Optional **What's happening?** panels with event names, stages, explanations, and
  live-data freshness.
- Per-feed live, connecting, stale, disabled, and offline status for weather, air
  quality, aurora, ISS, flights, and sports.
- Visible, rate-limited render-error diagnostics; failures remain recoverable but are
  no longer silently ignored.
- Balanced quality in persistent desktop and KDE settings.
- Canonical engine synchronization and a CI parity guard.
- All-finale and major-story-arc split-render smoke tests.
- A real Chromium frame-cadence verifier.

## Changed

- All platforms now render slow sky/terrain content separately from moving foreground.
- Foreground pacing is Performance 8fps, Balanced 10fps, and Spectacle 12fps.
- Backdrops update at 0.5fps, 1fps, and 2fps respectively.
- Browser/Electron rendering uses a drift-aware scheduler and yields while hidden.
- Platform engines are byte-identical to the canonical KDE engine.

## Verification

- Unit/arc suite: eight test files, all passing.
- Instrumented engine coverage: 340/340 drawing functions executed.
- Visual matrix: 197 whole-city and 197 full-resolution renders, covering every finale,
  disaster family, major story arc, civic, building style, weather family, and system group.
- Electron visual capture: successful, no CityLive renderer errors.
- Measured 3.1-second Electron samples: Performance 23 foreground/2 background frames;
  Balanced 30/3; Spectacle 33/6.
- QML static validation: main wallpaper and configuration files pass `qmllint`.
