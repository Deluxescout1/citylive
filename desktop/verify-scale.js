// Scaling + battle-bars verification harness.
// Env: CLW/CLH = window size, CLOUT = output png, CLDIS = force a monster disaster.
// (Env, not argv: Electron main's process.argv contains Chromium switches.)
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();
const W = parseInt(process.env.CLW || '1280', 10);
const H = parseInt(process.env.CLH || '720', 10);
const OUT = process.env.CLOUT || path.join(__dirname, 'scale.png');
const DIS = process.env.CLDIS || '';

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: W, height: H, show: false, useContentSize: true,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.once('did-finish-load', () => {
    const js = DIS
      ? `FORCEDIS={type:'${DIS}',intensity:4,xf:0.5,w:60,seed:77,f:0.25}; FORCEAGE=1; 'ok'`
      : `FORCEAGE=1; 'ok'`;
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
