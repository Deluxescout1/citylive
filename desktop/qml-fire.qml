import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// A real building fire, at exact instants found in node. Building is at world x 1878 w 32.
Item { id: root; width: 854; height: 480
  property var ts: [1810863830000, 1810863853000, 1810863871000, 1810863898000]
  property int idx: 0
  property int warm: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/2db058e7-bff3-40ca-bb41-421151bb5164/scratchpad/fire"
  function arm(){
    City.GROW_CYCLE=604800000; City.NOFETCH=true; City.FORCEEGG=null;
    City.FORCEBIOME='plains'; City.FORCEVARIANT=0;
    City.NOWOVR=City.CLOCK=root.ts[root.idx];
    City.applyConfig({lat:41.5243,lon:-72.0759});
    City.setup('neon',{cw:854,ch:480,woff:1600,ww:2269,pxk:3,zoom:1,taskbarWp:28,quality:'balanced',frameMs:125});
    City.FORCEAGE=0.72; City.weather.code=0; City.weather.wind=9; City.weather.temp=64;
  }
  Canvas { id: bg; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.ts[root.idx]; City.draw(getContext("2d"),"bg"); } }
  Canvas { id: live; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.ts[root.idx]; City.draw(getContext("2d"),"live"); } }
  Timer { interval:340; running:true; repeat:true
    onTriggered:{ if(root.idx>=root.ts.length){Qt.quit();return}
      if(root.warm===0) root.arm();
      bg.requestPaint(); live.requestPaint();
      if(root.warm<1){root.warm++;return}
      root.grabToImage(function(r){ r.saveToFile(root.outDir+"/fire-"+root.idx+".png"); root.idx++; root.warm=0; }); } }
}
