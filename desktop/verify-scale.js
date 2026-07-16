// Scaling + battle-bars verification harness.
// Env: CLW/CLH = window size, CLOUT = output png, CLDIS = force a monster disaster,
// CLERA = force a named era (engine ERAS[].name; unrecognized name → guarded no-op,
// stays live), CLDISF = disaster frequency (not renderable in a single static
// capture — accepted for symmetry with the app's settings but intentionally skipped).
// (Env, not argv: Electron main's process.argv contains Chromium switches.)
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();
const W = parseInt(process.env.CLW || '1280', 10);
const H = parseInt(process.env.CLH || '720', 10);
const OUT = process.env.CLOUT || path.join(__dirname, 'scale.png');
const DIS = process.env.CLDIS || '';
const ERA = process.env.CLERA || '';
// CLDISF (disaster frequency) is intentionally not wired to any renderable effect here —
// it only affects how OFTEN disasters occur over real time, which a single-frame static
// capture can't demonstrate. Read (so it doesn't silently no-op if someone sets it) and skipped.
if (process.env.CLDISF) console.log('CLDISF set (' + process.env.CLDISF + ') — skipped, not renderable in a static capture');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: W, height: H, show: false, useContentSize: true,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.once('did-finish-load', () => {
    const eraJs = ERA
      ? `try{ var _i=ERAS.findIndex(function(e){return e.name==='${ERA}';}); if(_i>=0) FORCEERA=_i; }catch(e){}; `
      : '';
    const js = DIS
      ? `${eraJs}FORCEDIS={type:'${DIS}',intensity:4,xf:0.5,w:60,seed:77,f:0.25}; FORCEAGE=1; 'ok'`
      : `${eraJs}FORCEAGE=1; 'ok'`;
    win.webContents.executeJavaScript(js).then(() => {
      setTimeout(async () => {
        try {
          const img = await win.webContents.capturePage();
          fs.writeFileSync(OUT, img.toPNG());
          console.log('CAPTURE_OK ' + OUT);
        } catch (e) { console.log('CAPTURE_FAIL ' + e); }
        app.quit();
      }, 2000);
    }).catch((e) => { console.log('JS_FAIL ' + e); app.quit(); });
  });
});
setTimeout(() => { console.log('TIMEOUT'); app.quit(); }, 20000);
