import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// THE BASALT COAST at Nick's exact reported state: life 354, age 0.819, middle monitor.
Item { id: root; width: 854; height: 480
  property int warm: 0
  property bool done: false
  property double t0: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/2db058e7-bff3-40ca-bb41-421151bb5164/scratchpad"
  function arm(){
    City.GROW_CYCLE=604800000; City.NOFETCH=true; City.FORCEEGG=null;
    City.FORCEBIOME='cliffs'; City.FORCEVARIANT=2;
    var d=new Date(1783972450746+354*604800000+Math.round(0.82*604800000)); d.setHours(15,0,0,0);
    root.t0=d.getTime(); City.NOWOVR=City.CLOCK=root.t0;
    City.applyConfig({lat:41.5243,lon:-72.0759});
    City.setup('neon',{cw:854,ch:480,woff:776,ww:2269,pxk:3,zoom:1,taskbarWp:28,quality:'balanced',frameMs:125});
    City.FORCEAGE=0.819; City.weather.code=0; City.weather.wind=8; City.weather.temp=60;
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
      root.grabToImage(function(r){ r.saveToFile(root.outDir+"/basalt-after.png"); root.done=true; }); } }
}
