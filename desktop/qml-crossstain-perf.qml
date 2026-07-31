import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// WHAT DO THE ROAD STAINS COST? Interleaved in ONE process against the identical engine with them
// suppressed, because a cross-process A/B on this project once reported a real 18% win as a regression.
Item { width:1552; height:874
  Canvas { anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate
    property bool done:false
    onPaint:{ if(done) return; done=true;
      var g=getContext("2d"), CYC=604800000, EPOCH=1783972450746;
      City.GROW_CYCLE=CYC; City.NOFETCH=true; City.FORCEEGG=null; City.FORCEDIS=null;
      var tot={on:0,off:0}, cnt={on:0,off:0};
      function one(mode){
        City.NOCROSSSTAIN=(mode==="off");
        City.applyConfig({land:"alpine"});
        var d=new Date(EPOCH+62*CYC+Math.round(0.38*CYC)); d.setHours(13,10,0,0);
        var t0=d.getTime(); City.NOWOVR=City.CLOCK=t0;
        City.setup('city',{cw:1552,ch:874,woff:0,ww:2269,pxk:2,zoom:2,taskbarWp:28,quality:'balanced',frameMs:125});
        City.FORCEAGE=0.80; City.FORCEWX={code:0,cloud:10,wind:6,temp:64,feels:64,precip:0,gust:6};
        City.draw(g,"bg"); City.draw(g,"live");     // warm: the stain rings fill here, not in the timed loop
        var t=Date.now();
        for(var k=0;k<40;k++){ City.NOWOVR=City.CLOCK=t0+k*140; City.draw(g,"live"); }
        tot[mode]+=Date.now()-t; cnt[mode]+=40;
      }
      for(var r=0;r<4;r++){ one("on"); one("off"); one("off"); one("on"); }
      var on=tot.on/cnt.on, off=tot.off/cnt.off;
      console.log("CROSSSTAIN on="+on.toFixed(2)+"ms  off="+off.toFixed(2)+"ms  delta="+(on-off).toFixed(2)+"ms  ratio="+(on/off).toFixed(3));
      Qt.quit();
    }
    Component.onCompleted: requestPaint()
  }
}
