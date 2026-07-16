// CityLive preload — bridges the update-safe user settings into the sandboxed renderer.
// contextIsolation stays ON; the renderer only gets this tiny, explicit API.
const { contextBridge, ipcRenderer } = require('electron');

// Fetch the persisted config SYNCHRONOUSLY as the page loads, so city.js sees it before
// its first frame. It comes back as a JSON *string*: contextBridge freezes objects it
// exposes, and a string round-trip hands the page a clean, mutable config object.
let userConfigJSON = '{}';
try { userConfigJSON = ipcRenderer.sendSync('citylive:get-config-sync') || '{}'; } catch (e) { /* fall back to defaults */ }

contextBridge.exposeInMainWorld('citylive', {
  userConfigJSON: userConfigJSON,
  // Settings panel:
  getConfig: () => ipcRenderer.invoke('citylive:get-config'),          // load current values
  saveConfig: (cfg) => ipcRenderer.invoke('citylive:save-config', cfg), // persist (main reloads the city)
  resetConfig: () => ipcRenderer.invoke('citylive:reset-config'),
  openConfigFile: () => ipcRenderer.invoke('citylive:open-config-file'),
  onOpenSettings: (cb) => ipcRenderer.on('citylive:open-settings', () => cb()),
  getVersion: () => ipcRenderer.invoke('citylive:get-version'),
  settingsClosed: () => ipcRenderer.send('citylive:settings-closed')
});
