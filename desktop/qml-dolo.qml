import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// THE DOLOMITES at Nick's live state: life 356, age 0.587, primary screen.
Item { id: root; width: 1552; height: 874
  property int warm: 0
  property bool done: false
  property double t0: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/2db058e7-bff3-40ca-bb41-421151bb5164/scratchpad"
  function arm(){
    City.GROW_CYCLE=3600000; City.NOFETCH=true; City.FORCEEGG=null;
    City.applyConfig({lat:41.5243,lon:-72.0759, land:"alpine", landVariant:1});
    var d=new Date(1783972450746+356*3600000+Math.round(0.587*3600000)); d.setHours(14,0,0,0);
    root.t0=d.getTime(); City.NOWOVR=City.CLOCK=root.t0;
    City.setup('neon',{cw:1552,ch:874,woff:0,ww:2269,pxk:3,zoom:2,taskbarWp:17,quality:'balanced',frameMs:125});
    City.FORCEAGE=0.587; City.weather.code=0; City.weather.wind=7; City.weather.temp=52;
  }
  Canvas { id: bg; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"bg"); } }
  Canvas { id: live; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"live"); } }
  Timer { interval:340; running:true; repeat:true
    onTriggered:{ if(root.done){Qt.quit();return}
      if(root.warm===0) root.arm();
      bg.requestPaint(); live.requestPaint();
      if(root.warm<1){root.warm++;return}
      root.grabToImage(function(r){ r.saveToFile(root.outDir+"/dolo.png"); root.done=true; }); } }
}
