(()=>{
'use strict';
const U='https://elpnfmlrkoemjrnzaeok.supabase.co',K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
let sb=null,state={reviews:[],members:[],teams:[]},busy=false,startupShown=false,viewMode='choose',reviewSessionTotal=0,reviewSessionStep=1;
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
function toast(m){const e=document.getElementById('toast');if(!e)return alert(m);e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2600)}
async function client(){if(sb)return sb;const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});return sb}
function distance(a,b){a=norm(a);b=norm(b);if(a===b)return 0;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur}return prev[b.length]}
function similarity(a,b){const x=norm(a),y=norm(b);if(!x||!y)return 0;if(x===y)return 1;const lev=1-distance(x,y)/Math.max(x.length,y.length);const contain=(x.includes(y)||y.includes(x))?0.82:0;const aa=new Set(String(a||'').toLowerCase().split(/\s+/).filter(Boolean)),bb=new Set(String(b||'').toLowerCase().split(/\s+/).filter(Boolean));let common=0;for(const p of aa)if(bb.has(p))common++;const token=(common/Math.max(aa.size,bb.size,1))*0.92;return Math.max(lev,contain,token)}
function strongNameMatch(a,b){const x=norm(a),y=norm(b);if(!x||!y||x==='private'||y==='private')return false;if(x===y)return true;return similarity(a,b)>=0.84}
function suggestions(r){
 const isPrivate=String(r?.sourceName||'').trim().toLowerCase()==='private';
 const suggested=state.members.find(m=>String(m.id)===String(r?.suggestedMemberId||''));
 const out=[];
 if(suggested&&(isPrivate||strongNameMatch(r.sourceName,suggested.name)))out.push({...suggested,score:1,suggested:true});
 if(!isPrivate){
  const rest=state.members.map(m=>({...m,score:similarity(r.sourceName,m.name)}))
   .filter(m=>strongNameMatch(r.sourceName,m.name)&&String(m.id)!==String(suggested?.id||''))
   .sort((a,b)=>b.score-a.score||String(a.name).localeCompare(String(b.name)));
  out.push(...rest);
 }
 return out.slice(0,3)
}
function installCss(){
 if(document.getElementById('foysReviewCssV3'))return;
 const s=document.createElement('style');s.id='foysReviewCssV3';s.textContent=`
 .foys-review-overlay[hidden]{display:none!important}.foys-review-overlay{position:fixed;inset:0;z-index:2200;background:rgba(5,6,56,.55);display:flex;align-items:flex-end;justify-content:center}
 .foys-review-sheet{width:min(100%,680px);max-height:90vh;overflow:auto;background:#fff;border-radius:28px 28px 0 0;padding:20px 22px calc(22px + env(safe-area-inset-bottom))}
 .foys-review-head{display:flex;gap:12px;align-items:flex-start}.foys-review-head>div{min-width:0;flex:1}.foys-review-kicker{font-size:10px;color:var(--muted);font-weight:850}.foys-review-title{margin:4px 0 0;color:var(--navy);font-size:22px;line-height:1.08}.foys-review-close{width:44px;height:44px;flex:0 0 44px;border:0;border-radius:50%;background:#f1f2f6;color:var(--navy);font-size:28px}
 .foys-review-progress{display:flex;align-items:center;gap:10px;margin-top:12px}.foys-review-progress-track{height:5px;flex:1;border-radius:999px;background:#eceef3;overflow:hidden}.foys-review-progress-bar{height:100%;background:var(--navy);border-radius:999px}.foys-review-progress-text{font-size:10px;color:var(--muted);font-weight:800;white-space:nowrap}
 .foys-review-chips{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 2px}.foys-review-chip{display:inline-flex;align-items:center;min-height:28px;padding:5px 9px;border-radius:999px;background:#f2f3f7;color:var(--navy);font-size:10px;font-weight:850}.foys-review-chip.played{background:#f7f1e9;color:#895818}.foys-review-chip.private{background:#fff4e8;color:#8d4e00}
 .foys-review-private-note{margin-top:12px;padding:11px 12px;border-radius:12px;background:#fff7ec;color:#6d490f;font-size:10px;line-height:1.45;font-weight:700}
 .foys-review-block{border-top:1px solid var(--line);padding-top:14px;margin-top:16px}.foys-review-block h3{margin:0 0 5px;color:var(--navy);font-size:15px}.foys-review-helper{margin:0 0 12px;color:var(--muted);font-size:10px;line-height:1.45}
 .foys-review-choice-grid{display:grid;gap:9px}.foys-review-choice{display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;border:1px solid var(--line);border-radius:14px;background:#fff;padding:13px 14px;text-align:left;color:var(--navy)}.foys-review-choice strong{display:block;font-size:12px}.foys-review-choice small{display:block;margin-top:3px;color:var(--muted);font-size:9px;font-weight:650;line-height:1.35}.foys-review-choice .arrow{font-size:20px;font-weight:900}.foys-review-choice.primary{background:var(--navy);color:#fff;border-color:var(--navy)}.foys-review-choice.primary small{color:rgba(255,255,255,.78)}
 .foys-review-back{border:0;background:#f1f2f6;color:var(--navy);border-radius:10px;padding:8px 10px;font-size:10px;font-weight:900;margin-bottom:10px}
 .foys-review-suggestion{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;margin:0 0 7px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:11px 12px;text-align:left;font-weight:850;color:var(--navy)}.foys-review-suggestion>span:first-child{min-width:0}.foys-review-suggestion small{display:block;color:var(--muted);font-weight:650;white-space:normal}.foys-review-suggestion b{font-size:10px;white-space:nowrap}
 .foys-review-match-card{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--line);border-radius:12px;padding:10px 11px;background:#fff}.foys-review-match-card>span{min-width:0}.foys-review-match-card strong{display:block;font-size:13px}.foys-review-match-card small{display:block;margin-top:2px;color:var(--muted);font-size:9px;font-weight:650}.foys-review-match-card button{border:0;border-radius:10px;background:var(--navy);color:#fff;padding:9px 11px;font-size:10px;font-weight:900;white-space:nowrap}
 .foys-review-action-block{padding-top:12px;margin-top:12px}.foys-review-mini-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.foys-review-mini-actions button{min-height:42px;border:1px solid var(--line);border-radius:11px;background:#f2f3f7;color:var(--navy);padding:8px 9px;font:inherit;font-size:10px;font-weight:900}.foys-review-mini-actions button.primary{background:var(--navy);color:#fff;border-color:var(--navy)}
 @media(max-width:440px){.foys-review-mini-actions{grid-template-columns:1fr 1fr}.foys-review-mini-actions button:last-child{grid-column:1/-1}}
 .foys-review-search{margin:10px 0 8px}.foys-review-search input,.foys-review-input{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:12px;padding:11px 12px;background:#fff;color:var(--navy);font:inherit}.foys-review-member-list{display:grid;gap:6px;max-height:240px;overflow:auto}.foys-review-member-list .foys-review-suggestion[hidden]{display:none!important}
 .foys-review-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.foys-review-primary,.foys-review-secondary{border:0;border-radius:12px;padding:10px 13px;font-weight:900}.foys-review-primary{background:var(--navy);color:#fff}.foys-review-secondary{background:#f1f2f6;color:var(--navy)}
 .foys-review-new{display:grid;gap:9px}.foys-review-new label{display:grid;gap:4px;font-size:9px;font-weight:800;color:var(--muted)}.foys-review-team-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.foys-review-team{display:flex!important;align-items:center;gap:6px;border:1px solid var(--line);border-radius:10px;padding:8px;color:var(--navy)!important}.foys-review-notice-btn{margin:8px 0 12px}
 body.foys-review-open{overflow:hidden}@media(min-width:700px){.foys-review-overlay{align-items:center;padding:20px}.foys-review-sheet{border-radius:24px}}
 `;document.head.appendChild(s)
}
function overlay(){let o=document.getElementById('foysMemberReviewOverlay');if(o)return o;o=document.createElement('div');o.id='foysMemberReviewOverlay';o.className='foys-review-overlay';o.hidden=true;o.innerHTML='<div class="foys-review-sheet"><div id="foysMemberReviewBody"></div></div>';document.body.appendChild(o);o.addEventListener('click',e=>{if(e.target===o||e.target.closest('[data-foys-close]'))close()});return o}
function close(){const o=overlay();o.hidden=true;document.body.classList.remove('foys-review-open')}
function reviewChips(r){
 const teams=(r.teams||[]).map(x=>x.name).filter(Boolean),played=(r.playedTeams||[]).map(x=>x.name).filter(Boolean),nums=(r.numbers||[]).filter(x=>x.number),isPrivate=String(r.sourceName||'').trim().toLowerCase()==='private';
 let out='',used=new Set();
 for(const n of nums){
  const team=n.teamName||(teams.length===1?teams[0]:'');
  if(team)used.add(norm(team));
  out+=`<span class="foys-review-chip">${team?`${esc(team)} · `:''}#${esc(n.number)}</span>`;
 }
 for(const t of teams)if(!used.has(norm(t)))out+=`<span class="foys-review-chip">${esc(t)}</span>`;
 for(const t of played)out+=`<span class="foys-review-chip played">Meegespeeld: ${esc(t)}</span>`;
 if(isPrivate)out+=`<span class="foys-review-chip private">Naam afgeschermd</span>`;
 return out
}
function sessionProgress(){const total=Math.max(1,reviewSessionTotal||state.reviews.length||1),step=Math.min(total,Math.max(1,reviewSessionStep||1));return{total,step,pct:Math.round((step/total)*100)}}
function setMode(mode){viewMode=mode;render()}
function laterCurrent(){if(state.reviews.length>1){const first=state.reviews.shift();state.reviews.push(first);reviewSessionStep=Math.min(reviewSessionTotal||state.reviews.length,reviewSessionStep+1);viewMode='choose';render()}else close()}
function memberListHtml(r){
 const sug=suggestions(r),suggestedIds=new Set(sug.map(x=>String(x.id)));
 const preferred=sug.map(m=>`<button class="foys-review-suggestion" data-link-member="${esc(m.id)}" type="button"><span>${esc(m.name)}${m.email?`<small>${esc(m.email)}</small>`:''}${m.suggested?'<small>Voorgesteld op basis van team/rugnummer</small>':''}</span><b>Koppel</b></button>`).join('');
 const rest=state.members.filter(m=>!suggestedIds.has(String(m.id))).map(m=>`<button class="foys-review-suggestion" data-link-member="${esc(m.id)}" data-member-name="${esc(norm(m.name))}" type="button"><span>${esc(m.name)}${m.email?`<small>${esc(m.email)}</small>`:''}</span><b>Koppel</b></button>`).join('');
 return `${preferred}${preferred&&rest?'<div class="foys-review-helper" style="margin-top:12px">Andere leden</div>':''}${rest}`
}
function render(){
 const host=document.getElementById('foysMemberReviewBody');if(!host)return;const r=state.reviews[0];
 if(!r){host.innerHTML='<div class="foys-review-head"><div><span class="foys-review-kicker">Bondsspelers</span><h2 class="foys-review-title">Alles gecontroleerd</h2></div><button class="foys-review-close" data-foys-close>×</button></div><div class="foys-review-helper" style="margin-top:14px">Geen nieuwe spelers om te controleren.</div>';return}
 const isPrivate=String(r.sourceName||'').trim().toLowerCase()==='private',p=sessionProgress(),title=isPrivate?'Private speler':r.sourceName,chips=reviewChips(r);let body='';
 if(viewMode==='link'){
  body=`<div class="foys-review-block"><button class="foys-review-back" type="button" data-review-back>← Terug</button><h3>Koppelen aan bestaand lid</h3><p class="foys-review-helper">${isPrivate?'Gebruik team en rugnummer om de juiste persoon te kiezen.':'Kies de persoon uit de ledenlijst. Bij twijfel niet koppelen.'}</p><div class="foys-review-search"><input id="foysReviewSearch" type="search" placeholder="Zoek lid op naam…"></div><div id="foysReviewMemberList" class="foys-review-member-list">${memberListHtml(r)}</div><div class="foys-review-actions"><button class="foys-review-secondary" type="button" data-review-later>Later</button></div></div>`;
 }else if(viewMode==='new'&&!isPrivate){
  const teamIds=new Set((r.teams||[]).map(x=>String(x.id)));
  body=`<form id="foysReviewForm" class="foys-review-new"><div class="foys-review-block"><button class="foys-review-back" type="button" data-review-back>← Terug</button><h3>Nieuw lid toevoegen</h3><p class="foys-review-helper">Bondgegevens zijn alvast ingevuld. Extra informatie kan nu of later worden toegevoegd.</p><label>Naam<input id="foysReviewName" class="foys-review-input" required value="${esc(r.sourceName)}"></label><label>E-mail<input id="foysReviewEmail" class="foys-review-input" type="email"></label><label>Telefoon<input id="foysReviewPhone" class="foys-review-input" type="tel"></label><label>Officieel speler bij<div class="foys-review-team-grid">${state.teams.map(t=>`<label class="foys-review-team"><input name="foysReviewTeam" type="checkbox" value="${esc(t.id)}" ${teamIds.has(String(t.id))?'checked':''}>${esc(t.name)}</label>`).join('')}</div></label><div class="foys-review-actions"><button class="foys-review-primary" type="submit">Opslaan en koppelen</button><button class="foys-review-secondary" type="button" data-review-later>Later</button></div></div></form>`;
 }else{
  const sug=suggestions(r),m=sug[0],quick=m?`<div class="foys-review-block"><h3>Mogelijke match</h3><div class="foys-review-match-card"><span><strong>${esc(m.name)}</strong>${m.email?`<small>${esc(m.email)}</small>`:''}${m.suggested?'<small>Team/rugnummer komt overeen</small>':''}</span><button data-link-member="${esc(m.id)}" type="button">Koppelen</button></div></div>`:'';
  body=`${isPrivate?'<div class="foys-review-private-note">De bond schermt deze naam af. Koppel alleen via team en rugnummer wanneer je zeker weet wie dit is.</div>':''}${quick}<div class="foys-review-block foys-review-action-block"><h3>Actie</h3><div class="foys-review-mini-actions"><button type="button" data-review-mode="link">Zoek ander lid</button>${isPrivate?'':`<button class="primary" type="button" data-review-mode="new">Nieuw lid</button>`}<button type="button" data-review-later>Later</button></div></div>`
 }
 host.innerHTML=`<div class="foys-review-head"><div><span class="foys-review-kicker">Bondsspeler controleren</span><h2 class="foys-review-title">${esc(title)}</h2></div><button class="foys-review-close" data-foys-close type="button">×</button></div><div class="foys-review-progress"><div class="foys-review-progress-track"><div class="foys-review-progress-bar" style="width:${p.pct}%"></div></div><span class="foys-review-progress-text">${p.step} van ${p.total} · ${state.reviews.length} open</span></div>${chips?`<div class="foys-review-chips">${chips}</div>`:''}${body}`;
 host.querySelectorAll('[data-link-member]').forEach(x=>x.onclick=()=>linkExisting(r.personId,x.dataset.linkMember));
 host.querySelectorAll('[data-review-mode]').forEach(x=>x.onclick=()=>setMode(x.dataset.reviewMode));
 host.querySelectorAll('[data-review-back]').forEach(x=>x.onclick=()=>setMode('choose'));
 host.querySelectorAll('[data-review-later]').forEach(x=>x.onclick=laterCurrent);
 const search=document.getElementById('foysReviewSearch');if(search)search.oninput=()=>{const q=norm(search.value);document.querySelectorAll('#foysReviewMemberList [data-member-name]').forEach(row=>row.hidden=!!q&&!String(row.dataset.memberName||'').includes(q))};
 const form=document.getElementById('foysReviewForm');if(form)form.onsubmit=e=>createMember(e,r)
}
async function reload(refresh=true){const s=await client();if(refresh){const a=await s.rpc('refresh_foys_member_reviews');if(a.error)throw a.error}const r=await s.rpc('get_foys_member_reviews');if(r.error)throw r.error;state={reviews:r.data?.reviews||[],members:r.data?.members||[],teams:(r.data?.teams||[]).filter(t=>norm(t.name)!=='alleteams')};augmentNotice()}
async function linkExisting(personId,memberId){
 if(busy)return;busy=true;
 try{const s=await client(),r=await s.rpc('resolve_foys_member_review',{p_person_id:personId,p_member_id:memberId});if(r.error)throw r.error;toast('Speler gekoppeld.');reviewSessionStep=Math.min(reviewSessionTotal||999,reviewSessionStep+1);viewMode='choose';await reload(false);render();document.dispatchEvent(new Event('basketball-foys-member-review-updated'))}catch(e){toast(e.message||'Koppelen mislukt.')}finally{busy=false}
}
async function createMember(e,r){
 e.preventDefault();if(busy)return;busy=true;
 try{const s=await client(),ids=[...document.querySelectorAll('input[name="foysReviewTeam"]:checked')].map(x=>x.value),x=await s.rpc('create_member_from_foys_player',{p_person_id:r.personId,p_full_name:document.getElementById('foysReviewName').value.trim(),p_email:document.getElementById('foysReviewEmail').value.trim()||null,p_phone:document.getElementById('foysReviewPhone').value.trim()||null,p_team_ids:ids});if(x.error)throw x.error;toast('Lid toegevoegd en gekoppeld.');reviewSessionStep=Math.min(reviewSessionTotal||999,reviewSessionStep+1);viewMode='choose';await reload(false);render();document.dispatchEvent(new Event('basketball-foys-member-review-updated'))}catch(err){toast(err.message||'Lid toevoegen mislukt.')}finally{busy=false}
}
function open(){
 if(overlay().hidden){reviewSessionTotal=Math.max(1,state.reviews.length);reviewSessionStep=1;viewMode='choose'}
 overlay().hidden=false;document.body.classList.add('foys-review-open');render()
}
function augmentNotice(){const panel=document.querySelector('#club-sub-notices .club-card-panel');if(!panel)return;let b=panel.querySelector('#foysReviewNoticeButton');if(!state.reviews.length){b?.remove();return}const label=`Bondsspelers controleren (${state.reviews.length})`;if(b){if(b.textContent!==label)b.textContent=label;return}b=document.createElement('button');b.id='foysReviewNoticeButton';b.className='primary-button foys-review-notice-btn';b.type='button';b.textContent=label;b.onclick=open;panel.querySelector('h2')?.insertAdjacentElement('afterend',b)}
async function check(startup=false){try{const s=await client(),ses=await s.auth.getSession();if(!ses.data.session)return;const m=await s.rpc('sync_current_member');if(m.error||m.data?.role!=='admin'||!m.data?.active)return;await reload(true);if(startup&&!startupShown&&state.reviews.length){const audit=window.BasketballOneTimeMemberAudit;if(audit?.hasPending?.())return;startupShown=true;open()}}catch(e){console.warn('Bondsspelers controleren',e)}}
function init(){installCss();overlay();setTimeout(()=>check(true),1600);document.addEventListener('basketball-one-time-member-audit-ready',()=>setTimeout(()=>check(true),120));document.getElementById('syncBtn')?.addEventListener('click',()=>setTimeout(()=>check(false),1700));document.addEventListener('basketball-team-data-rendered',()=>setTimeout(()=>check(false),1200));document.addEventListener('basketball-team-stats-synced',()=>setTimeout(()=>check(false),500));document.addEventListener('basketball-club-rendered',augmentNotice);document.addEventListener('basketball-club-view-changed',augmentNotice);const mo=new MutationObserver(()=>{if(!document.getElementById('foysReviewNoticeButton'))augmentNotice()});mo.observe(document.body,{childList:true,subtree:true});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay().hidden)close()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
