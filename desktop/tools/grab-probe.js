const { app, BrowserWindow } = require('electron'); app.disableHardwareAcceleration();
const HTML=process.argv[2];
app.whenReady().then(async()=>{ const win=new BrowserWindow({width:1500,height:520,show:false,webPreferences:{offscreen:true,nodeIntegration:false,contextIsolation:false}});
  win.webContents.setFrameRate(6); await win.loadFile(HTML); await new Promise(r=>setTimeout(r,900));
  const res=await win.webContents.executeJavaScript(`(function(){
    if(!window.drawnNamed||!window.drawnNamed.length) return 'no drawn';
    document.getElementById('clzGrab').click();                       // enable grabber
    var cv=document.getElementById('cv'), r=cv.getBoundingClientRect(), z=(window.ZOOM||1);
    var d=window.drawnNamed.reduce(function(b,x){return Math.abs(x.sx-750)<Math.abs(b.sx-750)?x:b;});
    var cx=r.left+(d.sx*z)*(r.width/cv.width), cy=r.top+((d.y-3)*z)*(r.height/cv.height);
    function pe(t,X,Y){ return new PointerEvent(t,{clientX:X,clientY:Y,bubbles:true,pointerId:1}); }
    window.dispatchEvent(pe('pointerdown',cx,cy));                    // grab
    var grabbed = !!document.body.classList.contains('clz-grabbing');
    window.dispatchEvent(pe('pointermove',cx,60));                   // drag up into the sky
    window.dispatchEvent(pe('pointerup',cx,60));                     // drop from height
    return 'grabber_on='+document.getElementById('clzGrab').classList.contains('on')+' grabbed='+grabbed+' fxCanvas='+!!document.getElementById('clzFx');
  })()`);
  console.log(res); app.quit(); }).catch(e=>{console.error(e);app.quit();});
