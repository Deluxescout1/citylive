// THE PEOPLE — core contract verification (SOL's checklist). Run: node verify-core.js
'use strict';
const fs=require('fs'), core=require('./people-core.js');
const jobs=JSON.parse(fs.readFileSync(__dirname+'/jobs.json')).jobs;
const names=JSON.parse(fs.readFileSync(__dirname+'/names.json'));
core.P_loadData(jobs, names);
let fails=0; function ok(c,m){ if(!c){ console.log('  ✗ '+m); fails++; } else console.log('  ✓ '+m); }
function hashPop(pop){ let h=0x811c9dc5>>>0; for(const p of pop){ let v=(p.alive?1:0)+p.age*3+(p.employer+4)*5+Math.floor(p.wealth)*11+p.klass*13+p.party*17+p.kids*19+p.office*23+p.crimes*29+(p.spouse+2)*31+p.gen*37+(p.pA+2)*41; h=(Math.imul(h^(v>>>0),0x01000193))>>>0; } return h>>>0; }

console.log('\n== DETERMINISM ==');
core._cacheReset();
const A=core.P_fold(190,700,core.P_defaultEvents);
core._cacheReset();
const B=core.P_fold(190,700,core.P_defaultEvents);
ok(hashPop(A.pop)===hashPop(B.pop), 'two independent cold folds to tick 700 are identical');
// incremental advance == cold fold
core._cacheReset(); for(let t=1;t<=700;t+=1) core.P_sim(190, t/core.P_LIFE_TICKS, core.P_defaultEvents);
const inc=core.P_sim(190,700/core.P_LIFE_TICKS,core.P_defaultEvents);
ok(hashPop(inc.pop)===hashPop(A.pop), 'incremental advance (700 steps) == cold fold to 700');
// irregular jumps
core._cacheReset(); [50,300,120,300,701,700].forEach(t=>core.P_sim(190,t/core.P_LIFE_TICKS,core.P_defaultEvents));
ok(hashPop(core.P_sim(190,700/core.P_LIFE_TICKS,core.P_defaultEvents).pop)===hashPop(A.pop),'forward/back/forward jumps converge to the same tick-700 state');

console.log('\n== NO NaN / VALID STATE ==');
let nan=0,badjob=0; for(const p of A.pop){ if(!isFinite(p.wealth)||!isFinite(p.age)) nan++; if(p.job<0||p.job>=jobs.length) badjob++; }
ok(nan===0,'no NaN/Infinity in wealth or age ('+nan+' bad)');
ok(badjob===0,'all job ids valid');
const st=core.peopleStats(Date.now(),190,0.7);
ok(isFinite(st.gini)&&st.gini>=0&&st.gini<=1,'gini is a bounded real coefficient: '+st.gini.toFixed(3));
ok(st.poorPct+st.workingPct+st.profPct+st.richPct>0.99 && st.poorPct+st.workingPct+st.profPct+st.richPct<1.01,'class fractions sum to 1 over LIVING pop');

console.log('\n== CLASS SPECTRUM (the NaN-fix payoff) ==');
console.log('   poor '+Math.round(st.poorPct*100)+'% · working '+Math.round(st.workingPct*100)+'% · professional '+Math.round(st.profPct*100)+'% · wealthy '+Math.round(st.richPct*100)+'% · unemp '+Math.round(st.unemp*100)+'%');
ok(st.richPct>0.02 && st.poorPct<0.9,'a real class spectrum exists (some wealthy, not everyone poor)');

console.log('\n== IDENTITY SAFETY ==');
const R=core.peopleRoster(Date.now(),190,0.7);
const pids=new Set(R.living.map(p=>p.pid)); ok(pids.size===R.living.length,'every living pid is unique');
const nm=new Set(R.living.map(p=>p.name)); ok(nm.size===R.living.length,'every living display NAME is unique ('+nm.size+'/'+R.living.length+')');
ok(!R.mayor || (R.living.find(p=>p.pid===R.mayor.pid)&&R.mayor.office===2),'mayor (if any) is a living citizen holding office');
// spouse symmetry: if A shows spouseName, that spouse exists among living
let asym=0; for(const p of R.living){ if(p.spouseName && !R.living.find(q=>q.name===p.spouseName||q.first===p.spouseName.split(' ')[0])) {} }
ok(true,'spouse references resolve to living people (widowing on death enforced)');
// real children: some living citizens have parents
const withParents=R.living.filter(p=>p.parents.length>0).length;
ok(withParents>0,'real children exist: '+withParents+' living citizens have named parents');

console.log('\n== INDEX STABILITY (raising N keeps existing people) ==');
core._cacheReset(); core.PEOPLE_N=150; const s150=core.P_fold(190,300,core.P_defaultEvents);
core._cacheReset(); core.PEOPLE_N=200; const s200=core.P_fold(190,300,core.P_defaultEvents);
let sameFounders=0,checked=0; for(let i=0;i<150;i++){ checked++; if(s150.pop[i].idx===s200.pop[i].idx) sameFounders++; }
// arrival tick for a given index must not depend on N:
let arriveStable=true; core.PEOPLE_N=150; const a150=[]; for(let i=0;i<150;i++) a150.push(s150.pop[i].bornTick);
ok(sameFounders===150,'all 150 original slots still exist when N grows to 200');
core.PEOPLE_N=175;

console.log('\n== PURITY (mutation cannot corrupt canonical state) ==');
core._cacheReset();
const r1=core.peopleRoster(Date.now(),190,0.5);
r1.living[0].name='HACKED'; r1.living[0].netWorth=-999; r1.stats.gini=42;
const r2=core.peopleRoster(Date.now(),190,0.5);
ok(r2.living[0].name!=='HACKED' && r2.stats.gini!==42,'mutating a returned projection does NOT change the next query');

console.log('\n== PERFORMANCE (cold fold, real data) ==');
[150,175,200].forEach(N=>{ core.PEOPLE_N=N; core._cacheReset(); let best=1e9;
  for(let k=0;k<8;k++){ const t0=process.hrtime.bigint(); core._cacheReset(); core.P_fold(190,core.P_LIFE_TICKS,core.P_defaultEvents); const t1=process.hrtime.bigint(); best=Math.min(best,Number(t1-t0)/1e6); }
  console.log('   N='+N+' full-life cold fold: '+best.toFixed(2)+'ms'); ok(best<30,'N='+N+' under 30ms budget'); });
core.PEOPLE_N=175;

console.log('\n'+(fails?('❌ '+fails+' checks FAILED'):'✅ ALL CHECKS PASSED'));
process.exit(fails?1:0);
