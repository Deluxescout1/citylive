'use strict';

// Instruments every draw* function in the canonical engine, drives a deterministic
// feature matrix, and reports functions that were never exercised. This is execution
// coverage, not a replacement for contact-sheet visual review.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const enginePath = path.join(__dirname, '..', 'org.citylive.wallpaper', 'contents', 'js', 'city.js');
let source = fs.readFileSync(enginePath, 'utf8');
const all = [];
source = source.replace(/^function (draw[A-Za-z0-9_]*)\(([^)]*)\)\{/gm, (whole, name, args) => {
  all.push(name);
  return `function ${name}(${args}){__cover('${name}');`;
});

const hit = Object.create(null);
function stubCanvas() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(_t, p) {
      if (p === 'measureText') return (s) => ({ width: String(s || '').length * 4 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => gradient;
      if (p === 'getImageData') return () => ({ data: [] });
      if (p === 'canvas') return { width: 427, height: 240 };
      return () => {};
    }, set() { return true; }
  });
}
const sb = { Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Set, Map,
  isNaN, isFinite, parseInt, parseFloat, console,
  __cover: (name) => { hit[name] = (hit[name] || 0) + 1; },
  performance: { now: () => Date.now() }, requestAnimationFrame: () => 0,
  setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {} };
sb.window = sb; sb.self = sb; sb.globalThis = sb;
const ctx = vm.createContext(sb);
vm.runInContext(source, ctx, { filename: 'city.js' });
ctx.NOFETCH = true;
ctx.NOGEO = true;
ctx.setup('neon', { cw: 427, ch: 240, woff: 0, ww: 427, pxk: 4, zoom: 1, quality: 'performance' });
const g = stubCanvas();

function clearHooks() {
  ctx.FORCEAGE = null; ctx.FORCEDEATH = null; ctx.FORCEDIS = null; ctx.FORCEEVENT = null;
  ctx.FORCEELECT = null; ctx.FORCEREGIME = null; ctx.FORCEPLAGUE = null;
  ctx.FORCEFESTIVAL = null; ctx.FORCEADDICT = null; ctx.FORCEBILLS = false;
  ctx.FORCEPARTYLEG = null; ctx.FORCEFLIGHTS = null; ctx.FORCECOLONY = null;
  ctx.FORCESTARLINK = null; ctx.FORCEISS = null; ctx.FORCEKP = null;
  ctx.FORCECROWN = null; ctx.FORCELAYOUT = null; ctx.FORCEUSE = null;
  ctx.FORCERUIN = null;
  ctx.DEMO_APOC_SEC = 0;
}
function frame(opts = {}) {
  clearHooks();
  Object.assign(ctx, opts);
  const clock = opts.NOWOVR == null ? Date.UTC(2026, 6, 21, 16, 0, 0) : opts.NOWOVR;
  ctx.NOWOVR = clock; ctx.CLOCK = clock;
  ctx.draw(g);
}

// Natural calendar/time/age sweep: holidays, seasons, daily professions, nightlife,
// deterministic rare events, growth eras, elections, war and ordinary city systems.
for (let month = 0; month < 12; month++) {
  for (const day of [1, 8, 15, 22, 28]) for (const hour of [0, 6, 9, 12, 17, 21, 23]) {
    frame({ NOWOVR: Date.UTC(2026, month, day, hour), FORCEAGE: 0.78 });
  }
}
for (let life = 0; life < 80; life++) {
  const start = life * ctx.GROW_CYCLE + ctx.GROW_EPOCH - ctx.GROW_OFFSET_DAYS * 86400000 - (ctx.WORLD_SHIFT || 0);
  for (const cy of [0.01, 0.04, 0.12, 0.25, 0.42, 0.55, 0.68, 0.78, 0.88, 0.94]) frame({ NOWOVR: Math.round(start + cy * ctx.GROW_CYCLE) });
}

// Weather family, including all special WMO-derived branches.
for (const code of [0, 3, 45, 48, 51, 56, 61, 66, 71, 75, 77, 80, 82, 85, 86, 95, 96, 99]) {
  ctx.FORCEWX = { code, cloud: code ? 95 : 20, wind: 24, temp: code >= 56 && code <= 77 ? 28 : 72, precip: code ? 4 : 0, feels: 70, gust: 38 };
  frame({ FORCEAGE: 0.75, NOWOVR: Date.UTC(2026, 6, 21, code % 24), FORCEWX: ctx.FORCEWX, lightning: code >= 95 ? 0.86 : 0 });
}

for (const event of ['concert','foodfest','champ','icerink','market','parade','movie','marathon','protest','film','balloonfest'])
  frame({ FORCEAGE: 0.75, FORCEEVENT: event });

for (const type of ['asteroid','volcano','zombie','alien','kaiju','tornado','flood','mech','kraken','sandstorm','iceage','rift','blackout','smog','planecrash'])
  for (const f of [0.05, 0.25, 0.55, 0.85]) frame({ FORCEAGE: 0.7, FORCEDIS: { type, intensity: 5, xf: 0.5, w: 70, seed: 77, f, open: f === 0.05 } });

for (const death of Array.from(new Set(Array.from(ctx.DEATHS).concat(['kaijuwar','pollution','moonfall']))))
  for (const apoc of [0.05, 0.2, 0.45, 0.7, 0.92]) frame({ FORCEDEATH: death, FORCEAGE: { g:1, phase:'apoc', apoc, cy:0.955 + 0.045 * apoc } });

for (const theme of ['order','bills']) for (const outcome of ['win','putdown']) for (let stage = 1; stage <= 6; stage++)
  frame({ FORCEAGE:0.72, FORCEREGIME:{ active:true,stage,sub:stage===6?0.7:0.55,perm:outcome==='putdown',outcome,
    party:{k:theme==='bills'?'BILLS MAFIA':'THE ORDER',c:theme==='bills'?'#00338d':'#c0182a'},theme,
    leaderName:theme==='bills'?'COACH ALLEN':'CHANCELLOR VOSS',path:'revolution',seed:4242 } });
for (const zombie of [false,true]) for (let stage=1;stage<=5;stage++)
  frame({ FORCEAGE:0.72, FORCEPLAGUE:{active:true,stage,sub:0.55,severity:stage>=3?1:0.5,zombie,zprog:0.8,seed:1234} });
for (let stage=1;stage<=5;stage++) frame({ FORCEAGE:0.72, FORCEFESTIVAL:{active:true,stage,sub:0.55,festivity:0.9,theme:'WORLD',seed:1234} });
for (const crackdown of [false,true]) for (let stage=1;stage<=5;stage++)
  frame({ FORCEAGE:0.72, FORCEADDICT:{active:true,stage,sub:0.55,severity:stage>=3?1:0.5,crackdown,seed:1234} });

for (const civic of ['arena','casino','park','university','grandcentral','zoo','observatory','marina'])
  for (const bp of ['cons','done']) frame({ FORCEAGE:0.78, FORCEELECT:{civics:[{t:civic,kind:'build',civic:true,pass:true,bp,prog:0.6,x:210,w:60,seed:998877}]} });
for (const use of ['hospital','theater','hotel','bank','cafe','pharmacy','school','firestation','museum','deptstore','factory','warehouse'])
  frame({ FORCEAGE:0.8, FORCEUSE:use });
for (const crown of ['gable','gambrel','hip','saltbox','mansard','steeple','step','peak','dome','tank','chevron','battlement','blade','spire','antenna','helipad','stack','billboard','watertower'])
  frame({ FORCEAGE:0.8, FORCECROWN:crown });
for (const layout of ['ribbon','band','grid','punch','corp']) frame({ FORCEAGE:0.8, FORCELAYOUT:layout });
for (const party of ['GREENS','BUILDERS','SAFETY','TRANSIT']) frame({ FORCEAGE:0.8, FORCEPARTYLEG:{GREENS:party==='GREENS'?1:0,BUILDERS:party==='BUILDERS'?1:0,SAFETY:party==='SAFETY'?1:0,TRANSIT:party==='TRANSIT'?1:0} });

const syntheticFlights = [
  {cs:'HEAVY1',ty:'B77W',cat:'A5',e0:5000,n0:5000,alt0:33000,track:90,gs:480,vr:0,t0:Date.UTC(2026,6,21,16)},
  {cs:'PROP1',ty:'C172',cat:'A1',e0:-3000,n0:2000,alt0:3500,track:180,gs:110,vr:-500,t0:Date.UTC(2026,6,21,16)},
  {cs:'LIFE1',ty:'EC35',cat:'A7',e0:1000,n0:-2000,alt0:1200,track:20,gs:90,vr:0,t0:Date.UTC(2026,6,21,16)}
];
frame({ FORCEAGE:0.8, FORCEFLIGHTS:syntheticFlights, FORCEBILLS:true, FORCEKP:8, FORCESTARLINK:0.5,
  FORCEISS:{lat:ctx.LAT,lon:ctx.LON,vlat:0.06,vlon:0.9}, FORCECOLONY:{moon:1,mars:1,venus:1,europa:1,titan:1} });
for (const space of [0.1,0.35,0.7,1]) frame({ FORCEAGE:{g:1,phase:'peak',apoc:0,cy:0.80+0.13*space}, FORCECOLONY:{moon:space,mars:space,venus:space,europa:space,titan:space} });

// Full-width-only landmarks/media and narrowly timed branches.
ctx.setup('neon', { cw: 853, ch: 480, woff: 0, ww: 2269, pxk: 3, zoom: 1, quality: 'spectacle' });
frame({ FORCEAGE:0.92, NOWOVR:Date.UTC(2026,6,4,21) });
frame({ FORCEAGE:0.92, FORCEEVENT:'balloonfest', NOWOVR:Date.UTC(2026,5,13,8) });
frame({ FORCEAGE:0.92, FORCEEVENT:'concert', FORCEWX:{code:0,cloud:15,wind:22,temp:98,precip:0,feels:102,gust:32}, NOWOVR:Date.UTC(2026,6,18,22) });
frame({ FORCEAGE:0.92, FORCEREGIME:{active:true,stage:5,sub:0.7,perm:true,outcome:'putdown',party:{k:'THE ORDER',c:'#c0182a'},theme:'order',leaderName:'CHANCELLOR VOSS',path:'revolution',seed:4242} });
ctx.BIRTHDAYS = [{m:7,d:21,label:'HAPPY BIRTHDAY TEST'}];
frame({ FORCEAGE:0.92, NOWOVR:new Date(2026,6,21,21,0,0).getTime() });
ctx.BIRTHDAYS = [];
frame({ FORCEAGE:0.92, FORCERUIN:{type:'asteroid',intensity:5,xf:0.15,w:90,seed:77} });
frame({ FORCEAGE:0.92, NOWOVR:new Date(2026,3,19,13,0,0).getTime() }); // Kite Festival

// Find an actual scheduled helicopter slot rather than assuming the wall clock.
let chopAt = Date.UTC(2026,6,21,0);
ctx.FORCECROWN='helipad';
ctx.setup('neon', { cw: 853, ch: 480, woff: 0, ww: 2269, pxk: 3, zoom: 1, quality: 'spectacle' });
frame({ FORCEAGE:0.92, FORCECROWN:'helipad', NOWOVR:chopAt });
for (let ms=chopAt; ms<chopAt+12*3600000; ms+=1000) if (ctx.chopperNow(ms)) { chopAt=ms; break; }
frame({ FORCEAGE:0.92, NOWOVR:chopAt });

// Black-hole Moon debris needs the Moon above the horizon; sweep one day to guarantee it.
for (let hour=0;hour<24;hour++) frame({ FORCEDEATH:'bh', FORCEAGE:{g:1,phase:'apoc',apoc:0.8,cy:0.991}, NOWOVR:Date.UTC(2026,6,21,hour) });
// Nuclear approach is only a few seconds of a week-long life, so use a tiny apoc fraction.
const nukeApproach = 1000 / (0.045 * ctx.GROW_CYCLE);
frame({ FORCEDEATH:'nuke', FORCEAGE:{g:1,phase:'apoc',apoc:nukeApproach,cy:0.955+0.045*nukeApproach}, NOWOVR:Date.UTC(2026,6,21,16) });

// Exercise content variants whose parent systems are covered but whose selection is randomized.
ctx.drawDoomJet(g,200,120,1,0.2,0,Date.now(),7);
ctx.drawStateScreen(g,20,20,34,13,Date.now(),0.7);
ctx.drawAnchor(g,40,40,Date.now(),'#c99070');
const ruinBuilding = ctx.near.blds.find((b) => b.type !== 'park');
ctx.drawRuinBuilding(g,ruinBuilding,40,{type:'asteroid',intensity:5,seed:77},0.7,Date.now());

const uncovered = all.filter((name) => !hit[name]);
const report = { total: all.length, covered: all.length - uncovered.length, percent: +(100 * (all.length - uncovered.length) / all.length).toFixed(1), uncovered, hits: hit };
const out = process.argv[2];
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`DRAW_COVERAGE ${report.covered}/${report.total} (${report.percent}%)`);
if (uncovered.length) console.log('UNCOVERED ' + uncovered.join(', '));
