import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// THE GORGE on ALL THREE of Nick's real monitors, same instant.
// This is the whole point: a wall pinned to the world's ends would leave the MIDDLE screen with no
// canyon at all — the sea-cliffs bug. Geometry straight out of plasmashell's log + the debug stamp.
Item { id: root; width: 1552; height: 874
  property var screens: [
    { n:"gorge-1-primary", cw:1552, ch:874, woff:0,    zoom:2, tb:17 },
    { n:"gorge-2-middle",  cw:854,  ch:480, woff:776,  zoom:1, tb:28 },
    { n:"gorge-3-right",   cw:640,  ch:360, woff:1629, zoom:1, tb:28 }
  ]
  property int vi: 0
  property int idx: 0
  property int warm: 0
  property double t0: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/2db058e7-bff3-40ca-bb41-421151bb5164/scratchpad/gorge"
  function arm(){
    var S=root.screens[root.idx], CYC=604800000, EPOCH=1783972450746;
    City.GROW_CYCLE=CYC; City.NOFETCH=true; City.FORCEEGG=null;
    City.FORCEBIOME='canyon'; City.FORCEVARIANT=root.vi;
    var d=new Date(EPOCH+44*CYC+Math.round(0.45*CYC)); d.setHours(13,0,0,0);
    root.t0=d.getTime(); City.NOWOVR=City.CLOCK=root.t0;
    City.applyConfig({lat:41.5243,lon:-72.0759});
    root.width=S.cw; root.height=S.ch;
    City.setup('neon',{cw:S.cw,ch:S.ch,woff:S.woff,ww:2269,pxk:3,zoom:S.zoom,taskbarWp:S.tb,quality:'balanced',frameMs:125});
    City.FORCEAGE=0.72; City.weather.code=0; City.weather.wind=8; City.weather.temp=64;
  }
  Canvas { id: bg; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"bg"); } }
  Canvas { id: live; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"live"); } }
  Timer { interval:340; running:true; repeat:true
    onTriggered:{
      if(root.idx>=root.screens.length){ root.idx=0; root.vi++; if(root.vi>4){ Qt.quit(); return } }
      if(root.warm===0) root.arm();
      bg.requestPaint(); live.requestPaint();
      if(root.warm<1){ root.warm++; return }
      var nm=root.screens[root.idx].n+"-v"+root.vi;
      root.grabToImage(function(r){ r.saveToFile(root.outDir+"/"+nm+".png"); root.idx++; root.warm=0; }); } }
}
