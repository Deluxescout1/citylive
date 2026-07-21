'use strict';

// Deterministic visual-certification renderer. Captures a whole-city overview for
// every major feature family; use ImageMagick montage on the named PNGs for review.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.disableHardwareAcceleration();
const detail = process.argv.includes('--detail');
const outArg = process.argv.slice(2).find((arg) => arg !== '--detail');
const outDir = outArg || (detail ? '/tmp/citylive-feature-detail-matrix' : '/tmp/citylive-feature-matrix');
// Fixed local wall-clock samples: early afternoon and late night. Keeping these
// semantic prevents a timezone conversion from silently turning the "night"
// matrix into an evening daylight render.
const day = new Date(2026, 6, 21, 13, 0, 0).getTime();
const night = new Date(2026, 6, 21, 23, 0, 0).getTime();
const cases = [];
const viewport = detail
  ? {cw:853,ch:480,ww:2269,woff:708,screenw:853,screenh:480}
  : {cw:2269,ch:480,ww:2269,woff:0,screenw:1135,screenh:240};
const add = (group, name, query) => {
  // The engine separates story time (NOWOVR) from sky/astronomy time (CLOCK).
  // Pin both unless a case deliberately supplies a different sky clock.
  const q = Object.assign({}, query);
  if (q.now != null && q.clock == null) q.clock = q.now;
  cases.push({ group, name, query: Object.assign({}, viewport, {nogeo:1,noflights:1}, q) });
};

for (const age of [0.02,0.08,0.18,0.35,0.52,0.7,0.86,0.97]) {
  add('growth',`age-${String(age).replace('.','_')}-day`,{age,now:day});
  add('growth',`age-${String(age).replace('.','_')}-night`,{age,now:night});
}
for (const [name,code,temp,cloud] of [
  ['clear',0,72,10],['overcast',3,65,100],['fog',45,55,100],['drizzle',51,58,100],
  ['freezing-rain',66,27,100],['rain',61,60,100],['violent-rain',82,66,100],
  ['snow',71,25,100],['snow-grains',77,22,100],['snow-showers',86,24,100],
  ['thunder',95,70,100],['hail',99,68,100]
]) add('weather',name,{age:.78,now:name.includes('thunder')||name==='hail'?night:day,wcode:code,temp,cloud,wind:28,bolt:code>=95?.9:0});

for (const event of ['market','parade','marathon','movie','concert','foodfest','champ','icerink','protest','film','balloonfest'])
  add('events',event,{age:.78,now:['movie','concert'].includes(event)?night:day,event});

for (const disaster of ['asteroid','volcano','zombie','alien','kaiju','tornado','flood','mech','kraken','sandstorm','iceage','rift','blackout','smog','planecrash']) {
  add('disasters',`${disaster}-active`,{age:.72,now:day,dis:disaster,disf:.25,disi:5});
  add('disasters',`${disaster}-aftermath`,{age:.72,now:night,dis:disaster,disf:.55,disi:5});
}
for (const death of ['meteors','nuke','sunburst','ai','bh','alienwar','frost','kaiju','flood','kaijuwar','pollution','moonfall']) {
  add('finales',`${death}-approach`,{now:night,death,apoc:.18});
  add('finales',`${death}-impact`,{now:night,death,apoc:.62});
  add('finales',`${death}-end`,{now:night,death,apoc:.9});
}
for (let stage=1;stage<=6;stage++) {
  add('regime',`order-stage-${stage}`,{age:.72,now:stage%2?day:night,regime:stage,outcome:stage===6?'win':'putdown',rsub:stage===6?.7:.6});
  add('regime',`bills-stage-${stage}`,{age:.72,now:stage%2?night:day,regime:stage,bills:1,outcome:stage===6?'win':'putdown',rsub:stage===6?.7:.6});
}
for (let stage=1;stage<=5;stage++) {
  add('health',`plague-stage-${stage}`,{age:.72,now:stage%2?day:night,plague:stage,psev:stage>=3?1:.5});
  add('health',`zombie-plague-stage-${stage}`,{age:.72,now:stage%2?night:day,plague:stage,pz:1,psev:1});
  add('health',`addiction-care-${stage}`,{age:.72,now:stage%2?day:night,addict:stage,asev:stage>=3?1:.5});
  add('health',`addiction-crackdown-${stage}`,{age:.72,now:stage%2?night:day,addict:stage,acrack:1,asev:stage>=3?1:.5});
  add('festival',`world-expo-stage-${stage}`,{age:.72,now:stage%2?day:night,festival:stage,ffest:.9});
}
for (const civic of ['university','grandcentral','zoo','observatory','marina']) {
  add('civics',`${civic}-construction`,{age:.78,now:day,civic,bp:'cons',prog:.55,cx:.5});
  add('civics',`${civic}-complete`,{age:.78,now:night,civic,bp:'done',cx:.5});
}
for (const use of ['hospital','theater','hotel','bank','cafe','pharmacy','school','firestation','museum','deptstore','factory','warehouse'])
  add('buildings',`use-${use}`,{age:.82,now:use==='theater'||use==='hotel'?night:day,use,probe:'use'});
for (const crown of ['gable','gambrel','hip','saltbox','mansard','steeple','dome','tank','blade','spire','helipad','billboard','watertower'])
  add('buildings',`crown-${crown}`,{age:.82,now:crown==='billboard'?night:day,crown});
for (const layout of ['ribbon','band','grid','punch','corp']) add('buildings',`windows-${layout}`,{age:.82,now:night,layout});

for (const [name,q] of [
  ['milky-way-village',{age:.25,now:night,probe:'mw'}],['milky-way-city',{age:.9,now:night,probe:'mw'}],
  ['aurora-kp5',{age:.7,now:night,kp:5}],['aurora-kp8',{age:.7,now:night,kp:8}],
  ['starlink',{age:.7,now:night,starlink:.5}],['iss',{age:.7,now:night,iss:'41.52,-72.08,.06,.9'}],
  ['colonies',{space:1,now:night,colony:1}],['space-age',{space:1,now:night,colony:.7}],
  ['live-flights',{age:.75,now:day,flights:7}],['bills-gameday',{age:.75,now:night,bills:1,gameon:1}],
  ['hard-times',{age:.75,now:night,slump:1}],['party-greens',{age:.8,now:day,greens:1}],
  ['party-builders',{age:.8,now:day,builders:1}],['party-safety',{age:.8,now:night,safety:1}],['party-transit',{age:.8,now:day,transit:1}]
]) add('systems',name,q);

function safeName(s) { return s.replace(/[^a-z0-9_-]+/gi,'-'); }
function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

app.whenReady().then(async () => {
  fs.mkdirSync(outDir,{recursive:true});
  const win = new BrowserWindow({width:detail?853:1135,height:detail?480:240,show:false,useContentSize:true,
    webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false}});
  const manifest=[];
  for (let i=0;i<cases.length;i++) {
    const c=cases[i], file=`${String(i+1).padStart(3,'0')}-${safeName(c.group)}-${safeName(c.name)}.png`;
    await win.loadFile(path.join(__dirname,'..','kde-repro.html'),{query:Object.fromEntries(Object.entries(c.query).map(([k,v])=>[k,String(v)]))});
    await wait(180);
    const title=await win.getTitle();
    if (/ERR/.test(title)) throw new Error(`${c.group}/${c.name}: ${title}`);
    const image=await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir,file),image.toPNG());
    manifest.push({index:i+1,group:c.group,name:c.name,file,query:c.query,title});
    if((i+1)%20===0) console.log(`MATRIX_PROGRESS ${i+1}/${cases.length}`);
  }
  fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(`MATRIX_OK ${cases.length} renders in ${outDir}`);
  app.quit();
}).catch((e)=>{console.error('MATRIX_FAIL '+(e&&e.stack||e));app.exit(1);});
setTimeout(()=>{console.error('MATRIX_TIMEOUT');app.exit(1);},180000);
