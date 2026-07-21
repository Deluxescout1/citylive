// Minimal window.citylive stub so settings.html's main IIFE runs to completion under the test harness
// (production supplies this via the real preload). Plain function properties — contextBridge can expose
// functions but NOT a Proxy (not cloneable). Every method is an async no-op returning null.
const { contextBridge } = require('electron');
const a = () => Promise.resolve(null);
const chronicle = () => Promise.resolve({version:1,enabled:true,lives:[{life:7,cityName:'Testhaven',era:'Neon',firstSeenAt:1700000000000,lastSeenAt:1700001000000,events:[{key:'election:1:Campaign',at:1700001000000,kind:'election',title:'CITY ELECTION · CAMPAIGN',detail:'Mara Reyes vs Theo Chen',stage:'Campaign',people:[{name:'Mara Reyes',role:'Candidate',party:'GREENS'}]}]}]});
contextBridge.exposeInMainWorld('citylive', {
  checkUpdates: a, envJSON: a, geocode: a, getConfig: a, getVersion: a,
  onState: () => {}, onUpdateStatus: () => {}, refreshWallpaper: a,
  saveConfig: a, screensaver: a, setWallpaper: a,
  getChronicle: chronicle, recordChronicle:a, setChronicleEnabled:chronicle,
  clearChronicle:chronicle, removeChronicleLife:chronicle, exportChronicle:a,
  openChronicle:a, onNavigate:()=>{}
});
