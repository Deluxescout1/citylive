# CityLive — run it anywhere (Windows · macOS · Linux · phones)

The whole city is **pure Canvas2D JavaScript with no Qt/QML dependency**, so it runs
in any modern browser. `web/index.html` is a polished full-screen build with a control
bar: pick a **city/era**, scrub the **time of day** and the **city's age**, choose a
**quality** tier, pause, or go fullscreen. Leave everything on **Live** and it follows
real local time + real weather, growing on its own week-long cycle.

## Easiest: just open it
Double-click **`web/index.html`** — it opens in your default browser on any OS. That's it.
(No server, no install. Live weather needs internet; it degrades gracefully offline.)

## Full-screen "wallpaper" look
- **Any OS:** open `web/index.html`, click the **⛶** button (or press F11) for fullscreen.
- **Chrome/Edge:** ⋮ menu → *Cast, save, and share* → *Create shortcut…* → tick
  *Open as window* for an app-like window with no browser chrome.
- **macOS Safari:** File → *Add to Dock* (Sonoma+) for a standalone app window.

## Serve to other devices on your network
```bash
cd CityLive/web
python3 -m http.server 8171        # or:  npx serve .
```
Then open `http://<this-computer-ip>:8171` on any phone/tablet/TV on the same Wi-Fi.
On a phone, use the browser's **"Add to Home Screen"** for a fullscreen kiosk app.

## As an actual desktop wallpaper
- **Linux / KDE Plasma 6:** use the native plugin instead — run `../install.sh` (crisper, no browser).
- **Windows:** [Lively Wallpaper](https://www.rocksdanister.com/lively/) → *Add Wallpaper* →
  point it at this `web/index.html` (or the hosted URL).
- **macOS:** [Plash](https://apps.apple.com/app/plash/id1494023538) → set the URL / local file
  to `web/index.html`.
- **Any OS:** [Wallpaper Engine](https://www.wallpaperengine.io/) (Steam) also accepts a local web page.

## Notes
- `web/city.js` is the **same engine** as the KDE wallpaper; `../install.sh` keeps it synced.
  To update by hand: `cp ../org.citylive.wallpaper/contents/js/city.js .`
- Controls map to the engine's live hooks (era, growth age, clock) — nothing is faked.
- Rendering is nearest-neighbour pixel-art; the canvas auto-sizes to the window & device pixel ratio.
