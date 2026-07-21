const { app, BrowserWindow } = require('electron');
const path = require('path');
app.disableHardwareAcceleration();
const HTML = process.argv[2], OUT = process.argv[3];
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 430, height: 920, show: false,
    webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: false } });
  win.webContents.setFrameRate(2);
  await win.loadFile(HTML);
  await win.webContents.executeJavaScript(
    "new Promise(r=>setTimeout(()=>{try{document.getElementById('clzBtn').click();}catch(e){}setTimeout(r,700);},1200));");
  const img = await win.webContents.capturePage();
  require('fs').writeFileSync(OUT, img.toPNG());
  console.log('wrote ' + OUT); app.quit();
}).catch(e => { console.error(e); app.quit(); });
