import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// THE DRY RANGE at Nick's state, middle monitor, walked until a GREENS mayor is in.
Item { id: root; width: 854; height: 480
  property int warm: 0
  property bool done: false
  property double t0: 0
  property int k: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/2db058e7-bff3-40ca-bb41-421151bb5164/scratchpad"
  function arm(){
    City.GROW_CYCLE=3600000; City.NOFETCH=true; City.FORCEEGG=null;
    City.applyConfig({lat:41.5243,lon:-72.0759, land:"alpine", landVariant:2});
    var base=new Date(1783972450746+358*3600000+Math.round(0.556*3600000)); base.setHours(14,0,0,0);
    root.t0=base.getTime()+root.k*400;
    City.NOWOVR=City.CLOCK=root.t0;
    City.setup('neon',{cw:854,ch:480,woff:776,ww:2269,pxk:3,zoom:1,taskbarWp:28,quality:'balanced',frameMs:125});
    City.FORCEAGE=0.556; City.weather.code=0; City.weather.wind=6; City.weather.temp=79;
  }
  Canvas { id: bg; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"bg"); } }
  Canvas { id: live; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"live"); } }
  Timer { interval:300; running:true; repeat:true
    onTriggered:{ if(root.done){Qt.quit();return}
      if(root.warm===0) root.arm();
      bg.requestPaint(); live.requestPaint();
      if(root.warm<1){root.warm++;return}
      if(City.curMayor && City.curMayor.party && City.curMayor.party.k==="GREENS"){
        root.grabToImage(function(r){ r.saveToFile(root.outDir+"/solar.png"); root.done=true; });
      } else { root.k++; root.warm=0; if(root.k>400){ root.done=true; } }
    } }
}
