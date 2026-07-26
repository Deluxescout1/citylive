import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// ALPINE, LOOKED AT. Full world at Nick's real world width, under the conditions that actually
// change what the mountain does: wind (spindrift), cloud (banner cloud), and night.
Item { id: root; width: 2269; height: 437
  property var shots: [
    { n:"plains-hot",  wind:7,  cloud:45, hour:15 },
    { n:"plains-storm", wind:22, cloud:85, hour:16 },
    { n:"plains-cool", wind:6,  cloud:15, hour:11 }
  ]
  property int idx: 0
  property int warm: 0
  property double t0: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/48f22420-cb8d-47ef-8c39-d5207bc423d6/scratchpad/plains"
  function arm(){
    var S=root.shots[root.idx], CYC=604800000, EPOCH=1783972450746;
    City.GROW_CYCLE=CYC; City.NOFETCH=true; City.FORCEEGG=null;
    City.FORCEBIOME='plains'; City.FORCEVARIANT=0;          // pin the BASE look, the one that was null
    var d=new Date(EPOCH+7*CYC+Math.round(0.45*CYC)); d.setHours(S.hour,0,0,0);
    root.t0=d.getTime(); City.NOWOVR=City.CLOCK=root.t0;
    City.applyConfig({lat:41.5243, lon:-72.0759});
    City.setup('neon',{cw:2269,ch:437,woff:0,ww:2269,pxk:3,zoom:1,taskbarWp:0,quality:'balanced',frameMs:125});
    City.FORCEAGE=0.85;
    City.weather.code=(S.n==='plains-storm'?95:0); City.weather.wind=S.wind; City.weather.temp=(S.n==='plains-hot'?98:S.n==='plains-storm'?70:74); City.weather.cloud=S.cloud;
  }
  Canvas { id: bg; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"bg"); } }
  Canvas { id: live; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"live"); } }
  Timer { interval:350; running:true; repeat:true
    onTriggered:{ if(root.idx>=root.shots.length){ Qt.quit(); return; }
      if(root.warm===0) root.arm();
      bg.requestPaint(); live.requestPaint();
      if(root.warm<1){ root.warm++; return; }
      root.grabToImage(function(r){ r.saveToFile(root.outDir+"/"+root.shots[root.idx].n+".png"); root.idx++; root.warm=0; }); } }
}
