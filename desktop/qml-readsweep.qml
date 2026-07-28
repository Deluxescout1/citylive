import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// THE READABILITY SWEEP — all 27 looks at Nick's REAL primary geometry, full frame.
// ⚠ He chose "full frame only": a crop judges DETAIL, only the full frame judges SIZE.
Item { id: root; width: 1552; height: 874
  property var lands: ["alpine","forest","mesa","cliffs","plains","beach","swamp","volcano","arctic","sprawl","hell","heaven","dunes","karst","fjord","salt","terrace","under","savanna","canyon"]
  property var eggs:  ["leaf","core","fire","air","falls","orbit","plateau"]
  property int idx: 0
  property int warm: 0
  property double t0: 0
  property string outDir: "/tmp/claude-1000/-home-deluxescout/2db058e7-bff3-40ca-bb41-421151bb5164/scratchpad/read"
  function arm(){
    var CYC=604800000, EPOCH=1783972450746;
    City.GROW_CYCLE=CYC; City.NOFETCH=true;
    if(root.idx<root.lands.length){ City.FORCEEGG=null; City.FORCEBIOME=root.lands[root.idx]; City.FORCEVARIANT=0; }
    else { City.FORCEBIOME=null; City.FORCEVARIANT=null; City.FORCEEGG=root.eggs[root.idx-root.lands.length]; }
    var d=new Date(EPOCH+44*CYC+Math.round(0.45*CYC)); d.setHours(14,0,0,0);
    root.t0=d.getTime(); City.NOWOVR=City.CLOCK=root.t0;
    City.applyConfig({lat:41.5243,lon:-72.0759});
    City.setup('neon',{cw:1552,ch:874,woff:0,ww:2269,pxk:3,zoom:2,taskbarWp:17,quality:'balanced',frameMs:125});
    City.FORCEAGE=0.66; City.weather.code=0; City.weather.wind=8; City.weather.temp=64; City.weather.cloud=30;
  }
  Canvas { id: bg; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"bg"); } }
  Canvas { id: live; anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate; antialiasing:false
    onPaint:{ City.NOWOVR=City.CLOCK=root.t0; City.draw(getContext("2d"),"live"); } }
  Timer { interval:300; running:true; repeat:true
    onTriggered:{
      var tot=root.lands.length+root.eggs.length;
      if(root.idx>=tot){ Qt.quit(); return }
      if(root.warm===0) root.arm();
      bg.requestPaint(); live.requestPaint();
      if(root.warm<1){ root.warm++; return }
      var nm=(root.idx<root.lands.length?root.lands[root.idx]:"egg-"+root.eggs[root.idx-root.lands.length]);
      var nn=(root.idx<10?"0":"")+root.idx;
      root.grabToImage(function(r){ r.saveToFile(root.outDir+"/"+nn+"-"+nm+".png"); root.idx++; root.warm=0; }); } }
}
