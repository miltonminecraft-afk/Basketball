(()=>{
'use strict';

const U='https://elpnfmlrkoemjrnzaeok.supabase.co';
const K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
let sb=null,data=null,busy=false,isAdmin=false,mode='review',searchValue='';
let items=[],candidates=[],directory=[],total=0,pending=0,skippedBond=new Set(),activeBondPersonId=null;

const api=window.BasketballOneTimeMemberAudit={
  checking:true,
  pending:false,
  hasPending(){return !!(this.checking||this.pending)},
  open(){openOrStartAudit()}
};

const esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
function toast(m){const e=document.getElementById('toast');if(!e)return alert(m);e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2600)}
async function client(){if(sb)return sb;const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});return sb}

function distance(a,b){a=norm(a);b=norm(b);if(a===b)return 0;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur}return prev[b.length]}
function similarity(a,b){const x=norm(a),y=norm(b);if(!x||!y)return 0;if(x===y)return 1;const lev=1-distance(x,y)/Math.max(x.length,y.length);const contain=(x.includes(y)||y.includes(x))?0.82:0;const aa=new Set(String(a||'').toLowerCase().split(/\s+/).filter(Boolean)),bb=new Set(String(b||'').toLowerCase().split(/\s+/).filter(Boolean));let common=0;for(const p of aa)if(bb.has(p))common++;const token=(common/Math.max(aa.size,bb.size,1))*0.92;return Math.max(lev,contain,token)}
function strongName(a,b){const x=norm(a),y=norm(b);if(!x||!y||x==='private'||y==='private')return false;if(x===y)return true;return similarity(a,b)>=0.84}

function installCss(){
 if(document.getElementById('memberAuditCssV2'))return;
 document.getElementById('memberAuditCssV1')?.remove();
 const s=document.createElement('style');s.id='memberAuditCssV2';s.textContent=`
 .member-audit-overlay[hidden]{display:none!important}.member-audit-overlay{position:fixed;inset:0;z-index:2300;background:rgba(5,6,56,.56);display:flex;align-items:flex-end;justify-content:center}
 .member-audit-sheet{width:min(100%,720px);max-height:92vh;overflow:auto;background:#fff;border-radius:28px 28px 0 0;padding:20px 22px calc(22px + env(safe-area-inset-bottom))}
 .member-audit-head{display:flex;align-items:flex-start;gap:12px}.member-audit-head>div{min-width:0;flex:1}.member-audit-kicker{font-size:10px;color:var(--muted);font-weight:850}.member-audit-title{margin:4px 0 0;font-size:22px;line-height:1.08;color:var(--navy)}.member-audit-close{width:44px;height:44px;flex:0 0 44px;border:0;border-radius:50%;background:#f1f2f6;color:var(--navy);font-size:28px}
 .member-audit-progress{display:flex;align-items:center;gap:10px;margin:12px 0 16px}.member-audit-track{height:5px;flex:1;background:#eceef3;border-radius:999px;overflow:hidden}.member-audit-bar{height:100%;background:var(--navy);border-radius:999px}.member-audit-progress span{font-size:10px;color:var(--muted);font-weight:850;white-space:nowrap}
 .member-audit-card{border:1px solid var(--line);border-radius:14px;padding:12px;background:#fff;margin-top:10px}.member-audit-card h3{margin:0 0 8px;font-size:13px;color:var(--navy)}.member-audit-name-row{display:flex;justify-content:space-between;gap:12px;align-items:center}.member-audit-name-row b{color:var(--navy);font-size:10px}.member-audit-name-row span{color:var(--muted);font-size:10px;text-align:right}
 .member-audit-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.member-audit-chip{display:inline-flex;align-items:center;min-height:27px;padding:5px 8px;border-radius:999px;background:#f1f2f6;color:var(--navy);font-size:9px;font-weight:850}.member-audit-chip.played{background:#f8f1e8;color:#835719}.member-audit-chip.staff{background:#eef3fb}.member-audit-empty{color:var(--muted);font-size:10px;line-height:1.45}.member-audit-note{margin-top:10px;padding:10px 11px;border-radius:11px;background:#f6f7fa;color:var(--muted);font-size:9px;line-height:1.45}.member-audit-note.warn{background:#fff7ec;color:#79521a}
 .member-audit-actions{display:grid;gap:8px;margin-top:14px}.member-audit-actions.two{grid-template-columns:1fr 1fr}.member-audit-actions button{min-height:46px;border:1px solid var(--line);border-radius:12px;background:#f1f2f6;color:var(--navy);font:inherit;font-size:10px;font-weight:900;padding:10px}.member-audit-actions button.primary{background:var(--navy);color:#fff;border-color:var(--navy)}.member-audit-actions button.danger{background:#fff5f5;color:#9b2424}.member-audit-actions button.wide{grid-column:1/-1}
 .member-audit-search{margin-top:12px}.member-audit-search input,.member-audit-field{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:12px;padding:11px 12px;font:inherit;background:#fff;color:var(--navy)}.member-audit-list{display:grid;gap:7px;margin-top:10px;max-height:42vh;overflow:auto}.member-audit-person{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:11px 12px;text-align:left;color:var(--navy)}.member-audit-person[hidden]{display:none!important}.member-audit-person strong{display:block;font-size:11px}.member-audit-person small{display:block;color:var(--muted);font-size:9px;margin-top:2px}.member-audit-person b{font-size:9px;white-space:nowrap}
 .member-audit-back{border:0;border-radius:10px;background:#f1f2f6;color:var(--navy);padding:8px 10px;font-size:10px;font-weight:900}.member-audit-admin-button{width:100%;margin:0 0 14px!important}.member-audit-create{display:grid;gap:10px;margin-top:12px}.member-audit-create label{display:grid;gap:4px;color:var(--muted);font-size:9px;font-weight:800}
 body.member-audit-open{overflow:hidden}@media(max-width:520px){.member-audit-actions.two{grid-template-columns:1fr}.member-audit-actions button.wide{grid-column:auto}}@media(min-width:700px){.member-audit-overlay{align-items:center;padding:20px}.member-audit-sheet{border-radius:24px}}
 `;document.head.appendChild(s)
}

function overlay(){
 let o=document.getElementById('memberAuditOverlay');if(o)return o;
 o=document.createElement('div');o.id='memberAuditOverlay';o.className='member-audit-overlay';o.hidden=true;
 o.innerHTML='<div class="member-audit-sheet"><div id="memberAuditBody"></div></div>';
 document.body.appendChild(o);
 o.addEventListener('click',e=>{if(e.target===o||e.target.closest('[data-member-audit-close]'))closeAudit()});
 return o
}
function closeAudit(){const o=overlay();o.hidden=true;document.body.classList.remove('member-audit-open')}
function openAudit(){
 if(!openCount())return;
 mode=currentItem()?'review':'bondOnly';searchValue='';activeBondPersonId=null;skippedBond=new Set();
 overlay().hidden=false;document.body.classList.add('member-audit-open');render()
}
function openOrStartAudit(){
 if(busy||!isAdmin)return;
 if(api.checking){toast('Ledencontrole wordt geladen…');return}
 if(openCount()){openAudit();return}
 if(!confirm('Een nieuwe volledige ledencontrole starten? Alle actieve leden worden opnieuw gecontroleerd.'))return;
 busy=true;
 return (async()=>{
  try{const s=await client(),r=await s.rpc('start_member_bond_audit');if(r.error)throw r.error;skippedBond=new Set();await reload();openAudit()}
  catch(e){toast(e?.message||'Ledencontrole kon niet worden gestart.')}
  finally{busy=false}
 })()
}

function sameTeamName(a,b){return norm(a)===norm(b)}
function uniqueStrings(arr){return [...new Set((arr||[]).filter(Boolean))]}
function mergedBondTeams(c){
 const map=new Map();
 const ensure=(teamName,teamId='')=>{
  const key=norm(teamName);if(!key)return null;
  if(!map.has(key))map.set(key,{teamName,teamId,number:'',official:false,coach:false,played:false});
  return map.get(key)
 };
 for(const t of c?.officialTeams||[]){const x=ensure(t.teamName,t.teamId);if(!x)continue;x.official=true;if(t.number)x.number=String(t.number)}
 for(const t of c?.staffTeams||[]){const x=ensure(t.teamName,'');if(x)x.coach=true}
 for(const t of c?.playedTeams||[]){const x=ensure(t.teamName,t.teamId);if(!x)continue;if(!x.official)x.played=true;if(!x.number&&t.number)x.number=String(t.number)}
 return [...map.values()].sort((a,b)=>String(a.teamName).localeCompare(String(b.teamName)))
}
function mergedAppTeams(item){
 const map=new Map();
 const ensure=(teamName,teamId='')=>{
  const key=norm(teamName);if(!key)return null;
  if(!map.has(key))map.set(key,{teamName,teamId,number:'',player:false,trainer:false});
  return map.get(key)
 };
 for(const t of item?.playerTeams||[]){const x=ensure(t.name,t.id);if(x)x.player=true}
 for(const t of item?.trainerTeams||[]){const x=ensure(t.name,t.id);if(x)x.trainer=true}
 for(const j of item?.jerseyNumbers||[]){const x=ensure(j.teamName,j.teamId);if(x&&j.number)x.number=String(j.number)}
 return [...map.values()].sort((a,b)=>String(a.teamName).localeCompare(String(b.teamName)))
}
function bondTeamLabel(t){
 const roles=[];
 if(t.official&&t.coach)roles.push('speler/coach');else if(t.official)roles.push('speler');else if(t.coach)roles.push('coach');
 if(t.played)roles.push('meegespeeld');
 return [t.teamName,t.number?`#${t.number}`:'',...roles].filter(Boolean).join(' · ')
}
function appTeamLabel(t){
 const roles=[];
 if(t.player&&t.trainer)roles.push('speler/trainer');else if(t.player)roles.push('speler');else if(t.trainer)roles.push('trainer');
 return [t.teamName,t.number?`#${t.number}`:'',...roles].filter(Boolean).join(' · ')
}
function candidateText(c){return mergedBondTeams(c).map(bondTeamLabel).join(' · ')}
function currentItem(){return items[0]||null}
function currentCandidate(item){return candidates.find(c=>String(c.personId)===String(item?.linkedPersonId||''))||null}
function jerseyPrivateMatch(item,c){
 if(norm(c?.name)!=='private')return false;
 const nums=item?.jerseyNumbers||[];
 return nums.some(j=>(c.officialTeams||[]).some(t=>String(t.teamId)===String(j.teamId)&&String(t.number||'')===String(j.number||'')))
}
function bestSuggestion(item){
 const linked=currentCandidate(item);if(linked)return linked;
 const available=candidates.filter(c=>!c.linkedMemberId||String(c.linkedMemberId)===String(item.memberId));
 const exact=available.filter(c=>strongName(item.name,c.name)).sort((a,b)=>similarity(item.name,b.name)-similarity(item.name,a.name))[0];if(exact)return exact;
 return available.find(c=>jerseyPrivateMatch(item,c))||null
}
function playerDataMatches(item,c){
 if(!c)return false;
 const app=mergedAppTeams(item).filter(x=>x.player),bond=mergedBondTeams(c).filter(x=>x.official);
 const a=app.map(x=>norm(x.teamName)).sort(),b=bond.map(x=>norm(x.teamName)).sort();
 if(JSON.stringify(a)!==JSON.stringify(b))return false;
 for(const bt of bond){const at=app.find(x=>sameTeamName(x.teamName,bt.teamName));if(!at)return false;if(bt.number&&String(at.number||'')!==String(bt.number))return false}
 return true
}
function unlinkedBondCandidates(){return candidates.filter(c=>!c.linkedMemberId&&norm(c.name)!=='private'&&((c.officialTeams||[]).length||(c.playedTeams||[]).length))}
function visibleBondCandidates(){return unlinkedBondCandidates().filter(c=>!skippedBond.has(String(c.personId)))}
function currentBondCandidate(){
 if(activeBondPersonId){const x=unlinkedBondCandidates().find(c=>String(c.personId)===String(activeBondPersonId));if(x)return x}
 return visibleBondCandidates()[0]||null
}
function openCount(){return pending+unlinkedBondCandidates().length}
function chip(s,cls=''){return `<span class="member-audit-chip ${cls}">${esc(s)}</span>`}
function appInfo(item){
 const teams=mergedAppTeams(item);
 return `<div class="member-audit-card"><h3>In de app</h3><div class="member-audit-name-row"><b>Naam</b><span>${esc(item.name||'-')}</span></div><div class="member-audit-chips">${teams.length?teams.map(t=>chip(appTeamLabel(t))).join(''):'<span class="member-audit-empty">Geen team of rugnummer ingesteld.</span>'}</div></div>`
}
function bondInfo(item,c){
 if(!c)return `<div class="member-audit-card"><h3>Basketbalbond</h3><div class="member-audit-empty">Geen passende bondsspeler gevonden.</div></div>`;
 const teams=mergedBondTeams(c),isPrivate=norm(c.name)==='private';
 const points=item?.bond&&String(item.bond.personId)===String(c.personId)?item.bond.seasonPoints:null;
 const complete=item?.bond&&String(item.bond.personId)===String(c.personId)?item.bond.seasonPointsComplete:false;
 return `<div class="member-audit-card"><h3>Basketbalbond</h3><div class="member-audit-name-row"><b>Naam</b><span>${esc(isPrivate?'private (afgeschermd)':c.name)}</span></div><div class="member-audit-chips">${teams.length?teams.map(t=>chip(bondTeamLabel(t),t.played&&!t.official?'played':t.coach&&!t.official?'staff':'')).join(''):'<span class="member-audit-empty">Geen teamgegevens.</span>'}</div>${points!==null?`<div class="member-audit-note">Seizoenspunten: <b>${complete?esc(points+' pnt'):esc(points>0?'≥ '+points+' pnt':'-')}</b></div>`:''}</div>`
}
function bondOnlyInfo(c){
 const teams=mergedBondTeams(c);
 return `<div class="member-audit-card"><h3>Van de basketbalbond</h3><div class="member-audit-name-row"><b>Naam</b><span>${esc(c.name)}</span></div><div class="member-audit-chips">${teams.map(t=>chip(bondTeamLabel(t),t.played&&!t.official?'played':t.coach&&!t.official?'staff':'')).join('')}</div></div>`
}
function progress(){
 const done=Math.max(0,total-pending),step=Math.min(total,done+1),pct=total?Math.round((done/total)*100):100;
 return {done,step,pct}
}

function renderReview(item){
 const linked=currentCandidate(item),suggested=bestSuggestion(item),shown=linked||suggested,p=progress();
 const same=shown?playerDataMatches(item,shown):false;
 let note='';
 if(!shown)note='<div class="member-audit-note">Dit lid staat in de app, maar er is geen passende speler in de opgehaalde bonddata gevonden.</div>';
 else if(norm(item.name)!==norm(shown.name)&&norm(shown.name)!=='private')note=`<div class="member-audit-note warn">Naam wijkt iets af: <b>${esc(item.name)}</b> ↔ <b>${esc(shown.name)}</b>. Controleer of dit dezelfde persoon is.</div>`;
 else if(!same)note='<div class="member-audit-note warn">Team of rugnummer wijkt af. Controleer de bondgegevens voordat je ze koppelt.</div>';

 let primary='';
 if(shown){
  const label=same?'Klopt met app':'Bondgegevens koppelen';
  primary=linked
   ?`<button class="primary wide" type="button" data-audit-action="confirm">${label}</button>`
   :`<button class="primary wide" type="button" data-audit-link="${esc(shown.personId)}">${label}</button>`;
 }else primary='<button class="primary wide" type="button" data-audit-action="no_bond">Klopt: alleen app-lid</button>';

 return `<div class="member-audit-head"><div><span class="member-audit-kicker">Ledencontrole</span><h2 class="member-audit-title">${esc(item.name)}</h2></div><button class="member-audit-close" type="button" data-member-audit-close>×</button></div>
 <div class="member-audit-progress"><div class="member-audit-track"><div class="member-audit-bar" style="width:${p.pct}%"></div></div><span>${p.step} van ${total} · ${pending} leden open</span></div>
 ${appInfo(item)}${bondInfo(item,shown)}${note}
 <div class="member-audit-actions two">${primary}<button type="button" data-audit-mode="search">Andere bondsspeler</button><button type="button" data-audit-edit>Appgegevens aanpassen</button><button type="button" data-audit-later>Later</button></div>`
}

function renderSearch(item){
 const rows=candidates
  .filter(c=>!c.linkedMemberId||String(c.linkedMemberId)===String(item.memberId))
  .sort((a,b)=>{
   const sa=strongName(item.name,a.name)?2:jerseyPrivateMatch(item,a)?1:0;
   const sb=strongName(item.name,b.name)?2:jerseyPrivateMatch(item,b)?1:0;
   return sb-sa||String(a.name).localeCompare(String(b.name))
  })
  .slice(0,120);
 return `<div class="member-audit-head"><div><span class="member-audit-kicker">Ledencontrole</span><h2 class="member-audit-title">Bondsspeler kiezen</h2></div><button class="member-audit-close" type="button" data-member-audit-close>×</button></div>
 <button class="member-audit-back" type="button" data-audit-mode="review">← Terug naar ${esc(item.name)}</button>
 <div class="member-audit-search"><input id="memberAuditSearch" type="search" autocomplete="off" placeholder="Zoek naam, team of rugnummer…"></div>
 <div class="member-audit-list" id="memberAuditSearchList">${rows.map(c=>`<button class="member-audit-person" type="button" data-audit-link="${esc(c.personId)}" data-search="${esc(norm([c.name,candidateText(c)].join(' ')))}"><span><strong>${esc(norm(c.name)==='private'?'Private speler':c.name)}</strong><small>${esc(candidateText(c)||'Geen extra gegevens')}</small></span><b>Koppelen</b></button>`).join('')||'<div class="member-audit-empty">Geen bondsspeler beschikbaar.</div>'}</div>`
}

function bestExistingMemberForBond(c){
 const available=directory.filter(m=>!m.linkedPersonId);
 const exact=available.filter(m=>strongName(c.name,m.name)).sort((a,b)=>similarity(c.name,b.name)-similarity(c.name,a.name));
 return exact.length===1?exact[0]:null
}
function renderBondOnly(c){
 const remaining=unlinkedBondCandidates().length,suggested=bestExistingMemberForBond(c);
 return `<div class="member-audit-head"><div><span class="member-audit-kicker">Ledencontrole</span><h2 class="member-audit-title">Nieuwe bondsspeler</h2></div><button class="member-audit-close" type="button" data-member-audit-close>×</button></div>
 <div class="member-audit-progress"><div class="member-audit-track"><div class="member-audit-bar" style="width:100%"></div></div><span>${remaining} bondsspeler${remaining===1?'':'s'} niet gekoppeld</span></div>
 ${bondOnlyInfo(c)}
 ${suggested?`<div class="member-audit-note warn">Mogelijk bestaand lid: <b>${esc(suggested.name)}</b>. Controleer dit voordat je koppelt.</div>`:'<div class="member-audit-note">Deze bondsspeler staat nog niet in de ledenlijst.</div>'}
 <div class="member-audit-actions two">
 ${suggested?`<button class="primary wide" type="button" data-bond-link-member="${esc(suggested.memberId)}">Koppelen aan ${esc(suggested.name)}</button>`:'<button class="primary wide" type="button" data-audit-mode="newMember">Nieuw lid toevoegen</button>'}
 <button type="button" data-audit-mode="memberSearch">Koppelen aan bestaand lid</button>
 ${suggested?'<button type="button" data-audit-mode="newMember">Toch nieuw lid</button>':''}
 <button type="button" data-bond-later>Later</button></div>`
}
function renderMemberSearch(c){
 const rows=directory.filter(m=>!m.linkedPersonId).sort((a,b)=>{
  const sa=strongName(c.name,a.name)?1:0,sb=strongName(c.name,b.name)?1:0;
  return sb-sa||String(a.name).localeCompare(String(b.name))
 });
 return `<div class="member-audit-head"><div><span class="member-audit-kicker">Ledencontrole</span><h2 class="member-audit-title">Bestaand lid kiezen</h2></div><button class="member-audit-close" type="button" data-member-audit-close>×</button></div>
 <button class="member-audit-back" type="button" data-audit-mode="bondOnly">← Terug naar ${esc(c.name)}</button>
 <div class="member-audit-search"><input id="memberAuditSearch" type="search" autocomplete="off" placeholder="Zoek bestaand lid…"></div>
 <div class="member-audit-list" id="memberAuditSearchList">${rows.map(m=>{const extra=mergedAppTeams(m).map(appTeamLabel).join(' · ');return `<button class="member-audit-person" type="button" data-bond-link-member="${esc(m.memberId)}" data-search="${esc(norm([m.name,extra].join(' ')))}"><span><strong>${esc(m.name)}</strong><small>${esc(extra||m.email||'Geen teamgegevens')}</small></span><b>Koppelen</b></button>`}).join('')||'<div class="member-audit-empty">Geen beschikbaar bestaand lid.</div>'}</div>`
}
function renderNewMember(c){
 const teams=mergedBondTeams(c).filter(t=>t.official);
 return `<div class="member-audit-head"><div><span class="member-audit-kicker">Ledencontrole</span><h2 class="member-audit-title">Nieuw lid toevoegen</h2></div><button class="member-audit-close" type="button" data-member-audit-close>×</button></div>
 <button class="member-audit-back" type="button" data-audit-mode="bondOnly">← Terug naar ${esc(c.name)}</button>${bondOnlyInfo(c)}
 <form id="memberAuditCreateForm" class="member-audit-create"><label>Naam<input class="member-audit-field" id="memberAuditCreateName" required value="${esc(c.name)}"></label><label>E-mail (optioneel)<input class="member-audit-field" id="memberAuditCreateEmail" type="email"></label><label>Telefoon (optioneel)<input class="member-audit-field" id="memberAuditCreatePhone" type="tel"></label><div class="member-audit-note">Team en rugnummer worden vanuit de bondgegevens gekoppeld.${teams.length?` Officieel team: <b>${esc(teams.map(t=>bondTeamLabel(t)).join(' · '))}</b>`:''}</div><div class="member-audit-actions"><button class="primary wide" type="submit">Lid toevoegen en koppelen</button></div></form>`
}
function renderDone(){
 return `<div class="member-audit-head"><div><span class="member-audit-kicker">Ledencontrole</span><h2 class="member-audit-title">Controle afgerond</h2></div><button class="member-audit-close" type="button" data-member-audit-close>×</button></div><div class="member-audit-note" style="margin-top:14px">Alle app-leden zijn gecontroleerd en alle benoemde bondsspelers zijn gekoppeld of toegevoegd. Private bondsspelers blijven alleen op team en rugnummer opgeslagen totdat een lid zichzelf daarmee kan koppelen.</div>`
}
function render(){
 const host=document.getElementById('memberAuditBody');if(!host)return;
 const item=currentItem(),bond=currentBondCandidate();
 if(item){
  if(mode!=='search')mode='review';
  host.innerHTML=mode==='search'?renderSearch(item):renderReview(item)
 }else if(bond){
  activeBondPersonId=bond.personId;
  if(!['bondOnly','memberSearch','newMember'].includes(mode))mode='bondOnly';
  host.innerHTML=mode==='memberSearch'?renderMemberSearch(bond):mode==='newMember'?renderNewMember(bond):renderBondOnly(bond)
 }else host.innerHTML=renderDone();

 host.querySelectorAll('[data-audit-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.auditMode;searchValue='';render()});
 host.querySelectorAll('[data-audit-link]').forEach(b=>b.onclick=()=>submit('link',b.dataset.auditLink));
 host.querySelectorAll('[data-audit-action]').forEach(b=>b.onclick=()=>submit(b.dataset.auditAction,null));
 host.querySelectorAll('[data-audit-later]').forEach(b=>b.onclick=()=>{if(items.length>1){items.push(items.shift());mode='review';render()}else{mode='bondOnly';render()}});
 host.querySelectorAll('[data-audit-edit]').forEach(b=>b.onclick=()=>openMemberEditor(item.memberId));
 host.querySelectorAll('[data-bond-link-member]').forEach(b=>b.onclick=()=>linkBondToExisting(b.dataset.bondLinkMember));
 host.querySelectorAll('[data-bond-later]').forEach(b=>b.onclick=()=>{if(bond)skippedBond.add(String(bond.personId));activeBondPersonId=null;mode='bondOnly';if(!visibleBondCandidates().length)closeAudit();else render()});

 const search=document.getElementById('memberAuditSearch');
 if(search){
  search.focus();
  search.oninput=()=>{
   const q=norm(search.value);
   host.querySelectorAll('#memberAuditSearchList [data-search]').forEach(row=>row.hidden=!!q&&!String(row.dataset.search||'').includes(q))
  }
 }
 const create=document.getElementById('memberAuditCreateForm');
 if(create)create.onsubmit=e=>createMemberFromBond(e,bond)
}

async function submit(action,personId){
 if(busy)return;
 const item=currentItem();if(!item)return;
 if(action==='no_bond'&&!confirm('Dit lid alleen in de app houden en zonder bondprofiel markeren?'))return;
 busy=true;
 try{
  const s=await client(),r=await s.rpc('review_one_time_member_bond_audit',{p_member_id:item.memberId,p_action:action,p_person_id:personId||null});
  if(r.error)throw r.error;
  toast(action==='no_bond'?'App-lid bevestigd zonder bondprofiel.':'Lid gecontroleerd en opgeslagen.');
  await reload();
  mode=currentItem()?'review':'bondOnly';searchValue='';
  renderOrClose()
 }catch(e){toast(e?.message||'Ledencontrole kon niet worden opgeslagen.')}
 finally{busy=false}
}

function renderOrClose(){
 api.pending=openCount()>0;injectAdminButton();
 if(openCount())render();
 else{render();setTimeout(()=>closeAudit(),900)}
}
async function linkBondToExisting(memberId){
 if(busy)return;const c=currentBondCandidate();if(!c)return;busy=true;
 try{const s=await client(),r=await s.rpc('resolve_foys_member_review',{p_person_id:c.personId,p_member_id:memberId});if(r.error)throw r.error;toast('Bondsspeler gekoppeld aan bestaand lid.');skippedBond.delete(String(c.personId));activeBondPersonId=null;await reload();mode=currentItem()?'review':'bondOnly';renderOrClose()}
 catch(e){toast(e?.message||'Koppelen mislukt.')}finally{busy=false}
}
async function createMemberFromBond(e,candidate){
 e.preventDefault();if(busy||!candidate)return;
 const name=document.getElementById('memberAuditCreateName')?.value.trim()||'';if(!name)return;
 busy=true;
 try{
  const s=await client(),teamIds=uniqueStrings((candidate.officialTeams||[]).map(t=>t.teamId).filter(Boolean));
  const r=await s.rpc('create_member_from_foys_player',{p_person_id:candidate.personId,p_full_name:name,p_email:document.getElementById('memberAuditCreateEmail')?.value.trim()||null,p_phone:document.getElementById('memberAuditCreatePhone')?.value.trim()||null,p_team_ids:teamIds});
  if(r.error)throw r.error;toast('Nieuw lid toegevoegd en gekoppeld.');skippedBond.delete(String(candidate.personId));activeBondPersonId=null;await reload();mode=currentItem()?'review':'bondOnly';renderOrClose()
 }catch(err){toast(err?.message||'Lid toevoegen mislukt.')}finally{busy=false}
}
function openMemberEditor(memberId){
 closeAudit();
 const club=document.querySelector('.tab[data-view="club"]');club?.click();
 setTimeout(()=>{
  const admin=document.querySelector('#clubTabs [data-clubview="admin"]');admin?.click();
  setTimeout(()=>{
   document.querySelector('#adminTabs [data-adminview="members"]')?.click();
   setTimeout(()=>document.querySelector(`[data-edit-member="${CSS.escape(String(memberId))}"]`)?.click(),120)
  },120)
 },120)
}

function injectAdminButton(){
 const host=document.getElementById('admin-members');if(!host)return;
 let b=document.getElementById('memberAuditAdminButton');
 if(!isAdmin){b?.remove();return}
 if(!b){
  b=document.createElement('button');b.id='memberAuditAdminButton';b.type='button';b.className='primary-button member-audit-admin-button';b.onclick=openOrStartAudit;host.prepend(b)
 }
 const count=openCount(),label=api.checking?'Ledencontrole laden…':count?`Ledencontrole (${count} open)`:'Ledencontrole starten';
 if(b.textContent!==label)b.textContent=label;
 b.disabled=!!api.checking
}

async function reload(){
 const s=await client(),[r,staff,dir]=await Promise.all([
  s.rpc('get_one_time_member_bond_audit'),
  s.rpc('get_one_time_member_bond_staff'),
  s.rpc('get_member_bond_audit_directory')
 ]);
 if(r.error)throw r.error;if(staff.error)throw staff.error;if(dir.error)throw dir.error;
 data=r.data||{};items=Array.isArray(data.items)?data.items:[];candidates=Array.isArray(data.candidates)?data.candidates:[];directory=Array.isArray(dir.data)?dir.data:[];total=Number(data.total)||0;pending=Number(data.pending)||0;
 const staffRows=Array.isArray(staff.data)?staff.data:[];
 for(const row of staffRows){
  let candidate=candidates.find(x=>String(x.personId)===String(row.personId));
  if(!candidate){candidate={personId:row.personId,name:row.name||'private',linkedMemberId:row.linkedMemberId||null,officialTeams:[],playedTeams:[],staffTeams:[]};candidates.push(candidate)}
  candidate.staffTeams=Array.isArray(row.staffTeams)?row.staffTeams:[];
  if(!candidate.linkedMemberId&&row.linkedMemberId)candidate.linkedMemberId=row.linkedMemberId
 }
 for(const item of items){
  if(item.bond){
   const candidate=candidates.find(x=>String(x.personId)===String(item.bond.personId));
   item.bond.staffTeams=candidate?.staffTeams||[]
  }
 }
 if(activeBondPersonId&&!unlinkedBondCandidates().some(x=>String(x.personId)===String(activeBondPersonId)))activeBondPersonId=null;
 api.checking=false;api.pending=openCount()>0;injectAdminButton();
 document.dispatchEvent(new CustomEvent('basketball-one-time-member-audit-state',{detail:{pending:openCount(),memberPending:pending,total,complete:openCount()===0}}));
 return data
}

async function check(){
 try{
  const s=await client(),ses=await s.auth.getSession();
  if(!ses.data.session){isAdmin=false;api.checking=false;api.pending=false;injectAdminButton();return}
  const m=await s.rpc('sync_current_member');
  if(m.error||m.data?.role!=='admin'||!m.data?.active){isAdmin=false;api.checking=false;api.pending=false;injectAdminButton();return}
  isAdmin=true;
  await reload()
 }catch(e){
  isAdmin=false;api.checking=false;api.pending=false;injectAdminButton();
  console.warn('Ledencontrole',e)
 }finally{
  document.dispatchEvent(new Event('basketball-one-time-member-audit-ready'))
 }
}

function init(){
 installCss();overlay();
 setTimeout(()=>check(),700);
 document.addEventListener('basketball-admin-members-rendered',injectAdminButton);
 document.addEventListener('basketball-club-rendered',injectAdminButton);
 document.addEventListener('basketball-club-view-changed',injectAdminButton);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay().hidden)closeAudit()});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();