# CityLive in a browser — every OS (phone, Windows, macOS, Linux)

The engine is pure Canvas2D JavaScript with **no Qt/QML dependency**, so `phone/city.js`
is the *same* engine as the KDE wallpaper and runs unchanged in any modern browser —
Windows, macOS, Linux, Android, iOS. Verified rendering in headless Chromium.
`./install.sh` keeps `phone/city.js` in lockstep with the canonical engine automatically.

## Quick start (same Wi-Fi as the PC)
1. On the PC:  cd ~/CityLive/phone && python3 -m http.server 8171
2. On the phone, open:  http://<PC-IP>:8171
   (find the IP with: ip -4 addr show | grep inet)
3. In Chrome/Samsung Internet: menu -> "Add to Home screen" -> installs as a
   fullscreen app (PWA). Launch it from the home screen for the kiosk look.

Notes
- Runs the "performance" quality tier at 10fps -- easy on the battery.
- The whole city fits the phone screen (single-screen SMALLW mode: it keeps
  the stadium, city hall, school, museum, Ferris wheel and one mega-tower).
- Portrait works; landscape shows more of the skyline.
- Weather still comes from Open-Meteo for Norwich CT, live.
- To update: just re-run `./install.sh` (it re-syncs this folder's city.js from the
  canonical engine), or manually `cp ../org.citylive.wallpaper/contents/js/city.js .`.
- Desktop browsers: open `phone/index.html` directly, or serve the folder and visit it.
