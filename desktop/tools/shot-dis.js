const { app, BrowserWindow } = require('electron'); app.disableHardwareAcceleration();
const HTML=process.argv[2], OUT=process.argv[3];
app.whenReady().then(async()=>{ const win=new BrowserWindow({width:1600,height:360,show:false,webPreferences:{offscreen:true,nodeIntegration:false,contextIsolation:false}});
  win.webContents.setFrameRate(4); await win.loadFile(HTML); await new Promise(r=>setTimeout(r,900));
  console.log('disaster: '+await win.webContents.executeJavaScript("window._dis"));
  require('fs').writeFileSync(OUT,(await win.webContents.capturePage()).toPNG()); app.quit(); }).catch(e=>{console.error(e);app.quit();});
