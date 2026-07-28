import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
Item { id: root; width: 854; height: 480
  property var shots: [{n:"trees-alpine",v:0,wind:6},{n:"trees-dolo",v:1,wind:6},{n:"trees-wind",v:0,wind:30}]
  property int idx: 0
  property int warm: 0
  property double t0: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/2db058e7-bff3-40ca-bb41-421151bb5164/scratchpad"
  function arm(){
    var S=root.shots[root.idx];
    City.GROW_CYCLE=3600000; City.NOFETCH=true; City.FORCEEGG=null;
    City.applyConfig({lat:41.5243,lon:-72.0759, land:"alpine", landVariant:S.v});
    var d=new Date(1783972450746+360*3600000+Math.round(0.35*3600000)); d.setHours(13,0,0,0);
    root.t0=d.getTime(); City.NOWOVR=City.CLOCK=root.t0;
    City.setup('neon',{cw:854,ch:480,woff:776,ww:2269,pxk:3,zoom:1,taskbarWp:28,quality:'balanced',frameMs:125});
    City.FORCEAGE=0.30; City.weather.code=0; City.weather.wind=S.wind; City.weather.temp=40;
  }
  Canvas { id: bg; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"bg"); } }
  Canvas { id: live; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"live"); } }
  Timer { interval:340; running:true; repeat:true
    onTriggered:{ if(root.idx>=root.shots.length){Qt.quit();return}
      if(root.warm===0) root.arm();
      bg.requestPaint(); live.requestPaint();
      if(root.warm<1){root.warm++;return}
      root.grabToImage(function(r){ r.saveToFile(root.outDir+"/"+root.shots[root.idx].n+".png"); root.idx++; root.warm=0; }); } }
}
