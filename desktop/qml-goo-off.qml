import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// GROUND ZERO ON ANOTHER MONITOR — the common case. Plus the core world's own baseline, no apocalypse.
Item { id: root; width: 1552; height: 874
  property var shots: [
    { n:"core-baseline", ms:null,    epi:0.25  },
    { n:"goo-off-ap40",  ms:4838400, epi:0.859 },
    { n:"goo-off-ap70",  ms:8467200, epi:0.859 },
    { n:"goo-off-ap92",  ms:11128320,epi:0.859 }
  ]
  property int idx: 0
  property int warm: 0
  property double t0: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/1106ff86-ef56-4120-8223-b9e829f9817a/scratchpad/goo"
  function arm(){
    var S=root.shots[root.idx], CYC=604800000, EPOCH=1783972450746;
    City.GROW_CYCLE=CYC; City.NOFETCH=true;
    City.FORCEBIOME=null; City.FORCEVARIANT=null; City.FORCEEGG="core";
    City.FORCEDIS=null; City.FORCEDEATH=(S.ms===null)?null:"greygoo";
    City.CFG_APOC_EPI=S.epi; City.FORCEAPOCMS=S.ms;
    var d=new Date(EPOCH+44*CYC+Math.round(0.90*CYC)); d.setHours(8,1,0,0);
    root.t0=d.getTime(); City.NOWOVR=City.CLOCK=root.t0;
    City.setup('city',{cw:1552,ch:874,woff:0,ww:2269,pxk:2,zoom:2,taskbarWp:22,quality:'balanced',frameMs:125});
    City.FORCEAGE=(S.ms===null)?0.75:1.0;
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
