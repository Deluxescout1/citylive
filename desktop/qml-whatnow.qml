import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
Item { id: root; width: 1100; height: 300
  property string outp: "/tmp/claude-1000/-home-deluxescout/d3b9beca-75da-4f23-9225-15e6520ed396/scratchpad/whatnow.png"
  Canvas { anchors.fill: parent; renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate
    onPaint: {
      var g=getContext("2d");
      g.fillStyle="#101018"; g.fillRect(0,0,width,height);
      g.font="17px monospace"; g.fillStyle="#e0e0e0";
      var y=26;
      function P(s){ g.fillText(s,10,y); y+=22; }
      try {
        City.NOFETCH=true; City.GROW_CYCLE=604800000;      // his cycle: 1w
        City.FORCEBIOME=null; City.FORCEEGG=null; City.FORCEDEATH=null; City.FORCEAPOCMS=null;
        City.NOWOVR=null; City.CLOCK=null;                  // REAL clock — whatever is on his screen now
        City.CFG_LAND="forest";                             // pinned, as installed
        City.setup('city',{cw:1552,ch:874,woff:0,ww:2269,pxk:2,zoom:2,taskbarWp:22,quality:'balanced',frameMs:83});
        City.draw(g,"live");
        g.fillStyle="#101018"; g.fillRect(0,0,width,height);
        g.fillStyle="#8fe08f"; g.fillText("CityLive — what is on screen right now",10,y); y+=30;
        g.fillStyle="#e0e0e0";
        P("phase      : "+City.cityPhase);
        P("cityApoc   : "+(City.cityApoc!=null?City.cityApoc.toFixed(4):"-"));
        P("curDeath   : "+City.curDeath);
        P("death name : "+((City.DEATH_NAME&&City.DEATH_NAME[City.curDeath])||"(unnamed)"));
        P("land       : "+(City.curBiome?City.curBiome.k:"-")+"   life growth: "+(City.cityG!=null?City.cityG.toFixed(3):"-"));
        P("disaster   : "+(City.curDis?(City.curDis.type+"  phase="+(City.curDis.phase||"-")):"none"));
        P("variant    : "+((City.curVariant&&City.curVariant.name)||"(base)"));
      } catch(e){ g.fillStyle="#ff8080"; P("ERR: "+String(e)); }
    } }
  Timer { interval:800; running:true; repeat:false
    onTriggered:{ root.grabToImage(function(r){ r.saveToFile(root.outp); Qt.quit(); }); } }
}
