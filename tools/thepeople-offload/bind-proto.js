// Stage 3 registry module (SOL step 1). Engine-side; developed + tested here, then spliced into the
// draw path of city.js. Design points from SOL's review:
//  - functional type is b.use (fallback: useFor(district,h,seed)); b.type is "tower"/"park".
//  - IMMUTABLE binding (which buildings COULD be my home/work) is separated from DYNAMIC standing
//    (is a given candidate built & not destroyed right now).
//  - each citizen gets a RENDEZVOUS-HASHED ranked candidate list per role; each frame we pick the
//    highest-weight candidate that passes ONE shared buildingStanding() predicate. Destroyed/unborn
//    candidate → fall through to the next; none standing → citizen not embodied (no vague fallback).
//  - bezel-sync only (same WW/KSP ⇒ same near.blds ⇒ same binding); NOT cross-shell identity.
'use strict';

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

if(typeof module!=='undefined') module.exports={ buildingBuilt, buildingStanding, bldUse, peopleBuildRegistry, workPool, peoplePick, peopleHomeWork, BIND_FALLBACK };
