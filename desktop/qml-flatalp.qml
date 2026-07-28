import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// Previously-FLAT alpine lives (mts was null): do they now read as open country with relief?
Item { id: root; width:1552; height:874
  property var lives: [44, 3, 22]
  property int idx: 0
  property int warm: 0
  property double t0: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/2db058e7-bff3-40ca-bb41-421151bb5164/scratchpad"
  function arm(){
    var CYC=604800000,EPOCH=1783972450746;
    City.GROW_CYCLE=CYC; City.NOFETCH=true; City.FORCEEGG=null;
    City.FORCEBIOME='alpine'; City.FORCEVARIANT=0;
    var d=new Date(EPOCH+root.lives[root.idx]*CYC+Math.round(0.45*CYC)); d.setHours(13,0,0,0);
    root.t0=d.getTime(); City.NOWOVR=City.CLOCK=root.t0;
    City.applyConfig({lat:41.5243,lon:-72.0759});
    City.setup('neon',{cw:1552,ch:874,woff:0,ww:2269,pxk:3,zoom:2,taskbarWp:17,quality:'balanced',frameMs:125});
    City.FORCEAGE=0.72; City.weather.code=0; City.weather.wind=8; City.weather.temp=64;
  }
  Canvas { id: bg; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"bg"); } }
  Canvas { id: live; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"live"); } }
  Timer { interval:320; running:true; repeat:true
    onTriggered:{ if(root.idx>=root.lives.length){Qt.quit();return}
      if(root.warm===0) root.arm();
      bg.requestPaint(); live.requestPaint();
      if(root.warm<1){root.warm++;return}
      root.grabToImage(function(r){ r.saveToFile(root.outDir+"/flatalp-"+root.lives[root.idx]+".png"); root.idx++; root.warm=0; }); } }
}
