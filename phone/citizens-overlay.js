// THE PEOPLE (v2.0) — shared Citizens overlay for the web + phone shells.
// Self-contained: injects its own button + panel + CSS, reads the engine's read-only projections
// (window.peopleRoster) at the SAME clock the city is rendering (NOWOVR-aware), never touches state.
// Kept byte-identical between web/ and phone/ (like city.js). Edit web/, then copy to phone/.
(function(){
  'use strict';
  if (typeof document === 'undefined') return;
  var st = { q:'', klass:-1, dead:false, open:false };
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function hex(c){ return /^#[0-9a-fA-F]{3,8}$/.test(c)?c:'#888888'; }   // validate before it enters a style attr

  var CSS = ''
    + '#clzBtn{position:fixed;right:12px;bottom:12px;z-index:40;font:12px/1 ui-monospace,Menlo,Consolas,monospace;'
    + 'color:#39e6ff;background:rgba(14,18,28,.9);border:1px solid #2a3550;border-radius:20px;padding:9px 14px;cursor:pointer;backdrop-filter:blur(8px)}'
    + '#clzBtn:hover{border-color:#39e6ff}'
    + '#clzPanel{position:fixed;inset:0 0 0 auto;width:min(460px,100%);z-index:41;background:rgba(6,8,13,.97);border-left:1px solid #2a3550;'
    + 'transform:translateX(102%);transition:transform .22s ease;display:flex;flex-direction:column;font:13px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#e6ecf7}'
    + '#clzPanel.on{transform:none}'
    + '.clz-hd{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #2a3550}'
    + '.clz-hd h2{margin:0;font-size:14px;letter-spacing:1px;color:#39e6ff;text-transform:uppercase;flex:1}'
    + '.clz-x{background:none;border:1px solid #2a3550;color:#e6ecf7;border-radius:7px;padding:5px 10px;cursor:pointer}'
    + '.clz-body{overflow:auto;padding:12px 14px 40px;flex:1}'
    + '.clz-sum{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:11px}'
    + '.clz-s{background:#10151f;border:1px solid #2a3550;border-radius:9px;padding:6px 10px;font-size:11px;color:#93a2c0}'
    + '.clz-s b{display:block;color:#39e6ff;font-size:14px}'
    + '.clz-s.m b{color:#ffd76a;font-size:12px}'
    + '.clz-ctl{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px}'
    + '.clz-ctl input{flex:1;min-width:150px;font:inherit;color:#e6ecf7;background:#0f1626;border:1px solid #2a3550;border-radius:7px;padding:6px 9px}'
    + '.clz-chip{font-size:11px;padding:4px 9px;border-radius:16px;border:1px solid #2a3550;background:#0d1119;color:#e6ecf7;cursor:pointer}'
    + '.clz-chip.on{border-color:#39e6ff;color:#39e6ff}'
    + '.clz-c{background:#10151f;border:1px solid #2a3550;border-radius:10px;padding:9px 11px;margin-bottom:8px;position:relative;overflow:hidden}'
    + '.clz-c.dead{opacity:.55}'
    + '.clz-c::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--sw,#888)}'
    + '.clz-n{font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}'
    + '.clz-b{font-size:9px;font-weight:700;padding:1px 5px;border-radius:6px;letter-spacing:.4px}'
    + '.clz-b.mayor{background:#ffd76a;color:#1a1400}.clz-b.council{background:#7ea8ff;color:#04102a}.clz-b.rap{background:#ff5e6e;color:#2a0006}'
    + '.clz-j{font-size:11px;color:#39e6ff;margin:2px 0}'
    + '.clz-l{font-size:11px;color:#93a2c0;margin-top:2px}'
    + '.clz-k{display:inline-block;font-size:10px;padding:1px 6px;border-radius:5px;background:#0a0d14;border:1px solid #2a3550}'
    + '.clz-k0{color:#e08a7a}.clz-k1{color:#c9cfda}.clz-k2{color:#7ad6a0}.clz-k3{color:#ffd76a}'
    + '.clz-e{color:#93a2c0;text-align:center;padding:20px}';

  function ensureDom(){
    if (document.getElementById('clzBtn')) return;
    var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
    var b = document.createElement('button'); b.id='clzBtn'; b.textContent='◉ Citizens'; b.title='See everyone living in the city';
    b.addEventListener('click', function(){ st.open=true; render(); });
    document.body.appendChild(b);
    var p = document.createElement('div'); p.id='clzPanel';
    p.innerHTML = '<div class="clz-hd"><h2>Citizens</h2><button class="clz-x" id="clzClose">Close</button></div>'
      + '<div class="clz-body"><div class="clz-sum" id="clzSum"></div><div class="clz-ctl"><input id="clzSearch" type="search" placeholder="Search a name or job…" autocomplete="off"><span id="clzFil"></span></div><div id="clzList"></div></div>';
    document.body.appendChild(p);
    document.getElementById('clzClose').addEventListener('click', function(){ st.open=false; p.classList.remove('on'); });
    document.getElementById('clzSearch').addEventListener('input', function(){ st.q=this.value; render(); });
  }

  function card(p){
    var badge = p.office===2?'<span class="clz-b mayor">MAYOR</span>':p.office===1?'<span class="clz-b council">COUNCIL</span>':'';
    var rap = p.crimes>0?'<span class="clz-b rap">RAP SHEET</span>':'';
    var fam=[]; if(p.spouseName) fam.push('married to '+esc(p.spouseName.split(' ')[0]));
    if(p.kidCount>0) fam.push(p.kidCount+' child'+(p.kidCount>1?'ren':''));
    if(p.parents&&p.parents.length) fam.push('child of '+esc(p.parents.map(function(x){return x.split(' ')[0];}).join(' & ')));
    var life=['Age '+p.age]; if(p.retired) life.push('retired'); if(!p.alive) life.unshift('the late');
    return '<div class="clz-c'+(p.alive?'':' dead')+'" style="--sw:'+hex(p.clothes)+'">'
      + '<div class="clz-n">'+esc(p.name)+badge+rap+'</div>'
      + '<div class="clz-j">'+esc(p.job)+(p.verb?' · '+esc(p.verb):'')+'</div>'
      + '<div class="clz-l"><span class="clz-k clz-k'+p.klass+'">'+esc(p.klassName)+'</span> · $'+p.netWorth.toLocaleString()+' · '+esc(p.partyName)+'</div>'
      + '<div class="clz-l">'+life.join(' · ')+(fam.length?' · '+fam.join(' · '):'')+(p.crimes>0?' · '+p.crimes+' offence'+(p.crimes>1?'s':''):'')+'</div>'
      + '</div>';
  }

  function render(){
    ensureDom();
    var panel = document.getElementById('clzPanel');
    if (st.open) panel.classList.add('on'); else { panel.classList.remove('on'); return; }
    var sum=document.getElementById('clzSum'), fil=document.getElementById('clzFil'), list=document.getElementById('clzList');
    if (typeof window.peopleRoster !== 'function'){ list.innerHTML='<div class="clz-e">The city engine is still loading…</div>'; sum.innerHTML=''; return; }
    var now = (window.NOWOVR!=null)?window.NOWOVR:Date.now(), R;   // mirror the city being rendered (time-scrub aware)
    try { R = window.peopleRoster(now, window.lifeIndexOf(now), window.cityGrowth(now).cy); }
    catch(e){ list.innerHTML='<div class="clz-e">Citizens error: '+esc(e.message||e)+'</div>'; return; }
    var s=R.stats;
    sum.innerHTML = '<div class="clz-s"><b>'+s.pop+'</b>living</div>'
      + '<div class="clz-s m"><b>'+(R.mayor?esc(R.mayor.name):'no mayor yet')+'</b>'+(R.mayor?esc(R.mayor.job):'awaiting election')+'</div>'
      + '<div class="clz-s"><b>'+Math.round(s.unemp*100)+'%</b>unemployed</div>'
      + '<div class="clz-s"><b>'+Math.round(s.poorPct*100)+'/'+Math.round(s.richPct*100)+'%</b>poor/rich</div>'
      + '<div class="clz-s"><b>'+(Math.round(s.gini*100)/100)+'</b>Gini</div>'
      + '<div class="clz-s"><b>'+s.crimeTotal+'</b>offences</div>';
    var chips=[['Everyone',-1],['Poor',0],['Working',1],['Pro',2],['Wealthy',3]];
    fil.innerHTML = chips.map(function(c){ return '<span class="clz-chip'+(st.klass===c[1]?' on':'')+'" data-k="'+c[1]+'">'+c[0]+'</span>'; }).join('')
      + '<span class="clz-chip'+(st.dead?' on':'')+'" data-dead="1">Memoriam ('+R.dead.length+')</span>';
    Array.prototype.forEach.call(fil.querySelectorAll('[data-k]'), function(ch){ ch.addEventListener('click', function(){ st.klass=+ch.dataset.k; render(); }); });
    Array.prototype.forEach.call(fil.querySelectorAll('[data-dead]'), function(ch){ ch.addEventListener('click', function(){ st.dead=!st.dead; render(); }); });
    var pool = (st.dead?R.dead:R.living).slice();
    if (st.klass>=0) pool = pool.filter(function(p){ return p.klass===st.klass; });
    var q = st.q.trim().toLowerCase();
    if (q) pool = pool.filter(function(p){ return p.name.toLowerCase().indexOf(q)>=0 || p.job.toLowerCase().indexOf(q)>=0; });
    list.innerHTML = pool.length ? pool.map(card).join('')
      : '<div class="clz-e">'+(R.cy<0.06?'The city is barely founded — the first citizens are still arriving.':'No one matches that.')+'</div>';
  }

  // ---- INSPECT: tap a citizen on the wallpaper to see who they are ----
  var INSPECT_CSS = ''
    + '#clzInspect{position:fixed;z-index:42;max-width:230px;background:rgba(8,11,17,.97);border:1px solid #2a3550;border-radius:11px;'
    + 'padding:10px 12px;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;color:#e6ecf7;box-shadow:0 10px 34px rgba(0,0,0,.5)}'
    + '#clzInspect .in-x{position:absolute;top:6px;right:8px;cursor:pointer;color:#93a2c0}'
    + '#clzInspect .in-n{font-weight:600;font-size:14px;padding-right:14px}'
    + '#clzInspect .in-j{color:#39e6ff;margin:2px 0}'
    + '#clzInspect .in-l{color:#93a2c0;margin-top:3px}'
    + '#clzInspect .in-badge{display:inline-block;font-size:9px;font-weight:700;padding:1px 5px;border-radius:6px;margin-left:5px}'
    + '#clzInspect .mayor{background:#ffd76a;color:#1a1400}#clzInspect .council{background:#7ea8ff;color:#04102a}#clzInspect .rap{background:#ff5e6e;color:#2a0006}';
  var inspectEl=null;
  function hideInspect(){ if(inspectEl){ inspectEl.remove(); inspectEl=null; } }
  function showInspect(c, px, py){
    hideInspect();
    var badge = c.office===2?'<span class="in-badge mayor">MAYOR</span>':c.office===1?'<span class="in-badge council">COUNCIL</span>':'';
    if(c.crimes>0) badge+='<span class="in-badge rap">RAP SHEET</span>';
    var fam=[]; if(c.spouseName) fam.push('married to '+esc(c.spouseName.split(' ')[0]));
    if(c.kidCount>0) fam.push(c.kidCount+' child'+(c.kidCount>1?'ren':''));
    if(c.parents&&c.parents.length) fam.push('child of '+esc(c.parents.map(function(x){return x.split(' ')[0];}).join(' & ')));
    var el=document.createElement('div'); el.id='clzInspect';
    el.innerHTML='<span class="in-x">✕</span>'
      + '<div class="in-n" style="border-left:3px solid '+hex(c.clothes)+';padding-left:6px">'+esc(c.name)+badge+'</div>'
      + '<div class="in-j">'+esc(c.job)+(c.verb?' · '+esc(c.verb):'')+'</div>'
      + '<div class="in-l">'+esc(c.klassName)+' · $'+c.netWorth.toLocaleString()+' · '+esc(c.partyName)+'</div>'
      + '<div class="in-l">Age '+c.age+(c.retired?' · retired':'')+(fam.length?' · '+fam.join(' · '):'')+(c.crimes>0?' · '+c.crimes+' offence'+(c.crimes>1?'s':''):'')+'</div>'
      + (c.jobDesc?'<div class="in-l" style="opacity:.8;font-style:italic">'+esc(c.jobDesc)+'</div>':'');
    document.body.appendChild(el);
    var w=el.offsetWidth, h=el.offsetHeight;
    el.style.left=Math.max(6, Math.min(px-w/2, window.innerWidth-w-6))+'px';
    el.style.top=Math.max(6, (py-h-14))+'px';                 // above the tap; flip below if off-screen
    if(py-h-14<6) el.style.top=(py+18)+'px';
    el.querySelector('.in-x').addEventListener('click', hideInspect);
    inspectEl=el;
  }
  function bindInspect(){
    var s=document.createElement('style'); s.textContent=INSPECT_CSS; document.head.appendChild(s);
    var cv=document.getElementById('cv')||document.querySelector('canvas'); if(!cv) return;
    var down=null;
    window.addEventListener('pointerdown', function(e){ down={x:e.clientX,y:e.clientY,t:e.timeStamp}; }, true);
    window.addEventListener('pointerup', function(e){
      var dn=down; down=null; if(!dn) return;
      if(st.open) return;                                     // roster panel open → ignore taps
      if(e.target && e.target.closest && e.target.closest('#clzInspect,#clzBtn,#clzPanel,#bar,#hot')) return;
      var moved=Math.abs(e.clientX-dn.x)+Math.abs(e.clientY-dn.y);
      if(moved>6 || (e.timeStamp-dn.t)>500) return;           // a drag/scrub, not a tap
      if(typeof window.peopleInspectAt!=='function'){ return; }
      var r=cv.getBoundingClientRect(), z=(window.ZOOM||1);
      var sx=((e.clientX-r.left)*(cv.width/r.width))/z, sy=((e.clientY-r.top)*(cv.height/r.height))/z;
      var c=window.peopleInspectAt(sx, sy);
      if(c) showInspect(c, e.clientX, e.clientY); else hideInspect();
    }, true);
  }

  // build the button once the engine + DOM are ready
  function boot(){ ensureDom(); bindInspect(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
