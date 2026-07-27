import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// THE DEATH SCREEN, AT NICK'S REAL 4K GEOMETRY. Look at it. Do not reason about it.
Item { id: root; width: 1552; height: 874
  property var shots: [
    { n:"nuke-cy80", cy:0.800 }, { n:"nuke-cy84", cy:0.840 },
    { n:"nuke-cy90", cy:0.900 }, { n:"nuke-cy97", cy:0.970 }
  ]
  property int idx: 0
  property int warm: 0
  property double t0: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/48f22420-cb8d-47ef-8c39-d5207bc423d6/scratchpad/death"
  function arm(){
    var S=root.shots[root.idx], CYC=604800000, EPOCH=1783972450746;
    City.GROW_CYCLE=CYC; City.NOFETCH=true; City.FORCEEGG=null;
    City.FORCEBIOME='mesa'; City.FORCEVARIANT=0;      // the red palette from Nick's screenshot
    City.FORCEDEATH="nuke";
    var d=new Date(EPOCH+25*CYC+Math.round(S.cy*CYC));
    root.t0=d.getTime(); City.NOWOVR=City.CLOCK=root.t0;
    City.applyConfig({lat:41.5243, lon:-72.0759});
    City.setup('neon',{cw:1552,ch:874,woff:0,ww:2269,pxk:3,zoom:2,taskbarWp:0,quality:'balanced',frameMs:125});
    City.weather.code=45; City.weather.wind=8; City.weather.temp=70; City.weather.cloud=20;
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
