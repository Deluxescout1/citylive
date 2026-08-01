import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// THE STREET, TALKING. Six frames a few seconds apart at Nick's real primary geometry — the only way to
// judge how busy the dialogue reads and whether a line is up long enough to finish. The scene share is
// a number you pick by LOOKING, not by reasoning about it.
Item { id:root; width:4656; height:2622
  property double t0: 0
  property int idx: 0
  property var offs: [0,2500,5000,9000,14000,21000]
  property string outDir: "/tmp/claude-1000/-home-deluxescout/8de37de8-4cf3-412e-84f7-1fab9e690f3e/scratchpad/talk"
  function prime(){
    var CYC=604800000, EPOCH=1783972450746;
    City.GROW_CYCLE=CYC; City.NOFETCH=true; City.FORCEEGG=null; City.FORCEDIS=null;
    City.applyConfig({land:"alpine"});
    var d=new Date(EPOCH+62*CYC+Math.round(0.30*CYC)); d.setHours(11,25,0,0);
    root.t0=d.getTime(); City.NOWOVR=City.CLOCK=root.t0;
    City.setup('neon',{cw:4656,ch:2622,woff:0,ww:2269,pxk:3,zoom:6,taskbarWp:17,quality:'balanced',frameMs:125});
    City.FORCEAGE=0.86; City.FORCEWX={code:0,cloud:10,wind:6,temp:64,feels:64,precip:0,gust:6};
  }
  Canvas { id:bgcv; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ try{ City.draw(getContext("2d"),"bg"); }catch(e){ console.log("BG "+e); } } }
  Canvas { id:cv; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ try{ City.draw(getContext("2d"),"live"); }catch(e){ console.log("LIVE "+e); } } }
  Timer { interval:400; running:true; repeat:true
    onTriggered:{
      if(root.t0===0){ root.prime(); return; }
      if(root.idx>=root.offs.length){ Qt.quit(); return; }
      City.NOWOVR=City.CLOCK=root.t0+root.offs[root.idx];
      bgcv.requestPaint(); cv.requestPaint();
      var n=root.idx; root.idx++;
      root.grabToImage(function(r){ r.saveToFile(root.outDir+"/t"+n+".png"); });
    } }
}
