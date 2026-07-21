// Regression guard for the Control Center: loading 11.8k lines of city.js for the Almanac must NOT break
// the existing settings IIFE (wallpaper toggle / screensaver / location / save). Runs with a stub
// window.citylive preload so the IIFE executes fully, captures console errors + uncaught exceptions, and
// asserts the pre-existing UI still initialized (wpToggle got its rendered text). Run with electron.
const { app, BrowserWindow } = require('electron');
const path = require('path');
app.disableHardwareAcceleration();
const errs = [];
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 760, height: 1000, show: false,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false,
      preload: path.join(__dirname, 'cc-preload.js') } });
  win.webContents.on('console-message', (_e, level, msg) => { if (level >= 2 && !/Security Warning|Insecure Content-Security/.test(msg)) errs.push('console:' + msg); });
  win.webContents.on('render-process-gone', (_e, d) => errs.push('render-gone:' + JSON.stringify(d)));
  win.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'));
  win.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      try {
        const probe = await win.webContents.executeJavaScript(`(function(){
          return {
            wp: (document.getElementById('wpToggle')||{}).textContent||'',
            hasAlm: typeof window.almanacData==='function',
            almFilled: ((document.getElementById('almanacBody')||{}).innerText||'').length,
            chronicle: ((document.getElementById('chronBody')||{}).innerText||''),
            ssBtn: !!document.getElementById('ssEnable'),
            saveBtn: !!document.getElementById('citySave')
          };})()`);
        // the IIFE's renderWpToggle() sets wpToggle text — if the IIFE broke, it'd be empty/default
        const iifeOk = /Wallpaper:/.test(probe.wp);
        const bad = errs.length > 0 || !iifeOk || !probe.hasAlm || probe.almFilled < 20 || !/Testhaven/.test(probe.chronicle);
        await win.webContents.executeJavaScript("document.getElementById('tabChronicle').click(); 'ok'");
        await new Promise((resolve) => setTimeout(resolve, 250));
        const shot = await win.webContents.capturePage();
        require('fs').writeFileSync('/tmp/citylive-chronicle-tab.png', shot.toPNG());
        console.log('wpToggle="' + probe.wp.slice(0, 40) + '" hasAlm=' + probe.hasAlm + ' almLen=' + probe.almFilled +
          ' chronicle=' + /Testhaven/.test(probe.chronicle) + ' ssBtn=' + probe.ssBtn + ' saveBtn=' + probe.saveBtn);
        if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
        console.log(bad ? 'CC_REGRESSION_FAIL' : 'CC_REGRESSION_OK (existing IIFE intact alongside the engine)');
      } catch (e) { console.log('CC_REGRESSION_ERR ' + e); }
      app.quit();
    }, 2500);
  });
});
setTimeout(() => { console.log('TIMEOUT'); app.quit(); }, 20000);
