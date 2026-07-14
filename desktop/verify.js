// Headless smoke-test for the packaged app: render the engine offscreen, capture a
// frame, report any renderer console errors, and quit. Does NOT show a window.
// Run:  ./node_modules/.bin/electron verify.js /path/out.png
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.disableHardwareAcceleration(); // stable offscreen capture in a headless context
const OUT = process.argv[2] || path.join(__dirname, 'verify.png');
let errors = [];

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1280, height: 720, show: false,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false }
  });
  win.webContents.on('console-message', (_e, level, msg) => {
    if (level >= 2) errors.push(msg); // 2=warning,3=error
  });
  win.webContents.on('render-process-gone', (_e, d) => { errors.push('render-process-gone: ' + JSON.stringify(d)); });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      try {
        const img = await win.webContents.capturePage();
        require('fs').writeFileSync(OUT, img.toPNG());
        console.log('CAPTURE_OK ' + OUT + ' bytes=' + img.toPNG().length);
      } catch (e) { console.log('CAPTURE_FAIL ' + e); }
      console.log('RENDERER_ISSUES ' + JSON.stringify(errors));
      app.quit();
    }, 2500);
  });
});
setTimeout(() => { console.log('TIMEOUT'); app.quit(); }, 15000);
