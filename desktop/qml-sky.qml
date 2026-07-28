import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
Item { id: root; width: 854; height: 480
  property var shots: [
    {n:"sky-0530", hour:5,  min:30, cloud:15},
    {n:"sky-0700", hour:7,  min:0,  cloud:15},
    {n:"sky-1300", hour:13, min:0,  cloud:80},
    {n:"sky-1930", hour:19, min:30, cloud:25},
    {n:"sky-2100", hour:21, min:0,  cloud:10},
    {n:"sky-0100", hour:1,  min:0,  cloud:5}
  ]
  property int idx: 0
  property int warm: 0
  property double t0: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/2db058e7-bff3-40ca-bb41-421151bb5164/scratchpad/sky"
  function arm(){
    var S=root.shots[root.idx], CYC=604800000, EPOCH=1783972450746;
    City.GROW_CYCLE=CYC; City.NOFETCH=true; City.FORCEEGG=null;
    City.FORCEBIOME='plains'; City.FORCEVARIANT=0;
    var d=new Date(EPOCH+44*CYC+Math.round(0.45*CYC)); d.setHours(S.hour,S.min,0,0);
    root.t0=d.getTime(); City.NOWOVR=City.CLOCK=root.t0;
    City.applyConfig({lat:41.5243,lon:-72.0759});
    City.setup('neon',{cw:854,ch:480,woff:776,ww:2269,pxk:3,zoom:1,taskbarWp:28,quality:'balanced',frameMs:125});
    City.FORCEAGE=0.55; City.weather.code=(S.cloud>60?3:0); City.weather.wind=7; City.weather.temp=64;
    City.weather.cloud=S.cloud;
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
