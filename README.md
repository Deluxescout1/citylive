# CityLive — a living pixel-city live wallpaper for KDE Plasma 6

An animated pixel city that spans your monitor(s) as one continuous world:
real Norwich CT day/night cycle, live weather, the **real night sky** (actual
constellations + the moon in its true position *and* phase), an airport with
planes, traffic that stops at lights, a scheduled elevated train, pedestrians
who walk into buildings, holiday decorations for every holiday, and birthday
banners.

It is a **pure QML + JavaScript** Plasma wallpaper plugin — no compiling, no
dependencies, no WebEngine. Just files.

## Get it — pick your platform

| Platform | What to use |
|----------|-------------|
| **Windows / macOS / Linux** — download & run a real app | **[`desktop/`](desktop/README.md)** — a native installer (`.exe` / `.dmg` / `AppImage` / `.deb`). Double-click to install; runs in its own window or full-screen "wallpaper mode". |
| **Linux + KDE Plasma 6** — true desktop wallpaper (crispest) | `./install.sh` (below). |
| **Anything with a browser** (phones/tablets/TVs) | open [`web/index.html`](web/README.md). |

All three run the **same engine** — the desktop app is the easiest download-and-run
option; the KDE plugin is the sharpest as an actual wallpaper on Plasma. See
**[`desktop/README.md`](desktop/README.md)** for install/build details.

## Requirements
- KDE **Plasma 6** (Wayland or X11), Qt 6.
- That's it. Internet is optional (used only for live weather; it degrades gracefully offline).

## Install (Arch laptop or any Plasma 6 machine)
Copy this whole `CityLive` folder to the target machine, then:

```bash
cd CityLive
./install.sh
```

The installer copies the plugin, sets it as your wallpaper on every desktop,
auto-sizes the city to your screen(s), and reloads the shell. Re-runnable any time.

### Manual install (if you prefer)
```bash
cp -r org.citylive.wallpaper ~/.local/share/plasma/wallpapers/
```
Then: **System Settings → Wallpaper → Wallpaper type → “CityLive Pixel City.”**
(With a manual install the city auto-detects your total screen width; the
`install.sh` path also pins it in config, which is a bit more reliable on
multi-monitor rigs.)

## Change the location
Everything astronomical/weather is tied to Norwich CT by default. To use your own
city, edit the first line of `contents/js/city.js`:
```js
var LAT = 41.5243, LON = -72.0759;   // change to your latitude/longitude
```
then re-run `./install.sh` (or restart plasmashell).

## Multi-monitor notes
- The city is **one continuous world** across horizontally-arranged monitors —
  cars, the train and planes cross from one screen to the next in sync.
- Monitors should be **bottom-aligned** on your desk (the road sits at the same
  height above each screen's bottom).
- If your arrangement is unusual (stacked, gaps, mixed scaling) and the seams
  don't line up, set the total desktop width by hand in
  **System Settings → Wallpaper → (CityLive config)** via the `worldW` value, or
  edit it in `~/.config/plasma-org.kde.plasma.desktop-appletsrc`.

## Uninstall
```bash
./uninstall.sh
```

## What's inside
```
org.citylive.wallpaper/
  metadata.json            plugin manifest
  contents/ui/main.qml     per-screen canvas + self-location
  contents/ui/config.qml   settings page
  contents/config/main.xml config keys (scene, worldW, worldX, taskbarPx)
  contents/js/city.js       the whole engine (~1000 lines of pixel city)
```

MIT licensed. Built for fun. 🌆

## Quality tiers (2026-07-06)
Per-screen setting: right-click desktop > Configure Desktop and Wallpaper — each
monitor's wallpaper config accepts quality = performance | balanced | spectacle.
(The usually-covered center monitor is a good candidate for "performance".)

## Tools (2026-07-06)
- tools/chronicle.js [life]  — writes the full written history of any life
  (past OR future — the sim is deterministic; reading a future life is a spoiler!)
- tools/timelapse.sh [life] [frames] [left|mid|right|world] — renders any life
  as a video (~12 min for 360 frames -> 15s @24fps)
- A systemd user timer (citylive-weekly) auto-writes the chronicle + timelapse of
  each life every Sunday 00:30, just after the rebirth. Output: chronicles/ and
  timelapses/ in this folder.
