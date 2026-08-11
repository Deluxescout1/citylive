import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as New
import "_old_city.js" as Old
// OLD vs NEW at the same ap, same clock, same seed. "It still looks the same" is a claim with an answer.
Item { id: root; width: 1552; height: 874
  property var shots: [
    { n:"ab-old-ap08", eng:0, ms: 967680 }, { n:"ab-new-ap08", eng:1, ms: 967680 },
    { n:"ab-old-ap28", eng:0, ms:3386880 }, { n:"ab-new-ap28", eng:1, ms:3386880 },
    { n:"ab-old-ap60", eng:0, ms:7257600 }, { n:"ab-new-ap60", eng:1, ms:7257600 }
  ]
  property int idx: 0
  property int warm: 0
  property double t0: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/1106ff86-ef56-4120-8223-b9e829f9817a/scratchpad/goo"
  function eng(){ return root.shots[root.idx].eng ? New : Old }
  function arm(){
    var S=root.shots[root.idx], CYC=604800000, EPOCH=1783972450746, C=eng();
    C.GROW_CYCLE=CYC; C.NOFETCH=true;
    C.FORCEBIOME=null; C.FORCEVARIANT=null; C.FORCEEGG="core";
    C.FORCEDIS=null; C.FORCEDEATH="greygoo";
    C.CFG_APOC_EPI=0.25; C.FORCEAPOCMS=S.ms;
    var d=new Date(EPOCH+44*CYC+Math.round(0.90*CYC)); d.setHours(8,1,0,0);
    root.t0=d.getTime(); C.NOWOVR=C.CLOCK=root.t0;
    C.setup('city',{cw:1552,ch:874,woff:0,ww:2269,pxk:2,zoom:2,taskbarWp:22,quality:'balanced',frameMs:125});
    C.FORCEAGE=1.0;
    C.weather.code=3; C.weather.wind=8; C.weather.temp=73; C.weather.cloud=60;
  }
  Canvas { id: bg; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ var C=root.eng(); C.NOWOVR=C.CLOCK=root.t0; C.draw(getContext("2d"),"bg"); } }
  Canvas { id: live; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ var C=root.eng(); C.NOWOVR=C.CLOCK=root.t0; C.draw(getContext("2d"),"live"); } }
  Timer { interval:400; running:true; repeat:true
    onTriggered:{ if(root.idx>=root.shots.length){ Qt.quit(); return; }
      if(root.warm===0) root.arm();
      bg.requestPaint(); live.requestPaint();
      if(root.warm<1){ root.warm++; return; }
      root.grabToImage(function(r){ r.saveToFile(root.outDir+"/"+root.shots[root.idx].n+".png"); root.idx++; root.warm=0; }); } }
}
