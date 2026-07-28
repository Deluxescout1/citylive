import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// SPACE CITY through one 90-minute plateau — the point of the land is that its clock is the ORBIT.
Item { id: root; width: 854; height: 480
  property var fr: [0.05, 0.28, 0.52, 0.78]
  property int idx: 0
  property int warm: 0
  property double t0: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/2db058e7-bff3-40ca-bb41-421151bb5164/scratchpad/plateau"
  function arm(){
    var CYC=604800000, EPOCH=1783972450746;
    City.GROW_CYCLE=CYC; City.NOFETCH=true;
    City.FORCEBIOME=null; City.FORCEVARIANT=null; City.FORCEEGG='plateau';
    var d=new Date(EPOCH+44*CYC+Math.round(0.45*CYC)); d.setHours(13,0,0,0);
    var base=d.getTime();
    root.t0 = base - (base % 86400000) + Math.round(root.fr[root.idx]*86400000);
    City.NOWOVR=City.CLOCK=root.t0;
    City.applyConfig({lat:41.5243,lon:-72.0759});
    City.setup('neon',{cw:854,ch:480,woff:776,ww:2269,pxk:3,zoom:1,taskbarWp:28,quality:'balanced',frameMs:125});
    City.FORCEAGE=0.72; City.weather.code=0; City.weather.wind=8; City.weather.temp=60;
  }
  Canvas { id: bg; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"bg"); } }
  Canvas { id: live; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"live"); } }
  Timer { interval:340; running:true; repeat:true
    onTriggered:{ if(root.idx>=root.fr.length){Qt.quit();return}
      if(root.warm===0) root.arm();
      bg.requestPaint(); live.requestPaint();
      if(root.warm<1){root.warm++;return}
      root.grabToImage(function(r){ r.saveToFile(root.outDir+"/plateau-"+root.idx+".png"); root.idx++; root.warm=0; }); } }
}
