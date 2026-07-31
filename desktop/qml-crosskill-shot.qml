import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// WATCHING ONE DEATH. Finds the next road death from the clock (it is a pure function, so it can be
// asked about the future) and renders the moments around it: the walk, the impact, the fresh pool and
// the dried mark. Proving the sequence is watchable is the whole point — the previous build's burst
// could never draw at all, and no still frame would have told me that.
Item { id:root; width:4656; height:2622
  property double t0: 0
  property double kt: 0
  property double kx: 0
  property var offs: [-700,60,260,4000,180000]
  property int idx: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/8de37de8-4cf3-412e-84f7-1fab9e690f3e/scratchpad/kill"
  function prime(){
    var CYC=604800000, EPOCH=1783972450746;
    City.GROW_CYCLE=CYC; City.NOFETCH=true; City.FORCEEGG=null; City.FORCEDIS=null;
    City.applyConfig({land:"alpine"});
    var d=new Date(EPOCH+62*CYC+Math.round(0.38*CYC)); d.setHours(13,10,0,0);
    root.t0=d.getTime(); City.NOWOVR=City.CLOCK=root.t0;
    City.setup('neon',{cw:4656,ch:2622,woff:0,ww:2269,pxk:3,zoom:6,taskbarWp:17,quality:'balanced',frameMs:125});
    City.FORCEAGE=0.80; City.FORCEWX={code:0,cloud:10,wind:6,temp:64,feels:64,precip:0,gust:6};
    City.draw(bgcv.getContext("2d"),"bg"); City.draw(cv.getContext("2d"),"live");
    City.CROSS_BUDGET=99999;
    var best=1e18, bx=0, back=Math.ceil(City.CROSS_STAIN_MS/12000);
    for(var i=0;i<City.crosswalks.length;i++){ var cw=City.crosswalks[i];
      var cur=Math.floor((root.t0+cw.ph)/12000);
      for(var c=cur;c<=cur+60;c++){ var ds=City.crossDeaths(cw,c);
        for(var q=0;q<ds.length;q++){ var D=ds[q]; if(!D.kill) continue;
          var X=D.wx-City.WOFF;
          if(D.t>root.t0 && D.t<best && X>40 && X<City.SW-40){ best=D.t; bx=D.wx; } } } }
    root.kt=best; root.kx=bx;
    console.log("SHOT death at +"+Math.round((best-root.t0)/1000)+"s worldX="+Math.round(bx));
  }
  Canvas { id:bgcv; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ try{ City.draw(getContext("2d"),"bg"); }catch(e){ console.log("BG "+e); } } }
  Canvas { id:cv; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ try{ City.draw(getContext("2d"),"live"); }catch(e){ console.log("LIVE "+e); } } }
  Timer { interval:380; running:true; repeat:true
    onTriggered:{
      if(root.t0===0){ root.prime(); return; }
      if(root.idx>=root.offs.length){ Qt.quit(); return; }
      City.NOWOVR=City.CLOCK=root.kt+root.offs[root.idx];
      bgcv.requestPaint(); cv.requestPaint();
      var n=root.idx; root.idx++;
      root.grabToImage(function(r){ r.saveToFile(root.outDir+"/k"+n+".png"); });
    } }
}
