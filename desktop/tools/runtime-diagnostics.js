'use strict';

// Browser-level acceptance check for user-facing diagnostics. It deliberately
// throws once from the normal foreground render path and proves that the failure
// is logged and surfaced in the UI, then confirms the offline freshness label.
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const messages = [];
  const win = new BrowserWindow({ width: 960, height: 540, show: false,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false } });
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) messages.push(message);
  });
  await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  const result = await win.webContents.executeJavaScript(`(async function(){
    var original=window.draw, thrown=false;
    window.draw=function(g,pass){if(pass==='fg'&&!thrown){thrown=true;throw new Error('diagnostic probe');}return original(g,pass);};
    await new Promise(function(resolve){setTimeout(resolve,700);});
    window.draw=original;
    var err=document.getElementById('renderError');
    NOFETCH=true; // deterministic offline-label check even when CI happens to have network
    var status=typeof liveDataStatus==='function'?liveDataStatus(Date.now()):null;
    return {thrown:thrown,errorVisible:getComputedStyle(err).display!=='none',errorText:err.textContent,
      offline:!!(status&&/OFFLINE MODE/.test(status.label)),dataLabel:status&&status.label};
  })()`);
  const logged = messages.some((m) => /diagnostic probe/.test(m));
  const ok = result.thrown && result.errorVisible && /diagnostic probe/.test(result.errorText) && logged && result.offline;
  console.log('DIAGNOSTICS ' + JSON.stringify({ result, logged }));
  console.log(ok ? 'DIAGNOSTICS_OK' : 'DIAGNOSTICS_FAIL');
  app.exit(ok ? 0 : 1);
}).catch((error) => { console.error(error); app.exit(1); });
setTimeout(() => { console.error('DIAGNOSTICS_TIMEOUT'); app.exit(1); }, 10000);
