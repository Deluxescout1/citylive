// Capture the KDE-slice reproduction page. Env: KRQ (query string), KROUT (png path).
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
app.disableHardwareAcceleration();
const Q = process.env.KRQ || '';
const OUT = process.env.KROUT || path.join(__dirname, 'kde-repro.png');
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 2560, height: 1440, show: false,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false } });
  win.webContents.on('console-message', (_e, _l, msg) => { if (/^MWGRID|^MW:|^PERF/.test(msg)) console.log(msg); });
  win.loadFile(path.join(__dirname, 'kde-repro.html'), { search: Q });
  win.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      try { const img = await win.webContents.capturePage();
        fs.writeFileSync(OUT, img.toPNG());
        console.log('CAPTURE_OK ' + OUT + ' title=' + win.webContents.getTitle());
      } catch (e) { console.log('CAPTURE_FAIL ' + e); }
      app.quit();
    }, 2500);
  });
});
setTimeout(() => { console.log('TIMEOUT'); app.quit(); }, 20000);
