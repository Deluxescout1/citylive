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
  geocode: (q) => ipcRenderer.invoke('citylive:geocode', q),
  // Control Center:
  setWallpaper: (on) => ipcRenderer.invoke('citylive:set-wallpaper', !!on),
  screensaver: (action) => ipcRenderer.invoke('citylive:screensaver', action), // 'enable'|'disable'|'preview'|'status'
  refreshWallpaper: () => ipcRenderer.invoke('citylive:refresh-wallpaper'),
  checkUpdates: () => ipcRenderer.invoke('citylive:check-updates'),
  onState: (cb) => ipcRenderer.on('citylive:state', (_e, s) => cb(s)),
  onUpdateStatus: (cb) => ipcRenderer.on('citylive:update-status', (_e, s) => cb(s))
});
