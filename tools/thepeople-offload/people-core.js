// ⚠⚠⚠ SUPERSEDED DEV SCAFFOLD — DO NOT EDIT, DO NOT RE-SPLICE ⚠⚠⚠
// This was the standalone workbench THE PEOPLE was developed in, then spliced into the engine.
// Since Stage 4b the canonical citizen sim lives (and evolved: SOL fixes, election unification,
// Stage 5 regime leaders) DIRECTLY in org.citylive.wallpaper/contents/js/city.js — the single
// source of truth, mirrored to the 4 shells by `npm run sync:engine`, guarded by
// desktop/test/people-sim.test.js. Re-splicing THIS file would ROLL BACK those fixes.
// Kept only so verify-core.js's native perf/contract harness still runs against the original core.
// ============================ THE PEOPLE — CITIZEN SIM CORE (v2.0) ============================
// Deterministic, freeze-safe, pure function of the override clock. Single source of truth on ALL
// four shells. Fold-once-then-cache; never re-fold per frame. Keyed to the EXISTING city-life clock
// (cityGrowth().cy / lifeIndexOf) — no parallel clock. Developed standalone against the offloaded
// data, headless-tested, then spliced into city.js (§ CIVIC CAST neighbourhood).
//
// Public API (read-only projections only — canonical state never leaves this file):
//   peopleRoster(now,lifeIndex,cy) -> { living:[proj], dead:[proj], mayor:proj|null, stats, cy }
//   peopleStats(now,lifeIndex,cy)  -> the economy/vitals aggregates (drives econOf in Stage 4)
// A "proj" is a fresh, safe-to-mutate object; consumers NEVER touch the cache.
//
// Identity: a person is (idx, gen). `idx` is the fixed roster SLOT; `gen` increments each time the
// slot is refilled, so a stored (idx,gen) reference resolves to the SAME person or to nobody —
// never silently to their replacement. References are cleaned lazily at the top of each citizen's
// tick, so cold-fold and incremental-advance stay identical.
'use strict';

// ---- deterministic helpers (mirror engine style: var, bit-twiddle hashes) ----
function P_hash(x){ x|=0; x=Math.imul(x^x>>>16,0x45d9f3b); x=Math.imul(x^x>>>16,0x45d9f3b); return (x^x>>>16)>>>0; }
function P_rng(seed){ var a=seed>>>0; return function(){ a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
var P_SALT=0x50656F70;  // "Peop"

// ---- config ----
var PEOPLE_N=175;            // default cast size (150-200 proven; config-adjustable via cfg.people)
var P_LIFE_TICKS=900;        // ticks per full city-life (bounds the cold fold)
var P_ELECT_EVERY=90;        // ticks between municipal elections
var P_ADULT=18, P_ELDER=62, P_MAXAGE=82, P_FERTILE_LO=24, P_FERTILE_HI=46;
var P_KLABEL=['working poor','working class','professional','wealthy'];
var P_PARTY=['Green Party','Blue Party','Red Party','Independents'];

// ---- data (injected from the offloaded JSON at splice time) ----
var JOB_TAX=[];              // [{id,label,verb,building,districts,klass,clothes,clothesAlt,commutes,wageTier,desc}]
var NAME_POOLS={};           // { newengland:{first,last}, generic:{first,last} }
function P_loadData(jobTax, namePools){ JOB_TAX=jobTax; NAME_POOLS=namePools; }
function P_region(){ try { return (typeof REGION!=='undefined' && NAME_POOLS[REGION]) ? REGION : (NAME_POOLS.newengland?'newengland':'generic'); } catch(e){ return 'newengland'; } }
function P_pool(){ return NAME_POOLS[P_region()] || NAME_POOLS.generic || NAME_POOLS.newengland || {first:['SAM'],last:['HALE']}; }
function P_first(seed){ var pl=P_pool(); return pl.first[P_hash(seed)%pl.first.length]; }
function P_last(seed){ var pl=P_pool(); return pl.last[P_hash(seed^0x51ED)%pl.last.length]; }
function P_job(p){ return JOB_TAX[p.job] || {label:'RESIDENT',verb:'',building:'office',klass:1,clothes:'#888',clothesAlt:'#888',commutes:true,wageTier:2,desc:''}; }

// index-stable trajectory decisions (functions of idx+life ONLY, so raising N never rewrites an
// existing citizen's history — SOL P1). A "founder" is present from founding; others arrive later.
function P_isFounder(idx, lifeSeed){ return (P_hash((idx*0x9E3779B9)^lifeSeed^0xF00D)%100) < 55; }
function P_arriveTick(idx, lifeSeed){ return P_isFounder(idx,lifeSeed) ? 0 : (P_hash((idx*0x27D4EB2F)^lifeSeed^0xA5)%((P_LIFE_TICKS*0.6)|0))+1; }

// ---- build a person for slot idx. `spec` carries lineage for a child, else null (founder/immigrant). ----
function P_make(lifeSeed, idx, gen, bornTick, spec){
  var s=P_hash((idx*0x9E3779B9) ^ (gen*0x85EBCA6B) ^ lifeSeed);
  var r=P_rng(s);
  var job=JOB_TAX.length? (r()*JOB_TAX.length|0) : 0, J=JOB_TAX[job]||{klass:1};
  var first, last, pA=-1,pAg=-1,pB=-1,pBg=-1, age;
  if(spec){                                   // a CHILD born into a living couple — real parentage
    first=P_first(s^0xC1D); last=spec.last;    // inherit a parent's surname (lineage within a life)
    pA=spec.aIdx; pAg=spec.aGen; pB=spec.bIdx; pBg=spec.bGen; age=0;
  } else {                                    // founder or adult immigrant
    first=P_first(s); last=P_last(s>>>7); age=P_ADULT+(r()*40|0);
  }
  return { idx:idx, gen:gen, seed:s, first:first, last:last, alive:true, bornTick:bornTick, arrived:false,
    age:age, maxAge:P_MAXAGE+((r()-0.5)*22|0),
    job:job, employer:-2, home:-1,
    wealth: 8 + r()*18 + (J.klass|0)*10, baseClass:(J.klass|0), klass:(J.klass|0),
    party:(r()*4|0), conv:0.3+r()*0.5, traits:(r()*0x3f|0),
    spouse:-1, spouseGen:-1, pA:pA,pAg:pAg,pB:pB,pBg:pBg, kids:0,
    office:0, crimes:0, scandal:0, retired:false, mood:r() };
}
function P_name(p){ return p.first+' '+p.last; }
// resolve a stored (idx,gen) reference to the CURRENT living person in that slot, or null (SOL P0)
function P_ref(pop, idx, gen){ if(idx<0) return null; var q=pop[idx]; return (q && q.gen===gen && q.alive) ? q : null; }

// ---- the roster + its incremental cache (fold-once, advance; never re-fold per frame) ----
var P_cache={ key:'', tick:-1, pop:null, econ:null };
function P_cacheKey(lifeIndex){ return lifeIndex+'|'+PEOPLE_N+'|'+P_region()+'|'+JOB_TAX.length+'|v2'; }  // full input identity (SOL)

var P_NBLDG=60;              // placeholder building count (Stage 2 — real building registry is Stage 3)
function P_place(pop, i, lifeSeed, tick){
  var p=pop[i], J=P_job(p);
  if(J.commutes===false){ p.employer=-3; return; }         // -3 = self-employed (vendor/artist): EMPLOYED, no fixed bldg
  p.employer = P_hash(p.seed ^ (tick+7)) % P_NBLDG;
  if(p.home<0) p.home = P_hash(p.seed ^ 0x1234) % P_NBLDG;
}
function P_isWorking(p, bldgDead){
  if(p.retired || p.age<P_ADULT) return false;
  if(p.employer===-3) return true;                         // self-employed
  return p.employer>=0 && !bldgDead[p.employer];
}

// replace a dead slot: a CHILD of a living couple (deterministic pick) or an adult immigrant (SOL P0).
// returns TRUE if the replacement is a real child (a birth), so P_step can count it.
function P_respawn(pop, i, lifeSeed, tick){
  var old=pop[i], gen=old.gen+1;
  var rr=P_rng(P_hash((i*0x165667B1)^(gen*0xD3A2646C)^lifeSeed^tick));
  var spec=null;
  if(rr()<0.62){                                           // most renewal is by birth into a family
    var j=P_hash((i*0x9E3779B9)^gen^lifeSeed) % pop.length, par=pop[j];
    var mate=par && par.alive ? P_ref(pop, par.spouse, par.spouseGen) : null;
    if(par && par.alive && mate && par.age>=P_FERTILE_LO && par.age<=P_FERTILE_HI){
      spec={ last: (rr()<0.5?par.last:mate.last), aIdx:j, aGen:par.gen, bIdx:par.spouse, bGen:par.spouseGen };
      par.kids++; mate.kids++;                             // kids are REAL now (a child took a slot)
    }
  }
  pop[i]=P_make(lifeSeed, i, gen, tick+1, spec);
  return !!spec;
}

// bounded death ledger — the deceased survive here for "in memoriam" (SOL P1: slots respawn instantly,
// so the live pop never holds the dead). Part of the folded econ state ⇒ freeze-safe & deterministic.
var P_DEAD_MAX=48;
function P_deadPush(econ, pop, p, tick){
  var J=P_job(p), sp=P_ref(pop,p.spouse,p.spouseGen);
  econ.deadLedger.push({ pid:p.idx*1024+p.gen, name:P_name(p), first:p.first, last:p.last,
    job:J.label, verb:J.verb||'', jobDesc:J.desc||'', clothes:J.clothes||'#888',
    klass:p.klass, klassName:P_KLABEL[p.klass], age:p.age|0, party:p.party, partyName:P_PARTY[p.party]||'',
    netWorth:Math.round(p.wealth*1000), crimes:p.crimes, office:p.office, kidCount:p.kids,
    spouseName:sp?P_name(sp):null, parents:[], retired:!!p.retired, alive:false, diedTick:tick });
  if(econ.deadLedger.length>P_DEAD_MAX) econ.deadLedger.shift();
}

// forward-step ONE tick over the whole cast. O(N) + O(N) rollup + periodic O(N) election.
function P_step(pop, tick, lifeSeed, bldgDead, econ, evt){
  var N=pop.length, e=evt(tick, lifeSeed, bldgDead);
  var employed=0, wforce=0, wealthSum=0, poor=0, working=0, prof=0, rich=0, alive=0;
  var newCrime=0, deaths=0, births=0;
  var v=[0,0,0,0];
  var doElect = tick>0 && (tick%P_ELECT_EVERY)===0;
  var prevRich = econ.richPct||0;                          // prior-tick inequality signal (SOL P2: no index bias)

  for(var i=0;i<N;i++){
    var p=pop[i];
    if(p.bornTick>tick) continue;                          // not arrived yet
    if(!p.arrived){ p.arrived=true; if(p.employer===-2) P_place(pop,i,lifeSeed,tick); }
    if(!p.alive) continue;
    var r=P_rng(p.seed ^ (tick*0x9E3779B9));

    // lazy reference cleanup — a widowed person loses a dead spouse deterministically (SOL P0)
    if(p.spouse>=0 && !P_ref(pop,p.spouse,p.spouseGen)){ p.spouse=-1; p.spouseGen=-1; }

    p.age++;
    // natural death (+ disaster in home district)
    var dP = p.age>p.maxAge ? 0.22 : p.age>p.maxAge-10 ? 0.02 : p.age>P_ELDER ? 0.004 : 0.0004;
    if(e.disK.length){ for(var d=0;d<e.disK.length;d++){ if(p.home===e.disK[d]){ dP+=0.14; break; } } }
    if(r()<dP){ p.alive=false; deaths++;
      P_deadPush(econ, pop, p, tick);                     // remember the deceased (in memoriam)
      if(P_respawn(pop,i,lifeSeed,tick)) births++;        // a replacement born INTO a family = a birth
      continue; }
    if(p.age>=P_ELDER && !p.retired && r()<0.06){ p.retired=true; }

    // employment reacts to the economy
    if(p.age>=P_ADULT && !p.retired){
      if(e.bankrupt.length){ for(var b=0;b<e.bankrupt.length;b++){ if(p.employer===e.bankrupt[b]) p.employer=-1; } }
      if(p.employer===-1 && r() < (0.55 - (econ.unemp||0)*0.4)) P_place(pop,i,lifeSeed,tick);   // rehire; harder in a slump
      wforce++;
      var wk = P_isWorking(p, bldgDead);
      if(wk){ employed++; p.wealth += 0.30 + P_job(p).wageTier*0.30; } else { p.wealth -= 0.32; }
    }
    // sticky cost of living by class (keeps the poor poor) …
    p.wealth -= 0.16 + p.baseClass*0.10;
    // … and capital begets capital: wealth above a cushion compounds, so a real upper class forms
    // and the rich/poor gap WIDENS over a life (the engine of Nick's class-warfare arc, Q10/Q23).
    if(p.wealth>45) p.wealth *= 1.006;
    if(p.wealth<0) p.wealth=0;
    p.klass = p.wealth>95?3 : p.wealth>52?2 : p.wealth>20?1 : 0;

    // crime: poverty + low-honesty trait; opportunity scales with LAST tick's inequality (SOL P2)
    if(p.klass===0 && !(p.traits&2) && r() < 0.015 + prevRich*0.03){ p.crimes++; newCrime++; }

    // marriage: deterministic O(1) candidate probe; store the mate's generation for safe refs
    if(p.spouse<0 && p.age>24 && p.age<70 && r()<0.02){
      var cand=(P_hash(p.seed^0xABCD)>>>(tick&7))%N, q=pop[cand];
      if(cand!==i && q.alive && q.spouse<0 && q.bornTick<=tick && q.age>24){
        p.spouse=cand; p.spouseGen=q.gen; q.spouse=i; q.spouseGen=p.gen;
      }
    }
    // minds can change: conviction drifts with fortune (Nick Q17)
    if(r()<0.04){ p.conv += (p.klass>=2?0.02:-0.03); if(p.conv<0){ p.party=(p.party+1+(r()*3|0))&3; p.conv=0.4; } }

    alive++; wealthSum+=p.wealth;
    if(p.klass===0)poor++; else if(p.klass===1)working++; else if(p.klass===2)prof++; else rich++;
    if(doElect && p.age>=P_ADULT) v[p.party]++;
  }

  // aggregates roll up FROM the agents, over the LIVING population (SOL P1 denominators)
  econ.alive=alive; econ.unemp = wforce? (1-employed/wforce) : 0;
  econ.avgWealth = alive? wealthSum/alive : 0; econ.gdp = wealthSum;
  econ.poorPct = alive? poor/alive : 0; econ.workingPct = alive? working/alive : 0;
  econ.profPct = alive? prof/alive : 0; econ.richPct = alive? rich/alive : 0;
  econ.crimeTotal = (econ.crimeTotal||0) + newCrime;       // cumulative this life
  econ.crimeRecent = newCrime; econ.births=(econ.births||0)+births; econ.deaths=(econ.deaths||0)+deaths;

  // mayor validity: a dead mayor vacates immediately (SOL P1)
  if(econ.mayor>=0 && !P_ref(pop, econ.mayor, econ.mayorGen)){ econ.mayor=-1; econ.mayorGen=-1; }

  if(doElect){
    var mx=Math.max(v[0],v[1],v[2],v[3]), win=v.indexOf(mx);
    var best=-1, bs=-1;                                     // winning party's most prominent living adult
    for(var k=0;k<N;k++){ var c=pop[k]; if(c.alive && c.party===win && c.age>=P_ADULT && c.bornTick<=tick){ var sc=c.conv*100+c.wealth*0.5+c.age; if(sc>bs){ bs=sc; best=k; } } }
    if(econ.mayor>=0 && P_ref(pop,econ.mayor,econ.mayorGen)) pop[econ.mayor].office=0;
    if(best>=0){ pop[best].office=2; econ.mayor=best; econ.mayorGen=pop[best].gen; econ.winParty=win; econ.elections=(econ.elections||0)+1; }
  }
  econ.tick=tick;
}

// deterministic city-event stream (standalone; in-engine this reads the real pure-clock subsystems)
function P_defaultEvents(tick, lifeSeed, bldgDead){
  var h=P_hash((tick*2654435761 ^ lifeSeed)>>>0), disK=[], bankrupt=[];
  if((h%130)===0){ var c=h%P_NBLDG; disK.push(c,(c+1)%P_NBLDG,(c+2)%P_NBLDG); }
  if((h%40)===0){ var b=(h>>>7)%P_NBLDG; bankrupt.push(b); bldgDead[b]=1; }
  if((tick%13)===0){ bldgDead[P_hash(tick)%P_NBLDG]=0; }
  return {disK:disK, bankrupt:bankrupt};
}

// fold the whole life to `tick` (cold path) — bounded, deterministic.
function P_fold(lifeIndex, toTick, evt){
  var lifeSeed=P_hash((lifeIndex*2654435761 + 12345)>>>0);
  var pop=new Array(PEOPLE_N);
  for(var i=0;i<PEOPLE_N;i++) pop[i]=P_make(lifeSeed, i, 0, P_arriveTick(i,lifeSeed), null);
  var bldgDead=new Array(P_NBLDG); for(var z=0;z<P_NBLDG;z++) bldgDead[z]=0;   // QML V4: no Array.fill
  var econ={alive:0,unemp:0,gdp:0,avgWealth:0,poorPct:0,workingPct:0,profPct:0,richPct:0,
    crimeTotal:0,crimeRecent:0,births:0,deaths:0,mayor:-1,mayorGen:-1,winParty:-1,elections:0,tick:-1,deadLedger:[]};
  for(var t=0;t<=toTick;t++) P_step(pop,t,lifeSeed,bldgDead,econ, evt||P_defaultEvents);
  return {pop:pop, econ:econ, bldgDead:bldgDead, lifeSeed:lifeSeed};
}

// internal: cached fold to `now`. Maps now->tick via cy. Advances incrementally; re-folds on key change.
function P_sim(lifeIndex, cy, evt){
  if(!isFinite(cy)) cy=0; if(cy<0) cy=0; if(cy>1) cy=1;        // SOL: non-finite cy must clamp, not yield a misleading empty roster
  var tick=Math.max(0, Math.min(P_LIFE_TICKS, Math.floor(cy*P_LIFE_TICKS)));
  var key=P_cacheKey(lifeIndex);
  if(P_cache.key===key && P_cache.tick===tick) return P_cache;
  if(P_cache.key===key && P_cache.tick<tick && P_cache.pop){                  // warm incremental advance
    var lifeSeed=P_hash((lifeIndex*2654435761 + 12345)>>>0);
    for(var t=P_cache.tick+1;t<=tick;t++) P_step(P_cache.pop,t,lifeSeed,P_cache.bldgDead,P_cache.econ, evt||P_defaultEvents);
    P_cache.tick=tick; return P_cache;
  }
  var r=P_fold(lifeIndex, tick, evt);                                         // cold fold (key change / rewind)
  P_cache={ key:key, tick:tick, pop:r.pop, econ:r.econ, bldgDead:r.bldgDead };
  return P_cache;
}

// ---- read-only projections (fresh objects; canonical state never escapes) ----
function P_proj(pop, p){
  var J=P_job(p), sp=P_ref(pop,p.spouse,p.spouseGen), pa=P_ref(pop,p.pA,p.pAg), pb=P_ref(pop,p.pB,p.pBg);
  var parents=[]; if(pa)parents.push(P_name(pa)); if(pb)parents.push(P_name(pb));
  return { pid:p.idx*1024+p.gen, name:P_name(p), first:p.first, last:p.last,
    job:J.label, verb:J.verb||'', jobDesc:J.desc||'', clothes:J.clothes||'#888',
    klass:p.klass, klassName:P_KLABEL[p.klass], age:p.age|0, alive:!!p.alive, retired:!!p.retired,
    office:p.office, party:p.party, partyName:P_PARTY[p.party]||'',
    netWorth:Math.round(p.wealth*1000), crimes:p.crimes,
    spouseName:sp?P_name(sp):null, kidCount:p.kids, parents:parents };
}
// deterministic display-name uniqueness: if two projections collide, append a middle initial (SOL P1)
function P_dedupeNames(projs){
  var seen={}, INIT='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for(var i=0;i<projs.length;i++){ var pr=projs[i], nm=pr.name, k=0;
    while(seen[nm]){ var mi=INIT[(P_hash(pr.pid^k)%26)]; nm=pr.first+' '+mi+'. '+pr.last; k++; if(k>26)break; }
    seen[nm]=1; pr.name=nm; }
  return projs;
}
function P_gini(vals){ // real, bounded Gini over living net worths (O(N log N), N<=~200 → cheap)
  var n=vals.length; if(n<2) return 0;
  var a=vals.slice().sort(function(x,y){return x-y;}), sum=0, cum=0;
  for(var i=0;i<n;i++) sum+=a[i];
  if(sum<=0) return 0;
  for(var j=0;j<n;j++) cum+=(j+1)*a[j];
  return Math.max(0, Math.min(1, (2*cum)/(n*sum) - (n+1)/n));
}

// PUBLIC — the only entry points consumers call.
function peopleRoster(now, lifeIndex, cy, evt){
  var C=P_sim(lifeIndex, cy, evt||null), pop=C.pop, econ=C.econ;
  var living=[], dead=[], nets=[];
  for(var i=0;i<pop.length;i++){ var p=pop[i]; if(!p.arrived||!p.alive) continue;
    living.push(P_proj(pop,p)); nets.push(p.wealth); }
  var L=econ.deadLedger;                                       // the deceased (bounded ledger), most recent first
  for(var d=L.length-1; d>=0; d--){ var rec=L[d], c={}; for(var kk in rec) c[kk]=rec[kk]; dead.push(c); }
  P_dedupeNames(living.concat(dead));                       // unique display names across everyone shown
  var mayor=null; if(econ.mayor>=0 && P_ref(pop,econ.mayor,econ.mayorGen)) mayor=P_proj(pop,pop[econ.mayor]);
  living.sort(function(a,b){ return (b.office-a.office) || (b.netWorth-a.netWorth); });
  var stats={ pop:econ.alive, unemp:econ.unemp, poorPct:econ.poorPct, workingPct:econ.workingPct,
    profPct:econ.profPct, richPct:econ.richPct, avgNetWorth:Math.round(econ.avgWealth*1000),
    crimeTotal:econ.crimeTotal, crimeRecent:econ.crimeRecent, gini:P_gini(nets),
    elections:econ.elections, births:econ.births, deaths:econ.deaths, mayorName:mayor?mayor.name:null };
  return { living:living, dead:dead, mayor:mayor, stats:stats, cy:cy };
}
function peopleStats(now, lifeIndex, cy, evt){ return peopleRoster(now,lifeIndex,cy,evt).stats; }

// export for the headless harness (deleted at splice time)
if(typeof module!=='undefined') module.exports={ P_loadData, peopleRoster, peopleStats, P_fold, P_sim, P_defaultEvents, P_ref, P_proj,
  get PEOPLE_N(){return PEOPLE_N;}, set PEOPLE_N(v){PEOPLE_N=v;}, get P_LIFE_TICKS(){return P_LIFE_TICKS;}, _cacheReset:function(){P_cache={key:'',tick:-1,pop:null,econ:null};} };
