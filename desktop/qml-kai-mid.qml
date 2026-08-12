import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// KAIJU AS THE MIDDLE MONITOR SEES IT — DP-4, world 776..1629 (853 wp), ground zero pinned at
// 0.859 (world 1949) which is on the RIGHT screen. This is the "I am not seeing anything" case.
Item { id: root; width: 1706; height: 874
  property var shots: [
    { n:"mid-ap05", ms:  604800 }, { n:"mid-ap18", ms: 2177280 },
    { n:"mid-ap35", ms: 4233600 }, { n:"mid-ap60", ms: 7257600 },
    { n:"mid-ap90", ms:10886400 }
  ]
  property int idx: 0
  property int warm: 0
  property double t0: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/d3b9beca-75da-4f23-9225-15e6520ed396/scratchpad/kai"
  function arm(){
    var S=root.shots[root.idx], CYC=604800000, EPOCH=1783972450746;
    City.GROW_CYCLE=CYC; City.NOFETCH=true;
    City.FORCEBIOME=null; City.FORCEVARIANT=null; City.FORCEEGG="core";
    City.FORCEDIS=null; City.FORCEDEATH="kaiju";
    City.CFG_APOC_EPI=0.859;
    City.FORCEAPOCMS=S.ms;
    var d=new Date(EPOCH+44*CYC+Math.round(0.90*CYC)); d.setHours(8,1,0,0);
    root.t0=d.getTime(); City.NOWOVR=City.CLOCK=root.t0;
    City.setup('city',{cw:1706,ch:874,woff:776,ww:2269,pxk:2,zoom:2,taskbarWp:22,quality:'balanced',frameMs:125});
    City.FORCEAGE=1.0;
    City.weather.code=3; City.weather.wind=8; City.weather.temp=73; City.weather.cloud=60;
  }
  Canvas { id: bg; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"bg"); } }
  Canvas { id: live; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"live"); } }
  Timer { interval:400; running:true; repeat:true
    onTriggered:{ if(root.idx>=root.shots.length){ Qt.quit(); return; }
      if(root.warm===0) root.arm();
      bg.requestPaint(); live.requestPaint();
      if(root.warm<1){ root.warm++; return; }
      root.grabToImage(function(r){ r.saveToFile(root.outDir+"/"+root.shots[root.idx].n+".png"); root.idx++; root.warm=0; }); } }
}
