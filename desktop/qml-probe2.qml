import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
Item { id: root; width: 1100; height: 260
  property string outp: "/tmp/claude-1000/-home-deluxescout/d3b9beca-75da-4f23-9225-15e6520ed396/scratchpad/probe2.png"
  Canvas { id: c; anchors.fill: parent; renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate
    onPaint: {
      var g = getContext("2d");
      g.fillStyle = "#ff00ff"; g.fillRect(0,0,width,height);          // MAGENTA = this canvas painted at all
      g.font = "16px monospace";
      var stage = "start";
      try {
        stage = "typeof-setup:" + (typeof City.setup);
        City.GROW_CYCLE = 604800000; City.NOFETCH = true;
        City.FORCEEGG = "core"; City.FORCEDEATH = "kaijuwar"; City.CFG_APOC_EPI = 0.53;
        City.FORCEAPOCMS = 4200000; City.NOWOVR = City.CLOCK = 1786000000000;
        stage = "setup";
        City.setup('city',{cw:600,ch:260,woff:776,ww:2269,pxk:2,zoom:2,taskbarWp:22,quality:'balanced',frameMs:125});
        stage = "draw";
        City.draw(g, "live");
        g.fillStyle = "#00ff00"; g.fillRect(0,0,60,60);               // GREEN = it all ran
      } catch(e) {
        g.fillStyle = "#ffffff"; g.fillRect(0,0,width,120);
        g.fillStyle = "#000000";
        g.fillText("STAGE: " + stage, 8, 24);
        g.fillText("ERR: " + String(e), 8, 48);
        g.fillText("LINE: " + (e && e.lineNumber), 8, 72);
        g.fillText("STACK: " + String(e && e.stack).substring(0,120), 8, 96);
      }
    } }
  Timer { interval: 700; running: true; repeat: false
    onTriggered: { root.grabToImage(function(r){ r.saveToFile(root.outp); Qt.quit(); }); } }
}
