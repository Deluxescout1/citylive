# CityLive — desktop app (Windows · macOS · Linux)

A real, installable desktop application. Same living pixel-city engine as the KDE
wallpaper, wrapped in a native window with **Electron** so it looks identical on every
OS. Real local time, real weather, day/night, seasons, festivals, and the occasional
disaster — running in its own app window (or full-screen "wallpaper mode").

## Download & install

Grab the installer for your OS from the **[Releases page](https://github.com/citylive/citylive/releases)**:

| OS | File | How to install |
|----|------|----------------|
| **Windows** | `CityLive-Setup-x.y.z.exe` | Double-click, follow the installer. Creates a Start-menu + desktop shortcut. |
| **macOS** | `CityLive-x.y.z-universal.dmg` | Open the `.dmg`, drag **CityLive** to Applications. First launch: right-click → *Open* (unsigned build). |
| **Linux** | `CityLive-x.y.z.AppImage` | `chmod +x CityLive-*.AppImage` then run it. No install needed. |
| **Linux (Debian/Ubuntu)** | `citylive_x.y.z_amd64.deb` | `sudo apt install ./citylive_*.deb` |

## Using it

- **Controls:** hover the top edge of the window for the control bar — pick a **city/era**,
  scrub the **time of day** and the **city's age**, choose a **quality** tier, pause, or go
  full screen. Leave everything on **Live** and it follows real time + real weather.
- **Full screen:** press **F11** (or the ⛶ button).
- **Wallpaper mode:** menu → *Wallpaper Mode* (or **Ctrl/Cmd+Shift+W**) for a clean,
  borderless, full-screen ambient view you can leave running behind everything.
- **System tray:** a tray icon lets you show/hide, toggle full screen, or quit.

> Live weather needs internet; it degrades gracefully offline. Default location is
> Norwich CT — change `LAT`/`LON` at the top of `renderer/city.js` (or rebuild) for yours.

## Run from source

```bash
cd CityLive/desktop
npm install
npm start          # launches the app
```

## Build the installers yourself

Each OS builds its **own** installer (Apple and Microsoft toolchains can't run on Linux):

```bash
npm run dist:linux   # → dist/*.AppImage, dist/*.deb   (build on Linux)
npm run dist:win     # → dist/*.exe                     (build on Windows)
npm run dist:mac     # → dist/*.dmg                      (build on macOS)
```

**All three at once, automatically:** push a version tag and GitHub Actions
(`.github/workflows/build.yml`) builds every OS on its native runner and attaches the
installers to a Release:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

Or trigger it manually from the repo's **Actions** tab (*Build CityLive desktop apps*).

## Notes

- `renderer/city.js` is the **same engine** as the KDE wallpaper; `../install.sh` keeps it
  synced. To update by hand: `cp ../org.citylive.wallpaper/contents/js/city.js renderer/`.
- Builds are unsigned (fine for personal use). To code-sign, add `CSC_LINK`/`CSC_KEY_PASSWORD`
  (Windows) or Apple signing secrets and flip `CSC_IDENTITY_AUTO_DISCOVERY` in the workflow.
- `npm run pack` makes an unpacked build in `dist/*-unpacked/` for quick testing without an installer.
