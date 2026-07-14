#!/usr/bin/env node
// CityLive CHRONICLE — recomputes a life's whole story from the deterministic sim
// Usage: node chronicle.js [lifeIndex]   (default: the life running right now)
const fs=require("fs"), path=require("path"), os=require("os");
const SRC=path.join(os.homedir(),".local/share/plasma/wallpapers/org.citylive.wallpaper/contents/js/city.js");
const code=fs.readFileSync(SRC,"utf8");
const sandbox={console};
require("vm").createContext(sandbox);
require("vm").runInContext(code,sandbox);
const S=sandbox;
// a do-nothing canvas context — we only want the sim state draw() computes
const noop=()=>{}; const fakeGrad={addColorStop:noop};
const g=new Proxy({},{get:(t,k)=>{
  if(k==="createLinearGradient"||k==="createRadialGradient") return ()=>fakeGrad;
  if(k==="measureText") return ()=>({width:0});
  return noop; },set:()=>true});
const life=process.argv[2]!==undefined?parseInt(process.argv[2],10)
          :Math.floor((Date.now()-S.GROW_EPOCH)/S.GROW_CYCLE);
const t0=S.GROW_EPOCH+life*S.GROW_CYCLE, t1=t0+S.GROW_CYCLE;
S.setup("neon",{cw:480,ch:270,woff:0,ww:1702,pxk:4});
const seen=new Set(), events=[];
const STEPS=2200;
for(let i=0;i<STEPS;i++){
  const t=t0+(i+0.5)*(t1-t0)/STEPS;
  S.NOWOVR=t;
  try{ S.draw(g); }catch(e){}
  let msg=null;
  try{ msg=S.tickerMsg(t); }catch(e){}
  const routine=/^(CITY APPROVAL|POP \d|BUDGET (SURPLUS|DEFICIT)|WELCOME TO|.*TRANSIT - ALL LINES)/;
  if(msg&&routine.test(msg)) msg=null;
  if(msg&&!seen.has(msg)){
    seen.add(msg);
    const d=new Date(t);
    events.push({t, day:((t-t0)/86400000).toFixed(1), when:d.toLocaleString("en-US",{weekday:"short",hour:"numeric",minute:"2-digit"}), msg});
  }
}
S.NOWOVR=t0+1000; try{S.draw(g);}catch(e){}
const name=S.cityName||("LIFE "+life);
let md=`# The Chronicle of ${name}\n\n*Life ${life} · ${new Date(t0).toDateString()} — ${new Date(t1).toDateString()}*\n\n`;
md+=`| Day | When | Event |\n|---|---|---|\n`;
for(const e of events) md+=`| ${e.day} | ${e.when} | ${e.msg} |\n`;
md+=`\n*${events.length} recorded moments, reconstructed from the deterministic clock.*\n`;
const out=path.join(os.homedir(),"CityLive/chronicles",`life-${life}-${name.replace(/[^A-Z0-9]+/gi,"_")}.md`);
fs.writeFileSync(out,md);
console.log("wrote",out,`(${events.length} events)`);
