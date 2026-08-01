import QtQuick
import "../org.citylive.wallpaper/contents/js/city.js" as City

// THE ANIMAL SPRITE, ALONE, AT SIZE — every species x every pose on a flat background.
// ⚠ WHY THIS EXISTS. drawBeast is called at eight world px in the far rank and at ninety-three in the
// foreground pass, and reading either one out of a composited city frame is guesswork: the first
// foreground elephant looked like a black lozenge and it took three renders to work out that it was
// drawing perfectly and RESTING. A sprite that has to survive a twelve-fold size range needs a sheet.
// `qml6 qml-beast-sheet.qml -- out=/some/dir scale=6`
Item {
    id: root
    width: 1900; height: 1180
    function arg(k, d) { var a=Qt.application.arguments;
        for (var i=0;i<a.length;i++) if (a[i].indexOf(k+"=")===0) return a[i].substring(k.length+1); return d; }
    property string outDir: arg("out","/tmp")
    property double bh: parseFloat(arg("bh","46"))       // barrel height in world px: the foreground size
    property bool ready: false
    property string err: ""

    function prime() {
        City.NOFETCH = true;
        City.applyConfig({ land:"savanna" });
        City.NOWOVR = City.CLOCK = 1783972450746;
        City.setup('neon', { cw:1900, ch:1180, woff:0, ww:2269, pxk:3, zoom:1,
                             taskbarWp:0, quality:'balanced', frameMs:125 });
        City.FORCEAGE = 0.5;
        ready = true;
    }
    Canvas {
        anchors.fill: parent
        renderTarget: Canvas.Image; renderStrategy: Canvas.Immediate; antialiasing: false
        onPaint: {
            if (!root.ready) return;
            var g = getContext("2d");
            try {
                g.fillStyle = "#cfd8e0"; g.fillRect(0,0,root.width,root.height);
                var species = ["elephant","giraffe","zebra","wildebeest"];
                var poses   = ["graze","walk","drink","rest","alert","run"];
                var H = root.bh;
                g.font = "13px monospace";
                for (var si=0; si<species.length; si++) {
                    var sp = City.FAUNA[species[si]];
                    // the SAME sizing rule the foreground pass uses — a sheet that sizes its own way
                    // is a sheet that agrees with nothing
                    var BS = City.beastSize(sp, H * (sp.neck ? 1.0 : 0.74));
                    var h = BS.h, w = BS.w;
                    var rowY = 150 + si*250;
                    g.fillStyle = "#20262c";
                    g.fillText(species[si] + "  w="+w+" h="+h, 12, rowY-h-40);
                    for (var pi=0; pi<poses.length; pi++) {
                        var cx = 150 + pi*290;
                        g.fillStyle = "#20262c";
                        g.fillText(poses[pi], cx, rowY+26);
                        g.strokeStyle = "#8a97a2"; g.beginPath();
                        g.moveTo(cx-30, rowY+0.5); g.lineTo(cx+w+40, rowY+0.5); g.stroke();
                        // a 7px person, which is the scale everything on this land is judged against
                        City.drawPerson(g, cx-22, rowY, "#3a3a44", "#c89a6a", -1, 0);
                        City.drawBeast(g, cx, rowY, w, h, sp, pi, (pi%2)?1:-1,
                                       pi*1.3, [30,28,30], [18,17,19], Math.max(1,h/sp.h), 0);
                    }
                }
            } catch (e) { root.err = "THREW: " + e + " | " + (e.stack||"").split("\n").slice(0,4).join(" << "); }
        }
    }
    Text { anchors.left: parent.left; anchors.top: parent.top; width: parent.width; wrapMode: Text.Wrap
           visible: root.err !== ""; color: "#ff2020"; font.pixelSize: 12; font.family: "monospace"; text: root.err }
    Component.onCompleted: prime()
    Timer { interval: 400; running: true; repeat: false
        onTriggered: root.grabToImage(function(res){ res.saveToFile(root.outDir + "/beasts.png"); Qt.quit(); }) }
}
