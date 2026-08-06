// CityLive preload — bridges the update-safe user settings into the sandboxed renderer.
// contextIsolation stays ON; the renderer only gets this tiny, explicit API.
const { contextBridge, ipcRenderer } = require('electron');

// Fetch the persisted config SYNCHRONOUSLY as the page loads, so city.js sees it before
// its first frame. It comes back as a JSON *string*: contextBridge freezes objects it
// exposes, and a string round-trip hands the page a clean, mutable config object.
let userConfigJSON = '{}';
try { userConfigJSON = ipcRenderer.sendSync('citylive:get-config-sync') || '{}'; } catch (e) { /* fall back to defaults */ }

// Same read-once-at-load pattern as userConfigJSON above, but for runtime/environment
// info (e.g. current wallpaper/screensaver state) the Control Center page needs before
// its first paint. Also comes back as a JSON string for the same freezing reason.
let envJSON = '{}';
try { envJSON = ipcRenderer.sendSync('citylive:get-env-sync') || '{}'; } catch (e) { /* fall back to defaults */ }

contextBridge.exposeInMainWorld('citylive', {
  userConfigJSON: userConfigJSON,
  envJSON: envJSON,
  // Settings panel:
  getConfig: () => ipcRenderer.invoke('citylive:get-config'),          // load current values
  saveConfig: (cfg) => ipcRenderer.invoke('citylive:save-config', cfg), // persist (main reloads the city)
  resetConfig: () => ipcRenderer.invoke('citylive:reset-config'),
  openConfigFile: () => ipcRenderer.invoke('citylive:open-config-file'),
  getVersion: () => ipcRenderer.invoke('citylive:get-version'),
  getChronicle: () => ipcRenderer.invoke('citylive:get-chronicle'),
  recordChronicle: (snapshot) => ipcRenderer.invoke('citylive:chronicle-record', snapshot),
  setChronicleEnabled: (enabled) => ipcRenderer.invoke('citylive:chronicle-enabled', !!enabled),
  clearChronicle: () => ipcRenderer.invoke('citylive:chronicle-clear'),
  removeChronicleLife: (life) => ipcRenderer.invoke('citylive:chronicle-remove-life', life),
  exportChronicle: (format) => ipcRenderer.invoke('citylive:chronicle-export', format),
  openChronicle: () => ipcRenderer.invoke('citylive:open-chronicle'),
  geocode: (q) => ipcRenderer.invoke('citylive:geocode', q),
  // Control Center:
  setWallpaper: (on) => ipcRenderer.invoke('citylive:set-wallpaper', !!on),
  screensaver: (action) => ipcRenderer.invoke('citylive:screensaver', action), // 'enable'|'disable'|'preview'|'status'
  refreshWallpaper: () => ipcRenderer.invoke('citylive:refresh-wallpaper'),
  checkUpdates: () => ipcRenderer.invoke('citylive:check-updates'),
  // The performance guard talks to the render page through here: `{suspended:bool}` when this
  // monitor's desktop becomes covered/revealed (or the machine locks/sleeps), and `{tier:string}`
  // when the quality tier changes on a discrete event such as unplugging the charger.
  onThrottle: (cb) => ipcRenderer.on('citylive:throttle', (_e, s) => cb(s)),
  // ⚠ THE RENDERER MUST ASK, NOT JUST LISTEN. The guard's first decision is made before this page
  // exists, so a listener alone misses it and the page draws at full price on a desktop the guard
  // already knows is covered — with the main process logging "SUSPENDED" the whole time.
  getThrottle: () => ipcRenderer.invoke('citylive:get-throttle'),
  onState: (cb) => ipcRenderer.on('citylive:state', (_e, s) => cb(s)),
  onUpdateStatus: (cb) => ipcRenderer.on('citylive:update-status', (_e, s) => cb(s)),
  onNavigate: (cb) => ipcRenderer.on('citylive:navigate', (_e, tab) => cb(tab))
});
