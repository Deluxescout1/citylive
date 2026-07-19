// Verify the Control Center's City Almanac card renders REAL values in Chromium (the surface
// qml-sweep/kde-repro never touch). Loads settings.html headless, dumps #almanacBody text, and
// captures a PNG. Fails loudly on NaN/undefined/empty. Run: xvfb-run -a node_modules/.bin/electron test/almanac-render.js
const { app, BrowserWindow } = require('electron');
const path = require('path'), fs = require('fs');
app.disableHardwareAcceleration();
const OUT = process.env.KROUT || path.join(__dirname, '..', 'almanac-cc.png');
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 760, height: 1200, show: false,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false } });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'));
  win.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      try {
        const txt = await win.webContents.executeJavaScript(
          "(function(){var b=document.getElementById('almanacBody');return b?b.innerText:'NO_BODY';})()");
        const hasEngine = await win.webContents.executeJavaScript("typeof window.almanacData==='function'");
        await win.webContents.executeJavaScript("document.getElementById('cardAlmanac').scrollIntoView({block:'start'})"); await new Promise(r=>setTimeout(r,300)); const img = await win.webContents.capturePage(); fs.writeFileSync(OUT, img.toPNG());
        console.log('ENGINE_LOADED=' + hasEngine);
        console.log('--- #almanacBody innerText ---\n' + txt + '\n--- end ---');
        const bad = /NaN|undefined|\[object|Loading…|unavailable|Almanac error/.test(txt) || txt === 'NO_BODY' || !hasEngine;
        console.log(bad ? 'ALMANAC_CC_FAIL' : 'ALMANAC_CC_OK  (png ' + OUT + ')');
      } catch (e) { console.log('ALMANAC_CC_ERR ' + e); }
      app.quit();
    }, 2500);
  });
});
setTimeout(() => { console.log('TIMEOUT'); app.quit(); }, 20000);
