const { app, BrowserWindow } = require('electron');
app.disableHardwareAcceleration();
const HTML=process.argv[2], OUT=process.argv[3];
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1500,height:520,show:false,webPreferences:{offscreen:true,nodeIntegration:false,contextIsolation:false}});
  win.webContents.setFrameRate(4);
  await win.loadFile(HTML);
  await win.webContents.executeJavaScript(`new Promise(r=>setTimeout(()=>{var d=new Date();d.setHours(12,30,0,0);window.NOWOVR=d.getTime();window.CLOCK=window.NOWOVR;window.FORCEAGE=0.85;setTimeout(r,900);},1400));`);
  // pick a drawn citizen, map to client coords, dispatch a real tap
  const info = await win.webContents.executeJavaScript(`(function(){
    if(!window.drawnNamed||!window.drawnNamed.length) return 'no drawn';
    var cv=document.getElementById('cv'), r=cv.getBoundingClientRect(), z=(window.ZOOM||1);
    // find a citizen near screen center-bottom for a good shot
    var d=window.drawnNamed.reduce(function(b,x){return Math.abs(x.sx-800)<Math.abs(b.sx-800)?x:b;});
    var cx=r.left+(d.sx*z)*(r.width/cv.width), cy=r.top+((d.y-3)*z)*(r.height/cv.height);
    function ev(t){ return new PointerEvent(t,{clientX:cx,clientY:cy,bubbles:true,pointerId:1}); }
    window.dispatchEvent(ev('pointerdown')); window.dispatchEvent(ev('pointerup'));
    var card=document.getElementById('clzInspect');
    return card ? ('CARD: '+card.querySelector('.in-n').textContent+' @ '+Math.round(cx)+','+Math.round(cy)) : 'NO CARD (drawn='+window.drawnNamed.length+')';
  })()`);
  console.log(info);
  require('fs').writeFileSync(OUT,(await win.webContents.capturePage()).toPNG());
  app.quit();
}).catch(e=>{console.error(e);app.quit();});
