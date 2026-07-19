// Minimal window.citylive stub so settings.html's main IIFE runs to completion under the test harness
// (production supplies this via the real preload). Plain function properties — contextBridge can expose
// functions but NOT a Proxy (not cloneable). Every method is an async no-op returning null.
const { contextBridge } = require('electron');
const a = () => Promise.resolve(null);
contextBridge.exposeInMainWorld('citylive', {
  checkUpdates: a, envJSON: a, geocode: a, getConfig: a, getVersion: a,
  onState: () => {}, onUpdateStatus: () => {}, refreshWallpaper: a,
  saveConfig: a, screensaver: a, setWallpaper: a
});
