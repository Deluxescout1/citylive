// ============ THE PEOPLE — WORLD BINDING + EMBODIMENT (v2.0 Stage 3) ============
// CENTRAL birth predicate — canonical "this building is fully built". Fixes the engine's < vs <= drift:
// equality (cityG-bAge === bandOf) counts as STILL SCAFFOLDING (matches line 6232's strict `>`); the
// one-frame boundary instant simply isn't yet a valid destination — harmless.
function buildingBuilt(b, cityG){ return b && (b.bAge===undefined || (cityG - b.bAge) > bandOf(b)); }
// standing = built AND not currently destroyed. Destruction predicates are ENGINE globals present only
// in the draw context; typeof-guarded so this is safe headless and active once spliced. VERIFY the exact
// names when splicing (nukeStruck/nukeHit confirmed; ruin predicate TBD at splice).
function buildingStanding(b, cityG){
  if(!b) return false;
  if(b.type!=='park' && !buildingBuilt(b, cityG)) return false;   // parks are open land — always "there"
  // currently destroyed? (engine globals; typeof-guarded so headless is a no-op)
  if(typeof nukeStruck==='function' && nukeStruck() && typeof nukeHit==='function' && nukeHit(b.x)) return false;  // apocalypse blast zone
  if(typeof curRuins!=='undefined' && curRuins && curRuins.length && typeof inZone==='function'){
    for(var r=0;r<curRuins.length;r++) if(inZone(b.x, b.w, curRuins[r])) return false;                            // permanent ruin
  }
  return true;
}
function bldUse(b){ return b.use || (b.type==='park' ? 'park' : useFor(b.district, b.h, b.seed)); }

// job building-type → the useFor bucket that hosts it (for types useFor never emits)
var BIND_FALLBACK = { cityhall:'office', docks:'warehouse', corp:'office' };

// EXPLICIT world identity for the registry cache (SOL): rebuild on life / WW / KSP / region change,
// not merely when `near` is a fresh object — a resize can mutate WW/KSP under a reused layer.
function peopleWorldKey(){
  var now=(typeof NOWOVR!=='undefined'&&NOWOVR!=null)?NOWOVR:Date.now();
  return lifeIndexOf(now)+'|'+(typeof WW!=='undefined'?WW:0)+'|'+(typeof KSP!=='undefined'?KSP:0)+'|'+(typeof REGION!=='undefined'?REGION:'');
}
// Registry: immutable per world identity. Cached on the layer, keyed. Candidate INDEX pools by role.
function peopleBuildRegistry(near){
  if(!near || !near.blds) return null;
  var key=peopleWorldKey();
  if(near._peopleReg && near._peopleReg.key===key) return near._peopleReg;
  var blds=near.blds, byUse={}, homes=[];
  for(var i=0;i<blds.length;i++){ var u=bldUse(blds[i]);
    (byUse[u]=byUse[u]||[]).push(i);
    if(u==='apartment') homes.push(i);
  }
  if(!homes.length){ for(var k=0;k<blds.length;k++) if(blds[k].type!=='park') homes.push(k); }  // hamlet: any shelter
  near._peopleReg = { key:key, byUse:byUse, homes:homes };
  return near._peopleReg;
}
function workPool(reg, jobBuilding){
  var pool=reg.byUse[jobBuilding];
  if(!pool||!pool.length){ pool=reg.byUse[BIND_FALLBACK[jobBuilding]||'office']; }
  if(!pool||!pool.length){ pool=reg.homes; }
  return pool||[];
}

// rendezvous weight of a candidate building for a given citizen+role salt
function rvw(seed, bId, salt){ return P_hash((seed ^ P_hash((bId*2654435761 ^ salt)>>>0))>>>0); }
// pick the highest-weight STANDING candidate index from a pool (or -1). Stable building id = b.x.
function peoplePick(near, pool, seed, salt, cityG){
  var best=-1, bw=-1;
  for(var i=0;i<pool.length;i++){ var idx=pool[i], b=near.blds[idx];
    if(!buildingStanding(b, cityG)) continue;
    var wgt=rvw(seed, b.x|0, salt);
    if(wgt>bw){ bw=wgt; best=idx; }
  }
  return best;
}
// public: this citizen's currently-embodied home + work building indices (or -1 = not embodied now)
function peopleHomeWork(near, seed, jobBuilding, commutes, cityG){
  var reg=peopleBuildRegistry(near); if(!reg) return {homeB:-1, workB:-1};
  var homeB=peoplePick(near, reg.homes, seed, 0x484F4D45, cityG);        // "HOME"
  var workB=(commutes===false) ? -2 : peoplePick(near, workPool(reg, jobBuilding), seed, 0x574F524B, cityG);  // "WORK"
  return { homeB:homeB, workB:workB };
}

// ---- STATIC EMBODIMENT (Stage 3 step 2): draw named citizens at their home/work building in job
// clothing. Read-only fn of (cached roster, registry, effective clock). Records drawnNamed[] for
// inspect (step 4). Commute (home<->work walking) is step 3. Effective clock only (no Date.now).
var drawnNamed=[];
function drawNamedCitizens(g, now){
  drawnNamed.length=0;
  if(!near || !near.blds) return;
  if(cityG<0.22 || cityPhase==="apoc" || (typeof nukeStruck==='function' && nukeStruck())) return;  // peds handle apoc/flee
  var li=lifeIndexOf(now), cy=cityGrowth(now).cy, C=P_sim(li, cy), pop=C.pop;
  var nd=nowDate(), hh=nd.getHours()+nd.getMinutes()/60, atWork=(hh>=9 && hh<17);
  var cap=(QUAL>=2?PEOPLE_N:(QUAL>=1?120:70)), drawn=0;
  for(var i=0;i<pop.length && drawn<cap;i++){ var p=pop[i];
    if(!p.arrived || !p.alive) continue;
    var J=JOB_TAX[p.job], hw=peopleHomeWork(near, p.seed, J.building, J.commutes, cityG);
    var working=atWork && (hw.workB>=0 || hw.workB===-2);
    var bIdx=working ? (hw.workB>=0?hw.workB:hw.homeB) : hw.homeB;
    if(bIdx<0) continue;
    var b=near.blds[bIdx], wx=b.x + (b.w>>1) + (((p.seed>>>3)%9)-4), sx=disX(wx);
    if(sx<-4 || sx>SW+4) continue;                                   // spatial cull
    var cloth=working ? J.clothes : PEDC[(p.seed>>>0)%PEDC.length];  // work uniform on the clock, civvies off
    var skin=SKINC[(p.seed>>>11)%SKINC.length], bob=Math.floor(now*0.003 + i*2.7)&3;
    drawPerson(g, sx|0, HORIZON-1, cloth, skin, bob, 0);
    drawnNamed.push({idx:p.idx, gen:p.gen, sx:sx|0, y:HORIZON-1, order:drawn});
    drawn++;
  }
}
// ============ end THE PEOPLE — WORLD BINDING + EMBODIMENT ============
