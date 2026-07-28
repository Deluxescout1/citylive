import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// The savanna across a DAY and across HUNT BLOCKS — the point is that the animals are doing different
// things at different hours, and that a hunt/kill/carcass appears and clears.
Item { id: root; width: 854; height: 480
  property var shots: [
    {n:"wild-dawn",  hour:6,  blk:0.20},
    {n:"wild-noon",  hour:13, blk:0.20},
    {n:"wild-dusk",  hour:19, blk:0.50},
    {n:"wild-night", hour:23, blk:0.55},
    {n:"wild-kill",  hour:23, blk:0.90}
  ]
  property int idx: 0
  property int warm: 0
  property double t0: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/2db058e7-bff3-40ca-bb41-421151bb5164/scratchpad/wild"
  function arm(){
    var S=root.shots[root.idx], CYC=604800000, EPOCH=1783972450746;
    City.GROW_CYCLE=CYC; City.NOFETCH=true; City.FORCEEGG=null;
    City.FORCEBIOME='savanna'; City.FORCEVARIANT=2;
    var d=new Date(EPOCH+44*CYC+Math.round(0.45*CYC)); d.setHours(S.hour,0,0,0);
    var base=d.getTime();
    root.t0 = base - (base % 26000) + Math.round(S.blk*26000);
    City.NOWOVR=City.CLOCK=root.t0;
    City.applyConfig({lat:41.5243,lon:-72.0759});
    City.setup('neon',{cw:854,ch:480,woff:776,ww:2269,pxk:3,zoom:1,taskbarWp:28,quality:'balanced',frameMs:125});
    City.FORCEAGE=0.40; City.weather.code=0; City.weather.wind=8; City.weather.temp=88;
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
