import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City
// One full 12 s signal cycle at one crossing on the middle screen: does a queue GATHER, cross, and clear?
Item {
    id: root
    width: 854; height: 480
    property int idx: 0
    property var stamps: [0,1000,2000,3000,4000,5000,6000,7000,8000,9000,9600,10200,10800,11400]
    Canvas {
        id: cv; anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        onPaint: {
            if (root.idx >= root.stamps.length) return;   // the timer fires once more after the last grab
            var g=getContext("2d"), CYC=604800000, EPOCH=1783972450746;
            City.GROW_CYCLE=CYC; City.NOFETCH=true;
            City.FORCEBIOME="sprawl"; City.FORCEVARIANT=0;
            var d=new Date(EPOCH+76*CYC+Math.round(0.31*CYC)); d.setHours(13,10,0,0);
            City.NOWOVR=City.CLOCK=d.getTime();
            City.setup('city',{cw:854,ch:480,woff:776,ww:2269,pxk:3,zoom:1,taskbarWp:28,quality:'balanced',frameMs:125});
            City.FORCEAGE=0.85; City.weather.code=0; City.weather.wind=6; City.weather.temp=62; City.weather.cloud=20;
            City.NOWOVR=City.CLOCK=d.getTime()+root.stamps[root.idx];
            City.draw(g,"bg"); City.draw(g,"live");
        }
    }
    Timer { interval:250; running:true; repeat:true
        onTriggered: {
            if(root.idx>=root.stamps.length){Qt.quit();return;}
            cv.requestPaint();
            cv.grabToImage(function(res){
                res.saveToFile(root.outDir+"/cyc-"+(1000+root.stamps[root.idx])+".png"); root.idx++; });
        } }
    property string outDir: "/tmp/claude-1000/-home-deluxescout/dcbadfcb-7fc7-43ae-866e-fdd216f8e15d/scratchpad"
}
