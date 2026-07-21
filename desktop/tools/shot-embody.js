const { app, BrowserWindow } = require('electron');
const path = require('path');
app.disableHardwareAcceleration();
const HTML=process.argv[2], OUT=process.argv[3], AGE=process.argv[4]||'0.72';
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1400, height: 480, show: false,
    webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: false } });
  win.webContents.setFrameRate(4);
  await win.loadFile(HTML);
  // force a mature metropolis (all buildings up) + a fixed daytime moment so workers wear job clothes
  await win.webContents.executeJavaScript(`new Promise(r=>setTimeout(()=>{
    try{ var d=new Date(); d.setHours(11,0,0,0); window.NOWOVR=d.getTime(); window.FORCEAGE=${AGE};
      if(window.CLOCK!==undefined) window.CLOCK=window.NOWOVR; }catch(e){}
    setTimeout(r, 900);
  }, 1400));`);
  const img = await win.webContents.capturePage();
  require('fs').writeFileSync(OUT, img.toPNG());
  console.log('wrote '+OUT); app.quit();
}).catch(e=>{console.error(e);app.quit();});
