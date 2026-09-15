(()=>{
'use strict';

const U='https://elpnfmlrkoemjrnzaeok.supabase.co';
const K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
let sb=null,me=null,data={reviews:[],members:[],teams:[]},popupShown=false,busy=false,observer=null;

const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const toast=m=>{const e=document.getElementById('toast');if(!e)return alert(m);e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2800)};

async function client(){
 if(sb)return sb;
 const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
 sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});
 return sb;
}
function distance(a,b){
 a=norm(a);b=norm(b);if(a===b)return 0;if(!a.length)return b.length;if(!b.length)return a.length;
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  const cur=[i];
  for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
  prev=cur;
 }
 return prev[b.length];
}
function similarity(a,b){
 const x=norm(a),y=norm(b);if(!x||!y)return 0;if(x===y)return 1;
 const lev=1-distance(x,y)/Math.max(x.length,y.length);
 const partsA=new Set(String(a||'').toLowerCase().split(/\s+/).filter(Boolean)),partsB=new Set(String(b||'').toLowerCase().split(/\s+/).filter(Boolean));
 let common=0;for(const p of partsA)if(partsB.has(p))common++;
 const token=common/Math.max(partsA.size,partsB.size,1);
 return Math.max(lev,token*.92,(x.includes(y)||y.includes(x))?.82:0);
}
function suggestions(review){
 return [...data.members].map(m=>({...m,score:similarity(review.sourceName,m.name)})).filter(x=>x.score>=.52).sort((a,b)=>b.score-a.score||String(a.name).localeCompare(String(b.name))).slice(0,4);
}
function css(){
 if(document.getElementById('foysMemberReviewCss'))return;
 const s=document.createElement('style');s.id='foysMemberReviewCss';s.textContent=`
 .foys-review-overlay[hidden]{display:none!important}.foys-review-overlay{position:fixed;inset:0;z-index:2200;background:rgba(5,6,56,.55);display:flex;align-items:flex-end;justify-content:center;padding-top:20px}.foys-review-sheet{width:min(100%,680px);max-height:88vh;overflow:auto;background:var(--card,#fff);border-radius:28px 28px 0 0;padding:20px 22px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -12px 42px rgba(5,6,56,.2)}.foys-review-head{display:flex;align-items:flex-start;gap:12px}.foys-review-head>div{min-width:0;flex:1}.foys-review-kicker{display:block;color:var(--muted,#747783);font-size:10px;font-weight:800;margin-bottom:4px}.foys-review-title{margin:0;color:var(--navy,#050638);font-size:22px;line-height:1.12;font-weight:950;overflow-wrap:anywhere}.foys-review-close{width:44px;height:44px;border:0;border-radius:50%;background:#f1f2f6;color:var(--navy,#050638);font-size:28px;line-height:1;display:grid;place-items:center;flex:0 0 44px}.foys-review-meta{margin:12px 0 15px;color:var(--muted,#747783);font-size:10px;line-height:1.45}.foys-review-meta b{color:var(--navy,#050638)}.foys-review-block{border-top:1px solid var(--line,#e4e5eb);padding-top:14px;margin-top:14px}.foys-review-block h3{margin:0 0 9px;color:var(--navy,#050638);font-size:14px}.foys-review-suggestions{display:grid;gap:7px}.foys-review-suggestion{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;border:1px solid var(--line,#e4e5eb);border-radius:12px;background:#fff;padding:10px 12px;text-align:left;color:var(--navy,#050638);font-weight:850}.foys-review-suggestion small{display:block;color:var(--muted,#747783);font-weight:650;margin-top:2px}.foys-review-select,.foys-review-input{width:100%;box-sizing:border-box;border:1px solid var(--line,#dfe1e8);border-radius:12px;background:#fff;color:var(--navy,#050638);padding:11px 12px;font:inherit}.foys-review-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.foys-review-primary,.foys-review-secondary{border:0;border-radius:12px;padding:10px 13px;font-weight:900}.foys-review-primary{background:var(--navy,#050638);color:#fff}.foys-review-secondary{background:#f1f2f6;color:var(--navy,#050638)}.foys-review-new{display:grid;gap:9px;margin-top:10px}.foys-review-new[hidden]{display:none!important}.foys-review-new label{display:grid;gap:4px;color:var(--muted,#747783);font-size:9px;font-weight:800}.foys-review-team-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.foys-review-team{display:flex!important;align-items:center;gap:6px;border:1px solid var(--line,#e4e5eb);border-radius:10px;padding:8px;color:var(--navy,#050638)!important;font-size:9px!important}.foys-review-notice-btn{margin:8px 0 12px}.foys-review-empty{padding:16px 0;color:var(--muted,#747783);font-size:11px;text-align:center}body.foys-review-open{overflow:hidden}@media(min-width:700px){.foys-review-overlay{align-items:center;padding:20px}.foys-review-sheet{border-radius:24px;max-height:82vh}}
 `;document.head.appendChild(s);
}
function ensureOverlay(){
 let o=document.getElementById('foysMemberReviewOverlay');if(o)return o;
 o=document.createElement('div');o.id='foysMemberReviewOverlay';o.className='foys-review-overlay';o.hidden=true;o.innerHTML='<div class="foys-review-sheet" role="dialog" aria-modal="true"><div id="foysMemberReviewBody"></div></div>';document.body.appendChild(o);
 o.addEventListener('click',e=>{if(e.target===o||e.target.closest('[data-foys-review-close]'))closeOverlay()});
 return o;
}
function closeOverlay(){const o=document.getElementById('foysMemberReviewOverlay');if(o)o.hidden=true;document.body.classList.remove('foys-review-open')}
function teamMeta(review){
 const teams=(review.teams||[]).map(t=>t.name).filter(Boolean),nums=(review.numbers||[]).filter(x=>x.number).map(x=>`${x.teamName}: #${x.number}`);
 return `${teams.length?`<div><b>Team:</b> ${esc(teams.join(', '))}</div>`:''}${nums.length?`<div><b>Bekend rugnummer:</b> ${esc(nums.join(' · '))}</div>`:''}`;
}
function render(){
 const body=document.getElementById('foysMemberReviewBody');if(!body)return;
 const review=data.reviews[0];
 if(!review){body.innerHTML='<div class="foys-review-head"><div><span class="foys-review-kicker">Bondsspelers</span><h2 class="foys-review-title">Alles gecontroleerd</h2></div><button class="foys-review-close" data-foys-review-close type="button">×</button></div><div class="foys-review-empty">Er staan geen nieuwe spelers klaar voor controle.</div>';return}
 const sug=suggestions(review),discovered=new Set((review.teams||[]).map(t=>String(t.id)));
 body.innerHTML=`<div class="foys-review-head"><div><span class="foys-review-kicker">Bondsspeler controleren · ${data.reviews.length} open</span><h2 class="foys-review-title">${esc(review.sourceName)}</h2></div><button class="foys-review-close" data-foys-review-close type="button" aria-label="Sluiten">×</button></div><div class="foys-review-meta">${teamMeta(review)}<div>FOYS-speler-ID: ${esc(review.personId)}</div></div>
 <div class="foys-review-block"><h3>Komt deze speler al voor bij Leden?</h3>${sug.length?`<div class="foys-review-suggestions">${sug.map(m=>`<button class="foys-review-suggestion" type="button" data-link-member="${esc(m.id)}"><span>${esc(m.name)}${m.email?`<small>${esc(m.email)}</small>`:''}</span><span>Koppelen</span></button>`).join('')}</div>`:'<div class="foys-review-meta">Geen duidelijke naamsmatch gevonden.</div>'}<select id="foysReviewMemberSelect" class="foys-review-select"><option value="">Ander bestaand lid kiezen…</option>${data.members.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}</select><div class="foys-review-actions"><button id="foysReviewLinkSelected" class="foys-review-secondary" type="button">Koppelen aan gekozen lid</button><button id="foysReviewShowNew" class="foys-review-primary" type="button">Nieuw lid toevoegen</button></div></div>
 <form id="foysReviewNewForm" class="foys-review-new" hidden><div class="foys-review-block"><h3>Nieuw lid</h3><label>Naam<input id="foysReviewName" class="foys-review-input" required value="${esc(review.sourceName)}"></label><label>E-mail<input id="foysReviewEmail" class="foys-review-input" type="email"></label><label>Telefoon<input id="foysReviewPhone" class="foys-review-input" type="tel"></label><label>Teams<div class="foys-review-team-grid">${data.teams.map(t=>`<label class="foys-review-team"><input type="checkbox" name="foysReviewTeam" value="${esc(t.id)}" ${discovered.has(String(t.id))?'checked':''}>${esc(t.name)}</label>`).join('')}</div></label><div class="foys-review-actions"><button class="foys-review-primary" type="submit">Lid toevoegen</button><button id="foysReviewCancelNew" class="foys-review-secondary" type="button">Annuleren</button></div></div></form>`;
 body.querySelectorAll('[data-link-member]').forEach(b=>b.onclick=()=>resolveExisting(review.personId,b.dataset.linkMember));
 document.getElementById('foysReviewLinkSelected').onclick=()=>{const id=document.getElementById('foysReviewMemberSelect').value;if(!id)return toast('Kies eerst een bestaand lid.');resolveExisting(review.personId,id)};
 document.getElementById('foysReviewShowNew').onclick=()=>{document.getElementById('foysReviewNewForm').hidden=false;document.getElementById('foysReviewShowNew').disabled=true;document.getElementById('foysReviewName').focus()};
 document.getElementById('foysReviewCancelNew').onclick=()=>{document.getElementById('foysReviewNewForm').hidden=true;document.getElementById('foysReviewShowNew').disabled=false};
 document.getElementById('foysReviewNewForm').onsubmit=e=>createNew(e,review);
}
async function resolveExisting(personId,memberId){
 if(busy)return;busy=true;
 try{const s=await client(),{error}=await s.rpc('resolve_foys_member_review',{p_person_id:personId,p_member_id:memberId});if(error)throw error;toast('Bondsspeler gekoppeld aan bestaand lid.');await loadReviews(false);render();notifyChanged()}catch(e){toast(e?.message||'Koppelen mislukt.')}finally{busy=false}
}
async function createNew(e,review){
 e.preventDefault();if(busy)return;busy=true;
 try{
  const s=await client(),teamIds=[...document.querySelectorAll('input[name="foysReviewTeam"]:checked')].map(x=>x.value);
  const args={p_person_id:review.personId,p_full_name:document.getElementById('foysReviewName').value.trim(),p_email:document.getElementById('foysReviewEmail').value.trim()||null,p_phone:document.getElementById('foysReviewPhone').value.trim()||null,p_team_ids:teamIds};
  const{error}=await s.rpc('create_member_from_foys_player',args);if(error)throw error;toast('Lid toegevoegd en aan bondsspeler gekoppeld.');await loadReviews(false);render();notifyChanged();
 }catch(e2){toast(e2?.message||'Lid toevoegen mislukt.')}finally{busy=false}
}
function notifyChanged(){document.dispatchEvent(new CustomEvent('basketball-foys-member-review-updated'))}
function openOverlay(){ensureOverlay().hidden=false;document.body.classList.add('foys-review-open');render()}
async function loadReviews(refresh=true){
 const s=await client();if(refresh){const rr=await s.rpc('refresh_foys_member_reviews');if(rr.error)throw rr.error}
 const r=await s.rpc('get_foys_member_reviews');if(r.error)throw r.error;data={reviews:r.data?.reviews||[],members:r.data?.members||[],teams:r.data?.teams||[]};augmentNotices();return data;
}
function augmentNotices(){
 const panel=document.querySelector('#club-sub-notices .club-card-panel');if(!panel)return;
 panel.querySelector('#foysReviewNoticeButton')?.remove();
 if(!data.reviews.length)return;
 const b=document.createElement('button');b.id='foysReviewNoticeButton';b.className='primary-button foys-review-notice-btn';b.type='button';b.textContent=`Bondsspelers controleren (${data.reviews.length})`;b.onclick=openOverlay;
 const h=panel.querySelector('h2');h?.insertAdjacentElement('afterend',b);
}
async function check(showStartup=false){
 try{
  const s=await client(),{data:{session}}=await s.auth.getSession();if(!session)return;
  const m=await s.rpc('sync_current_member');if(m.error||m.data?.role!=='admin'||!m.data?.active)return;me=m.data;
  await loadReviews(true);
  if(showStartup&&!popupShown&&data.reviews.length){popupShown=true;openOverlay()}
 }catch(e){console.warn('Bondsspelers controleren',e)}
}
function observeClub(){
 observer?.disconnect();observer=new MutationObserver(()=>augmentNotices());observer.observe(document.body,{childList:true,subtree:true});
 document.addEventListener('basketball-club-rendered',augmentNotices);document.addEventListener('basketball-club-view-changed',augmentNotices);
}
function init(){css();ensureOverlay();observeClub();setTimeout(()=>check(true),1600);document.getElementById('syncBtn')?.addEventListener('click',()=>setTimeout(()=>check(false),1800));document.addEventListener('basketball-team-data-rendered',()=>setTimeout(()=>check(false),1200));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('foysMemberReviewOverlay')?.hidden)closeOverlay()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
