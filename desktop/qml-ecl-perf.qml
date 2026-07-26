import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// V4 is much slower at trig-heavy JS than V8, and Nick's ceiling this session is ~50% of one core.
// Times the two costs the eclipse work introduced, on the REAL runtime: the per-frame cached lookup,
// and the once-per-day scan that runs INSIDE a paint.
Item { id: root; width: 640; height: 360
  property int n: 0
  Canvas { id: cv; anchors.fill: parent; renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate
    onPaint: {
      if (root.n > 0) return;
      var g = getContext("2d");
      City.NOFETCH = true;
      City.setup('neon', { cw:640, ch:360, woff:0, ww:2269, pxk:3, zoom:1, quality:'balanced', frameMs:125 });
      City.applyConfig({ lat:41.5243, lon:-72.0759 });
      var d = new Date(Date.UTC(2024,3,8,19,30,0)), t, i, out = [];

      t = Date.now(); for (i=0;i<200;i++) City.solarEclipseAt(new Date(d.getTime()+i*1000));
      out.push("solarEclipseAt (uncached): " + ((Date.now()-t)/200).toFixed(3) + " ms each");

      t = Date.now(); for (i=0;i<2000;i++) City.eclipseNow(d);
      out.push("eclipseNow (cache hit):    " + ((Date.now()-t)/2000).toFixed(4) + " ms each  <- the per-frame cost");

      // worst case: an eclipse day, cold, which is when the full 164-sample scan actually runs
      t = Date.now(); City._ecDay = {}; City.eclipseToday(d);
      out.push("eclipseToday COLD, eclipse day: " + (Date.now()-t) + " ms  <- once per day, inside a paint");

      t = Date.now(); City._ecDay = {}; City.eclipseToday(new Date(2024,5,15,12,0,0));
      out.push("eclipseToday COLD, ordinary day: " + (Date.now()-t) + " ms  <- the elongation pre-filter");

      // what astroDesk really costs on the first frame of a day: today + 5 days ahead
      t = Date.now(); City._ecDay = {};
      for (i=0;i<=5;i++) City.eclipseToday(new Date(d.getTime()+i*86400000));
      out.push("astroDesk first frame (6 days): " + (Date.now()-t) + " ms");

      for (i=0;i<out.length;i++) g.fillText(out[i], 4, 14+i*14);
      root.report = out.join("\n");
      root.n = 1;
    } }
  property string report: ""
  Timer { interval: 400; running: true; repeat: true
    onTriggered: { cv.requestPaint();
      if (root.n === 1) { cv.grabToImage(function(r){ r.saveToFile("/tmp/claude-1000/-home-deluxescout/48f22420-cb8d-47ef-8c39-d5207bc423d6/scratchpad/eclperf.png"); Qt.quit(); }); } } }
}
