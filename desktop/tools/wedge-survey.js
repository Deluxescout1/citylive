// Survey EVERY land for the "floating blocks in the backdrop wedge" fault class:
// hard-edged wide, short fills painted between HORIZON-60 and HORIZON-4, where the
// backdrop (sky + hills) is what lies behind them.
const fs=require('fs'),vm=require('vm');
const SRC=fs.readFileSync('org.citylive.wallpaper/contents/js/city.js','utf8');
function run(land,egg,age){
  const sandbox={Math,Date,JSON,Object,Array,String,Number,Boolean,RegExp,isNaN,isFinite,parseInt,parseFloat,
    console:{log(){},warn(){},error(){}},performance:{now:()=>Date.now()},requestAnimationFrame:()=>0,
    setTimeout:()=>0,setInterval:()=>0,clearTimeout(){},clearInterval(){}};
  sandbox.window=sandbox;sandbox.self=sandbox;sandbox.globalThis=sandbox;
  const ctx=vm.createContext(sandbox);
  vm.runInContext(SRC,ctx,{filename:'city.js'});
  ctx.NOFETCH=true;
  if(egg){ctx.FORCEEGG=land;ctx.FORCEBIOME=null;}else{ctx.FORCEBIOME=land;ctx.FORCEEGG=null;}
  ctx.applyConfig({lat:41.5243,lon:-72.0759});
  ctx.setup('neon',{cw:776,ch:437,woff:0,ww:2269,pxk:3,zoom:1,taskbarWp:17,quality:'balanced',frameMs:125});
  ctx.FORCEAGE=age; ctx.NOWOVR=ctx.CLOCK=1810832850000;
  const H=vm.runInContext('HORIZON',ctx), Y0=H-60, Y1=H-4;
  let style='#000', seen=new Map();
  const g=new Proxy({},{get(t,p){
    if(p==='fillStyle'||p==='strokeStyle') return style;
    if(p==='canvas') return {width:776,height:437};
    if(p==='measureText') return s=>({width:4});
    if(p==='createLinearGradient'||p==='createRadialGradient'||p==='createPattern') return ()=>({addColorStop(){}});
    if(p==='getImageData') return ()=>({data:[]});
    if(p==='fillRect') return (x,y,w,h)=>{
      if(!(w>=14&&h>0&&h<=14)) return;             // WIDE and SHORT — a bar, not a column or a wash
      if(!(y>=Y0&&y+h<=Y1)) return;                // fully inside the backdrop wedge
      if(/rgba\([^)]*,\s*0?\.\d+\)/.test(String(style))) return;   // washes/haze are not the fault
      const st=new Error().stack.split('\n').slice(2,5)
        .map(s=>(s.match(/at (\S+) \(city\.js:(\d+)/)||[,'?','?']).slice(1).join(':'))
        .filter(s=>s!=='?:?')[0]||'?';
      seen.set(st,(seen.get(st)||0)+1);
    };
    return ()=>{};},set(t,p,v){if(p==='fillStyle'||p==='strokeStyle') style=v; return true;}});
  for(const p of ['bg','city','live']){ try{ctx.draw(g,p);}catch(e){} }
  return seen;
}
const LANDS='alpine forest mesa cliffs plains beach swamp volcano arctic sprawl hell heaven dunes karst fjord salt dam under savanna canyon'.split(' ');
const EGGS='leaf rainv plateau fire falls icewarr lumbridge falador ardougne varrock'.split(' ');
for(const [list,isEgg] of [[LANDS,false],[EGGS,true]]){
  for(const L of list){
    let agg=new Map();
    for(const age of [0.25,0.6]){
      let s; try{ s=run(L,isEgg,age); }catch(e){ console.log(L.padEnd(10),'THREW',e.message.slice(0,60)); continue; }
      for(const [k,v] of s) agg.set(k,(agg.get(k)||0)+v);
    }
    if(agg.size) console.log(L.padEnd(10),[...agg].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>k+' x'+v).join('   '));
  }
}
