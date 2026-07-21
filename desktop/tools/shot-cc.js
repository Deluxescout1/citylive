// Offscreen screenshot of the Control Center's Citizens tab — never opens a visible window.
// Usage: xvfb-run -a electron desktop/tools/shot-cc.js  (or plain electron; uses offscreen render)
const { app, BrowserWindow } = require('electron');
const path = require('path');
app.disableHardwareAcceleration();
const OUT = process.argv[2] || path.join(app.getPath('temp') || '/tmp', 'cc-citizens.png');
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 720, height: 1240, show: false,
    webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: false,
      preload: path.join(__dirname, '..', 'preload.js') }
  });
  win.webContents.setFrameRate(2);
  await win.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'));
  // switch to the Citizens tab and let the roster render
  await win.webContents.executeJavaScript(
    "new Promise(r=>{try{document.getElementById('tabCitizens').click();}catch(e){}setTimeout(r,600);});"
  );
  const img = await win.webContents.capturePage();
  require('fs').writeFileSync(OUT, img.toPNG());
  console.log('wrote ' + OUT);
  app.quit();
}).catch(e => { console.error(e); app.quit(); });
