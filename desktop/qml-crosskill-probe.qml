import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// How many road deaths, and how many stains are ON SCREEN at once? Standing count = rate x lifetime,
// which is the number that decides whether the road reads as "an accident happened" or "solid red".
Item { width:1552; height:874
  Canvas { anchors.fill:parent; renderTarget:Canvas.Image; renderStrategy:Canvas.Immediate
    property bool done:false
    onPaint:{ if(done) return; done=true;
      var g=getContext("2d"), CYC=604800000, EPOCH=1783972450746;
      City.GROW_CYCLE=CYC; City.NOFETCH=true; City.FORCEEGG=null; City.FORCEDIS=null;
      City.applyConfig({land:"alpine"});
      var d=new Date(EPOCH+62*CYC+Math.round(0.38*CYC)); d.setHours(13,10,0,0);
      var t0=d.getTime();
      City.NOWOVR=City.CLOCK=t0;
      City.setup('city',{cw:1552,ch:874,woff:0,ww:2269,pxk:2,zoom:2,taskbarWp:28,quality:'balanced',frameMs:125});
      City.FORCEAGE=0.80; City.FORCEWX={code:0,cloud:10,wind:6,temp:64,feels:64,precip:0,gust:6};
      City.draw(g,"bg");
      City.draw(g,"live");            // one frame is enough to establish growPop / wmood / districtBusy
      var before=City.CROSSKILLS;
      // ⚠ NO NEED TO RUN 720 FRAMES: a death is a PURE FUNCTION of (crosswalk, cycle), so the whole
      // history can be asked for directly. That is the same property the three monitors rely on.
      var now=t0, back=Math.ceil(City.CROSS_STAIN_MS/12000);
      City.CROSS_BUDGET=99999;
      var live=0, all=0, byCar=0, byTram=0, went=0, stayed=0, nextT=1e18, nextX=0;
      for(var i=0;i<City.crosswalks.length;i++){ var cw=City.crosswalks[i];
        var cur=Math.floor((now+cw.ph)/12000);
        for(var c=cur-back;c<=cur+40;c++){ var ds=City.crossDeaths(cw,c);
          for(var q=0;q<ds.length;q++){ var D=ds[q];
            if(D.go) went++; else stayed++;
            if(!D.kill) continue;
            if(D.t>now && D.t<nextT){ nextT=D.t; nextX=D.wx; }
            var age=now-D.t; if(age<0||age>City.CROSS_STAIN_MS) continue;
            all++; if(D.by===2) byTram++; else byCar++;
            var X=D.wx-City.WOFF; if(X>=-30&&X<=City.SW+30) live++; } } }
      console.log("PROBE alive-world="+all+" on-screen="+live+"  byCar="+byCar+" byTram="+byTram);
      console.log("PROBE jaywalkers went="+went+" stayed-on-kerb="+stayed);
      console.log("PROBE next death at +"+Math.round((nextT-now)/1000)+"s  worldX="+Math.round(nextX));
      console.log("crosswalks="+City.crosswalks.length+" stainMin="+(City.CROSS_STAIN_MS/60000)+" look="+City.JAY_LOOK+" jayP="+City.JAY_P);
      Qt.quit();
    }
    Component.onCompleted: requestPaint()
  }
}
