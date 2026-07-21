// Real Chromium cadence check for the adaptive two-layer renderer.
// Run under a display (CI: xvfb-run -a electron verify-fps.js).
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 960, height: 540, show: false,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false } });
  await win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  const result = await win.webContents.executeJavaScript(`(async function(){
    var realDraw=window.draw, counts={fg:0,bg:0};
    window.draw=function(g,pass){ if(pass==='fg')counts.fg++; if(pass==='bg')counts.bg++; return realDraw(g,pass); };
    async function sample(q){ var el=document.getElementById('q'); el.value=q; el.dispatchEvent(new Event('change'));
      counts.fg=counts.bg=0; await new Promise(function(r){setTimeout(r,3100);}); return {fg:counts.fg,bg:counts.bg}; }
    return {performance:await sample('performance'),balanced:await sample('balanced'),spectacle:await sample('spectacle')};
  })()`);
  console.log('FPS_COUNTS ' + JSON.stringify(result));
  const ok = result.performance.fg >= 20 && result.performance.fg <= 28 &&
    result.balanced.fg >= 26 && result.balanced.fg <= 34 &&
    result.spectacle.fg >= 32 && result.spectacle.fg <= 40 &&
    result.performance.bg < result.balanced.bg && result.balanced.bg < result.spectacle.bg;
  console.log(ok ? 'FPS_OK' : 'FPS_FAIL');
  app.exit(ok ? 0 : 1);
});
setTimeout(() => { console.error('FPS_TIMEOUT'); app.exit(1); }, 20000);
