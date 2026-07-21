const { app, BrowserWindow } = require('electron');
const path=require('path'); app.disableHardwareAcceleration();
const HTML=process.argv[2], OUT=process.argv[3];
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1600,height:360,show:false,webPreferences:{offscreen:true,nodeIntegration:false,contextIsolation:false}});
  win.webContents.setFrameRate(4);
  await win.loadFile(HTML);
  await new Promise(r=>setTimeout(r,900));
  const named=await win.webContents.executeJavaScript("window._named");
  console.log('drawnNamed count = '+named);
  const img=await win.webContents.capturePage();
  require('fs').writeFileSync(OUT, img.toPNG());
  console.log('wrote '+OUT); app.quit();
}).catch(e=>{console.error(e);app.quit();});
