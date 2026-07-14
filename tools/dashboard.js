#!/usr/bin/env node
// CityLive DASHBOARD — a live vitals page for the current civilization
const fs=require("fs"), path=require("path"), os=require("os"), vm=require("vm");
const SRC=path.join(os.homedir(),".local/share/plasma/wallpapers/org.citylive.wallpaper/contents/js/city.js");
const sb={console}; vm.createContext(sb); vm.runInContext(fs.readFileSync(SRC,"utf8"),sb);
const noop=()=>{}; const fakeGrad={addColorStop:noop};
const g=new Proxy({},{get:(t,k)=>k.startsWith("create")?()=>fakeGrad:noop,set:()=>true});
const life=Math.floor((Date.now()-sb.GROW_EPOCH)/sb.GROW_CYCLE);
const t0=sb.GROW_EPOCH+life*sb.GROW_CYCLE, t1=t0+sb.GROW_CYCLE, nowT=Date.now();
sb.setup("neon",{cw:480,ch:270,woff:0,ww:1702,pxk:4});
// sample pop + econ across the life so far (and peek the schedule ahead)
const pts=[], epts=[], N=140;
for(let i=0;i<=N;i++){ const t=t0+(t1-t0)*i/N; if(t>nowT) break;
  sb.NOWOVR=t; try{sb.draw(g);}catch(e){}
  pts.push([i/N, sb.cityPop?sb.cityPop():0]); epts.push([i/N, sb.curEcon||0.5]); }
sb.NOWOVR=nowT; try{sb.draw(g);}catch(e){}
const F=sb.famInfo(nowT), M=sb.curMayor, name=sb.cityName, pop=sb.cityPop(), cg=sb.cityG;
const cy=(nowT-t0)/(t1-t0);
function svg(data,w,h,col,maxv){
  const mx=maxv||Math.max(...data.map(d=>d[1]),1);
  const p=data.map(d=>`${(d[0]*w).toFixed(1)},${(h-d[1]/mx*(h-4)-2).toFixed(1)}`).join(" ");
  return `<svg width="${w}" height="${h}" style="background:#141826;border-radius:6px"><polyline points="${p}" fill="none" stroke="${col}" stroke-width="2"/></svg>`;
}
const sched=[["City hall rises",0.52],["School opens",sb.schoolAt],["Museum opens",0.58],["First mega-tower",0.86],["Space age",0.80-((sb.EDUB||0))],["Endtimes",0.955]]
  .filter(x=>x[1]>cy*0.78).map(x=>`<li>${x[0]} — day ${(x[1]*0.78*7).toFixed(1)}</li>`).join("");
const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} — vitals</title><style>
body{background:#0c0f1a;color:#dfe6f4;font-family:monospace;margin:0;padding:18px;max-width:640px;margin:auto}
h1{color:#7af5ff;font-size:20px} .k{color:#8a93a8} .v{color:#ffd76a} li{margin:3px 0}
.card{background:#12162a;border-radius:8px;padding:12px;margin:10px 0}
</style></head><body>
<h1>■ ${name}</h1>
<div class="card"><span class="k">Life</span> <span class="v">#${life}</span> ·
<span class="k">Day</span> <span class="v">${((nowT-t0)/86400000).toFixed(1)} / 7</span> ·
<span class="k">Growth</span> <span class="v">${Math.round(cg*100)}%</span> ·
<span class="k">Population</span> <span class="v">${pop.toLocaleString()}</span></div>
<div class="card"><div class="k">POPULATION over this life</div>${svg(pts,580,90,"#7af5ff")}</div>
<div class="card"><div class="k">ECONOMY (boom ↔ bust)</div>${svg(epts,580,60,"#ffd76a",1)}</div>
<div class="card"><span class="k">Mayor</span> <span class="v">${M?M.winName+" ("+M.party.k+")":"— none yet —"}</span></div>
<div class="card"><div class="k">THE ${F.sur.toUpperCase()} FAMILY</div>
<li>${F.pA} & ${F.pB} ${F.sur}${cy>F.elder?" (the elder rests)":""}</li>
<li>${F.k1.name} — ${cy>F.k1.born?(cy>0.55?"the "+["BAKER","FISHER","OFFICER","TEACHER","ENGINEER","DOCTOR","ARTIST","PILOT"][F.k1.job].toLowerCase():"in school"):"not yet born"}</li>
${F.k2?`<li>${F.k2.name} — ${cy>F.k2.born?"growing up":"not yet born"}</li>`:""}
<li>grandchild — ${cy>F.g3.born?"toddling":"someday"}</li></div>
<div class="card"><div class="k">STILL AHEAD</div><ul>${sched||"<li>the endtimes…</li>"}</ul></div>
<div class="k" style="font-size:11px">generated ${new Date().toLocaleString()} · refreshes every 30 min</div>
</body></html>`;
fs.writeFileSync(path.join(os.homedir(),"CityLive/dashboard.html"),html);
console.log("dashboard written:",name,"day",((nowT-t0)/86400000).toFixed(1),"pop",pop);
