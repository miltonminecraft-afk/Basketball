(()=>{
'use strict';

const U='https://elpnfmlrkoemjrnzaeok.supabase.co';
const K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
let sb=null,data=null,busy=false,isAdmin=false,mode='review',searchValue='';
let items=[],candidates=[],total=0,pending=0;

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
 if(document.getElementById('memberAuditCssV1'))return;
 const s=document.createElement('style');s.id='memberAuditCssV1';s.textContent=`
 .member-audit-overlay[hidden]{display:none!important}.member-audit-overlay{position:fixed;inset:0;z-index:2300;background:rgba(5,6,56,.56);display:flex;align-items:flex-end;justify-content:center}
 .member-audit-sheet{width:min(100%,720px);max-height:92vh;overflow:auto;background:#fff;border-radius:28px 28px 0 0;padding:20px 22px calc(22px + env(safe-area-inset-bottom))}
 .member-audit-head{display:flex;align-items:flex-start;gap:12px}.member-audit-head>div{min-width:0;flex:1}.member-audit-kicker{font-size:10px;color:var(--muted);font-weight:850}.member-audit-title{margin:4px 0 0;font-size:22px;line-height:1.08;color:var(--navy)}.member-audit-close{width:44px;height:44px;flex:0 0 44px;border:0;border-radius:50%;background:#f1f2f6;color:var(--navy);font-size:28px}
 .member-audit-progress{display:flex;align-items:center;gap:10px;margin:12px 0 16px}.member-audit-track{height:5px;flex:1;background:#eceef3;border-radius:999px;overflow:hidden}.member-audit-bar{height:100%;background:var(--navy);border-radius:999px}.member-audit-progress span{font-size:10px;color:var(--muted);font-weight:850;white-space:nowrap}
 .member-audit-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.member-audit-card{border:1px solid var(--line);border-radius:14px;padding:12px;background:#fff}.member-audit-card h3{margin:0 0 8px;font-size:13px;color:var(--navy)}.member-audit-line{display:flex;justify-content:space-between;gap:10px;margin:5px 0;font-size:10px;line-height:1.4}.member-audit-line b{color:var(--navy)}.member-audit-line span{color:var(--muted);text-align:right}
 .member-audit-chips{display:flex;flex-wrap:wrap;gap:6px}.member-audit-chip{display:inline-flex;align-items:center;min-height:27px;padding:5px 8px;border-radius:999px;background:#f1f2f6;color:var(--navy);font-size:9px;font-weight:850}.member-audit-chip.played{background:#f8f1e8;color:#835719}.member-audit-chip.trainer{background:#eef3fb}.member-audit-empty{color:var(--muted);font-size:10px}
 .member-audit-match{margin-top:12px;border:1px solid var(--line);border-radius:14px;padding:12px}.member-audit-match h3{margin:0 0 8px;font-size:13px}.member-audit-match-name{font-size:14px;font-weight:900;color:var(--navy)}.member-audit-helper{color:var(--muted);font-size:9px;line-height:1.45;margin-top:4px}
 .member-audit-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.member-audit-actions button{min-height:46px;border:1px solid var(--line);border-radius:12px;background:#f1f2f6;color:var(--navy);font:inherit;font-size:10px;font-weight:900;padding:10px}.member-audit-actions button.primary{background:var(--navy);color:#fff;border-color:var(--navy)}.member-audit-actions button.wide{grid-column:1/-1}.member-audit-actions button.danger{background:#fff5f5;color:#9b2424}
 .member-audit-search{margin-top:12px}.member-audit-search input{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:12px;padding:11px 12px;font:inherit}.member-audit-list{display:grid;gap:7px;margin-top:10px;max-height:42vh;overflow:auto}.member-audit-person{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:11px 12px;text-align:left;color:var(--navy)}.member-audit-person:disabled{opacity:.46}.member-audit-person strong{display:block;font-size:11px}.member-audit-person small{display:block;color:var(--muted);font-size:9px;margin-top:2px}.member-audit-person b{font-size:9px;white-space:nowrap}
 .member-audit-back{border:0;border-radius:10px;background:#f1f2f6;color:var(--navy);padding:8px 10px;font-size:10px;font-weight:900}
 .member-audit-admin-button{width:100%;margin:0 0 14px!important}
 body.member-audit-open{overflow:hidden}
 @media(max-width:520px){.member-audit-grid{grid-template-columns:1fr}.member-audit-actions{grid-template-columns:1fr}.member-audit-actions button.wide{grid-column:auto}}
 @media(min-width:700px){.member-audit-overlay{align-items:center;padding:20px}.member-audit-sheet{border-radius:24px}}
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
function openAudit(){if(!pending)return;mode='review';searchValue='';overlay().hidden=false;document.body.classList.add('member-audit-open');render()}
async function openOrStartAudit(){
 if(busy||!isAdmin)return;
 if(api.checking){toast('Ledencontrole wordt geladen…');return}
 if(pending){openAudit();return}
 if(!confirm('Een nieuwe volledige ledencontrole starten? Alle actieve leden worden opnieuw gecontroleerd.'))return;
 busy=true;
 try{
  const s=await client(),r=await s.rpc('start_member_bond_audit');
  if(r.error)throw r.error;
  await reload();
  mode='review';searchValue='';
  openAudit();
 }catch(e){toast(e?.message||'Ledencontrole kon niet worden gestart.')}
 finally{busy=false}
}

function listNames(arr){return (arr||[]).map(x=>x.name||x.teamName).filter(Boolean)}
function jerseyText(item){return (item.jerseyNumbers||[]).map(x=>`${x.teamName} #${x.number}`).join(' · ')}
function bondTeamText(arr){return (arr||[]).map(x=>`${x.teamName}${x.number?` #${x.number}`:''}`).join(' · ')}
function candidateText(c){
 const off=bondTeamText(c.officialTeams||[]),played=(c.playedTeams||[]).map(x=>x.teamName).filter(Boolean).join(', '),staff=(c.staffTeams||[]).map(x=>x.teamName).filter(Boolean).join(', ');
 return [off,staff?`coach: ${staff}`:'',played?`meegespeeld: ${played}`:''].filter(Boolean).join(' · ')
}
function currentItem(){return items[0]||null}
function currentCandidate(item){return candidates.find(c=>String(c.personId)===String(item?.linkedPersonId||''))||null}
function jerseyPrivateMatch(item,c){
 if(norm(c?.name)!=='private')return false;
 const nums=item.jerseyNumbers||[];
 return nums.some(j=>(c.officialTeams||[]).some(t=>String(t.teamId)===String(j.teamId)&&String(t.number||'')===String(j.number||'')))
}
function bestSuggestion(item){
 const available=candidates.filter(c=>!c.linkedMemberId||String(c.linkedMemberId)===String(item.memberId));
 const linked=currentCandidate(item);if(linked)return linked;
 const exact=available.filter(c=>strongName(item.name,c.name)).sort((a,b)=>similarity(item.name,b.name)-similarity(item.name,a.name))[0];if(exact)return exact;
 const priv=available.find(c=>jerseyPrivateMatch(item,c));if(priv)return priv;
 return null
}

function chip(s,cls=''){return `<span class="member-audit-chip ${cls}">${esc(s)}</span>`}
function appInfo(item){
 const players=listNames(item.playerTeams),trainers=listNames(item.trainerTeams),jersey=jerseyText(item);
 return `<div class="member-audit-card"><h3>In de app</h3>
 <div class="member-audit-line"><b>Naam</b><span>${esc(item.name||'-')}</span></div>
 <div class="member-audit-line"><b>Speler</b><span>${esc(players.join(', ')||'-')}</span></div>
 <div class="member-audit-line"><b>Trainer</b><span>${esc(trainers.join(', ')||'-')}</span></div>
 <div class="member-audit-line"><b>Rugnummer</b><span>${esc(jersey||'-')}</span></div>
 </div>`
}
function bondInfo(item,c){
 if(!c)return `<div class="member-audit-card"><h3>Basketbalbond</h3><div class="member-audit-empty">Nog geen bondsspeler gekoppeld.</div></div>`;
 const official=c.officialTeams||[],played=c.playedTeams||[],staff=c.staffTeams||[];
 const isPrivate=norm(c.name)==='private';
 const points=item.bond&&String(item.bond.personId)===String(c.personId)?item.bond.seasonPoints:null;
 const complete=item.bond&&String(item.bond.personId)===String(c.personId)?item.bond.seasonPointsComplete:false;
 return `<div class="member-audit-card"><h3>Basketbalbond</h3>
 <div class="member-audit-line"><b>Naam</b><span>${esc(isPrivate?'private (afgeschermd)':c.name)}</span></div>
 <div class="member-audit-chips">${official.map(t=>chip(`${t.teamName}${t.number?` · #${t.number}`:''}`)).join('')}${staff.map(t=>chip(`Coach: ${t.teamName}`,'trainer')).join('')}${played.map(t=>chip(`Meegespeeld: ${t.teamName}`,'played')).join('')||(!official.length&&!staff.length?'<span class="member-audit-empty">Geen teamgegevens</span>':'')}</div>
 ${points!==null?`<div class="member-audit-line" style="margin-top:8px"><b>Seizoenspunten</b><span>${complete?esc(points+' pnt'):esc(points>0?'≥ '+points+' pnt':'-')}</span></div>`:''}
 </div>`
}

function progress(){
 const done=Math.max(0,total-pending),step=Math.min(total,done+1),pct=total?Math.round((done/total)*100):100;
 return {done,step,pct}
}

function renderReview(item){
 const linked=currentCandidate(item),suggested=bestSuggestion(item),shownCandidate=linked||suggested;
 const p=progress();
 const match=shownCandidate?`<div class="member-audit-match"><h3>${linked?'Huidige bondskoppeling':'Waarschijnlijke match'}</h3><div class="member-audit-match-name">${esc(norm(shownCandidate.name)==='private'?'Private speler':shownCandidate.name)}</div><div class="member-audit-helper">${esc(candidateText(shownCandidate)||'Geen extra bondgegevens')}</div></div>`:'';
 const primary=linked
  ?'<button class="primary wide" type="button" data-audit-action="confirm">Klopt, bevestigen & toepassen</button>'
  :(suggested?`<button class="primary wide" type="button" data-audit-link="${esc(suggested.personId)}">Koppel deze bondsspeler</button>`:'');
 return `<div class="member-audit-head"><div><span class="member-audit-kicker">Ledencontrole</span><h2 class="member-audit-title">${esc(item.name)}</h2></div><button class="member-audit-close" type="button" data-member-audit-close>×</button></div>
 <div class="member-audit-progress"><div class="member-audit-track"><div class="member-audit-bar" style="width:${p.pct}%"></div></div><span>${p.step} van ${total} · ${pending} open</span></div>
 <div class="member-audit-grid">${appInfo(item)}${bondInfo(item,shownCandidate)}</div>
 ${match}
 <div class="member-audit-actions">${primary}<button type="button" data-audit-mode="search">Andere bondsspeler</button><button type="button" data-audit-edit>Gegevens aanpassen</button><button class="danger" type="button" data-audit-action="no_bond">Geen bondprofiel</button><button type="button" data-audit-later>Later</button></div>`
}

function renderSearch(item){
 const q=norm(searchValue);
 const rows=candidates
  .filter(c=>!c.linkedMemberId||String(c.linkedMemberId)===String(item.memberId))
  .filter(c=>{if(!q)return true;const hay=norm([c.name,candidateText(c)].join(' '));return hay.includes(q)})
  .sort((a,b)=>{
    const sa=strongName(item.name,a.name)?1:jerseyPrivateMatch(item,a)?.9:0;
    const sb=strongName(item.name,b.name)?1:jerseyPrivateMatch(item,b)?.9:0;
    return sb-sa||String(a.name).localeCompare(String(b.name))
  })
  .slice(0,80);
 return `<div class="member-audit-head"><div><span class="member-audit-kicker">Ledencontrole</span><h2 class="member-audit-title">Bondsspeler kiezen</h2></div><button class="member-audit-close" type="button" data-member-audit-close>×</button></div>
 <button class="member-audit-back" type="button" data-audit-mode="review">← Terug naar ${esc(item.name)}</button>
 <div class="member-audit-search"><input id="memberAuditSearch" type="search" placeholder="Zoek naam, team of rugnummer…" value="${esc(searchValue)}"></div>
 <div class="member-audit-list">${rows.length?rows.map(c=>`<button class="member-audit-person" type="button" data-audit-link="${esc(c.personId)}"><span><strong>${esc(norm(c.name)==='private'?'Private speler':c.name)}</strong><small>${esc(candidateText(c)||'Geen extra gegevens')}</small></span><b>Koppelen</b></button>`).join(''):'<div class="member-audit-empty">Geen bondsspeler gevonden.</div>'}</div>`
}

function render(){
 const host=document.getElementById('memberAuditBody');if(!host)return;
 const item=currentItem();
 if(!item){
  host.innerHTML='<div class="member-audit-head"><div><span class="member-audit-kicker">Ledencontrole</span><h2 class="member-audit-title">Controle afgerond</h2></div><button class="member-audit-close" type="button" data-member-audit-close>×</button></div><div class="member-audit-helper" style="margin-top:14px">Alle leden zijn gecontroleerd.</div>';
  return
 }
 host.innerHTML=mode==='search'?renderSearch(item):renderReview(item);
 host.querySelectorAll('[data-audit-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.auditMode;render()});
 host.querySelectorAll('[data-audit-link]').forEach(b=>b.onclick=()=>submit('link',b.dataset.auditLink));
 host.querySelectorAll('[data-audit-action]').forEach(b=>b.onclick=()=>submit(b.dataset.auditAction,null));
 host.querySelectorAll('[data-audit-later]').forEach(b=>b.onclick=()=>{if(items.length>1){items.push(items.shift());mode='review';render()}else closeAudit()});
 host.querySelectorAll('[data-audit-edit]').forEach(b=>b.onclick=()=>openMemberEditor(item.memberId));
 const search=document.getElementById('memberAuditSearch');
 if(search){search.focus();search.oninput=()=>{searchValue=search.value;render()}}
}

async function submit(action,personId){
 if(busy)return;
 const item=currentItem();if(!item)return;
 if(action==='no_bond'&&!confirm('Dit lid markeren als zonder bondprofiel? De huidige bondskoppeling wordt verwijderd.'))return;
 busy=true;
 try{
  const s=await client(),r=await s.rpc('review_one_time_member_bond_audit',{p_member_id:item.memberId,p_action:action,p_person_id:personId||null});
  if(r.error)throw r.error;
  toast(action==='no_bond'?'Lid gecontroleerd zonder bondprofiel.':'Lid gecontroleerd en opgeslagen.');
  await reload();
  mode='review';searchValue='';
  if(!pending){closeAudit();document.dispatchEvent(new Event('basketball-one-time-member-audit-ready'))}
  else render();
 }catch(e){toast(e?.message||'Ledencontrole kon niet worden opgeslagen.')}finally{busy=false}
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
  b=document.createElement('button');
  b.id='memberAuditAdminButton';
  b.type='button';
  b.className='primary-button member-audit-admin-button';
  b.onclick=openOrStartAudit;
  host.prepend(b)
 }
 const label=api.checking?'Ledencontrole laden…':pending?`Ledencontrole (${pending} open)`:'Ledencontrole starten';
 if(b.textContent!==label)b.textContent=label;
 b.disabled=!!api.checking
}

async function reload(){
 const s=await client(),[r,staff]=await Promise.all([s.rpc('get_one_time_member_bond_audit'),s.rpc('get_one_time_member_bond_staff')]);
 if(r.error)throw r.error;if(staff.error)throw staff.error;
 data=r.data||{};items=Array.isArray(data.items)?data.items:[];candidates=Array.isArray(data.candidates)?data.candidates:[];total=Number(data.total)||0;pending=Number(data.pending)||0;
 const staffRows=Array.isArray(staff.data)?staff.data:[];
 for(const row of staffRows){
  let c=candidates.find(x=>String(x.personId)===String(row.personId));
  if(!c){c={personId:row.personId,name:row.name||'private',linkedMemberId:row.linkedMemberId||null,officialTeams:[],playedTeams:[],staffTeams:[]};candidates.push(c)}
  c.staffTeams=Array.isArray(row.staffTeams)?row.staffTeams:[];
  if(!c.linkedMemberId&&row.linkedMemberId)c.linkedMemberId=row.linkedMemberId;
 }
 for(const item of items){
  if(item.bond){
   const c=candidates.find(x=>String(x.personId)===String(item.bond.personId));
   item.bond.staffTeams=c?.staffTeams||[];
  }
 }
 api.checking=false;api.pending=pending>0;injectAdminButton();
 document.dispatchEvent(new CustomEvent('basketball-one-time-member-audit-state',{detail:{pending,total,complete:!pending}}));
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