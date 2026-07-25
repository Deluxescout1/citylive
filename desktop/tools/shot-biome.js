// Drives tools/biome-frame.html for a given ?life=&age= and writes a PNG.
// loadURL (not loadFile) because the harness is parameterised by query string.
const { app, BrowserWindow } = require('electron');
const path=require('path'); app.disableHardwareAcceleration();
const LIFE=process.argv[2], AGE=process.argv[3], OUT=process.argv[4], HOUR=process.argv[5]||'13';
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1500,height:800,show:false,
    webPreferences:{offscreen:true,nodeIntegration:false,contextIsolation:false}});
  win.webContents.setFrameRate(4);
  await win.loadURL('file://'+path.join(__dirname,'biome-frame.html')+`?life=${LIFE}&age=${AGE}&hour=${HOUR}`);
  await new Promise(r=>setTimeout(r,1200));
  console.log(await win.webContents.executeJavaScript("window._named"));
  require('fs').writeFileSync(OUT,(await win.webContents.capturePage()).toPNG());
  app.quit();
}).catch(e=>{console.error(e);app.quit();});
