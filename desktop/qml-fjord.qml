import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
Item { id: root; width: 854; height: 480
  property var shots: [
    {n:"fjord-v0",  v:0, wind:8,  hour:13, fr:0.6},
    {n:"fjord-v1",  v:1, wind:8,  hour:13, fr:0.6},
    {n:"fjord-v2",  v:2, wind:8,  hour:13, fr:0.6},
    {n:"fjord-haboob", v:0, wind:34, hour:13, fr:0.16},
    {n:"fjord-dusk", v:0, wind:8, hour:19, fr:0.6}
  ]
  property int idx: 0
  property int warm: 0
  property double t0: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/2db058e7-bff3-40ca-bb41-421151bb5164/scratchpad/fjord"
  function arm(){
    var S=root.shots[root.idx], CYC=604800000, EPOCH=1783972450746;
    City.GROW_CYCLE=CYC; City.NOFETCH=true; City.FORCEEGG=null;
    City.FORCEBIOME='fjord'; City.FORCEVARIANT=S.v;
    var d=new Date(EPOCH+44*CYC+Math.round(0.45*CYC)); d.setHours(S.hour,0,0,0);
    var base=d.getTime();
    root.t0 = base - (base % 900000) + Math.round(S.fr*900000);
    City.NOWOVR=City.CLOCK=root.t0;
    City.applyConfig({lat:41.5243,lon:-72.0759});
    City.setup('neon',{cw:854,ch:480,woff:776,ww:2269,pxk:3,zoom:1,taskbarWp:28,quality:'balanced',frameMs:125});
    City.FORCEAGE=0.72; City.weather.code=0; City.weather.wind=S.wind; City.weather.temp=46;
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
