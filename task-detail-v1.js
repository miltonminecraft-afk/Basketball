(()=>{
'use strict';
const U='https://elpnfmlrkoemjrnzaeok.supabase.co',K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
let sb=null,busy=false;
async function client(){if(sb)return sb;const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});return sb}
function css(){if($('taskDetailV2Css'))return;document.querySelector('#taskDetailV1Css')?.remove();const s=document.createElement('style');s.id='taskDetailV2Css';s.textContent=`
.task-detail-overlay[hidden]{display:none!important}.task-detail-overlay{position:fixed;z-index:1750;inset:0;background:rgba(3,4,30,.58);display:flex;align-items:flex-end;justify-content:center;padding-top:env(safe-area-inset-top)}.task-detail-sheet{width:min(780px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:23px 23px 0 0;padding:14px 16px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -12px 50px rgba(0,0,0,.2)}.task-detail-head{display:flex;align-items:flex-start;gap:12px}.task-detail-head-main{flex:1;min-width:0}.task-detail-kicker{font-size:10px;color:var(--muted);font-weight:800}.task-detail-matchup{display:grid;grid-template-columns:minmax(0,1fr) 14px minmax(0,1fr);gap:7px;align-items:center;margin:8px 0 2px}.task-detail-team{display:flex;align-items:center;gap:7px;min-width:0}.task-detail-team.away{justify-content:flex-end}.task-detail-team.away .task-detail-team-name{text-align:right}.task-detail-team-logo{width:32px;height:32px;flex:0 0 32px;object-fit:contain;border-radius:7px;background:#fff}.task-detail-team-logo.placeholder{background:#eef0f5}.task-detail-team-name{font-size:11.5px;font-weight:900;line-height:1.12;overflow-wrap:anywhere;min-width:0;color:var(--navy)}.task-detail-sep{text-align:center;font-size:11px;font-weight:950;color:var(--muted)}.task-detail-close{width:42px;height:42px;flex:0 0 42px;border:0;border-radius:50%;background:#f0f1f4;color:#111;font-size:28px;line-height:1}.task-detail-info{display:grid;grid-template-columns:96px minmax(0,1fr);gap:7px 10px;margin-top:16px;padding-bottom:14px;border-bottom:1px solid var(--line);font-size:11px}.task-detail-info span{color:var(--muted);font-weight:800}.task-detail-info strong{color:var(--navy);overflow-wrap:anywhere}.task-detail-section{padding-top:14px}.task-detail-section h3{margin:0 0 9px;font-size:16px}.task-detail-assignments{display:grid;gap:7px}.task-detail-assignment{padding:10px 11px;border:1px solid var(--line);border-radius:11px;font-size:11px}.task-detail-assignment b{color:var(--navy)}.task-detail-changes{display:grid;gap:6px}.task-detail-change{padding:8px 10px;border-radius:10px;background:#fff7e9;color:#7f4300;font-size:10px;line-height:1.4}.task-detail-change b{display:block;color:#9b4c00;margin-bottom:2px}.task-detail-empty{color:var(--muted);font-size:10px}@media(max-width:390px){.task-detail-team-logo{width:29px;height:29px;flex-basis:29px}.task-detail-team-name{font-size:10.5px}}
`;document.head.appendChild(s)}
function ensure(){let o=$('taskDetailOverlay');if(o)return o;o=document.createElement('div');o.id='taskDetailOverlay';o.className='task-detail-overlay';o.hidden=true;o.innerHTML='<div class="task-detail-sheet" role="dialog" aria-modal="true"><div id="taskDetailBody"></div></div>';document.body.appendChild(o);return o}
function close(){ensure().hidden=true}
function fmtDate(v){try{return new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(new Date(`${String(v).slice(0,10)}T12:00:00`))}catch{return String(v||'')}}
function cleanTeam(v){return String(v||'').replace(/\s+-\s+/, ' ').trim()}
function directLogo(m,side){return m?.[`${side}TeamLogoUrl`]||m?.[`${side}Team`]?.logoUrl||m?.[`${side}Organisation`]?.logoUrl||m?.[`${side}TeamSponsorClubLogoUrl`]||m?.[`${side}ClubLogoUrl`]||''}
function matchName(m,side){const sponsor=m?.[`${side}TeamSponsorClubName`]||m?.[`${side}Organisation`]?.name||'',team=m?.[`${side}TeamName`]||m?.[`${side}Team`]?.name||'';return [sponsor,team].filter(Boolean).join(' ').trim()}
async function matchup(task){
 const fallback={home:{name:cleanTeam(task.home),logo:''},away:{name:cleanTeam(task.away),logo:''}};
 const id=String(task.foyMatchId||'');
 if(id){
  const card=document.querySelector(`#agendaList article.event[data-match-id="${CSS.escape(id)}"],#gamesList article.event[data-match-id="${CSS.escape(id)}"]`),sides=card?[...card.querySelectorAll('.agenda-team-side')]:[];
  if(sides.length>=2){
   const side=(el,fb)=>({name:String(el.querySelector('span:last-child')?.textContent||el.textContent||fb.name).trim(),logo:el.querySelector('img')?.src||''});
   return{home:side(sides[0],fallback.home),away:side(sides[1],fallback.away)};
  }
  if(window.BasketballMatchRules?.matchById){
   try{const m=await window.BasketballMatchRules.matchById(id);if(m)return{home:{name:matchName(m,'home')||fallback.home.name,logo:directLogo(m,'home')},away:{name:matchName(m,'away')||fallback.away.name,logo:directLogo(m,'away')}}}catch{}
  }
 }
 return fallback;
}
function teamHtml(side,away=false){const logo=side.logo?`<img class="task-detail-team-logo" src="${esc(side.logo)}" alt="">`:'<span class="task-detail-team-logo placeholder" aria-hidden="true"></span>';return `<div class="task-detail-team ${away?'away':''}">${away?`<span class="task-detail-team-name">${esc(side.name)}</span>${logo}`:`${logo}<span class="task-detail-team-name">${esc(side.name)}</span>`}</div>`}
function changeRows(task,notices){const rows=[];for(const c of task?.changes||[]){rows.push({title:c.field||'Wijziging',text:`${c.from||'—'} → ${c.to||'—'}`})}for(const n of notices||[]){const text=String(n.message||'').trim();if(text&&!rows.some(x=>x.text===text))rows.push({title:n.title||'Gewijzigd',text})}return rows}
async function markSeen(s,task,notices){if(!task?.taskEventId)return;try{if(task.changed)await s.rpc('mark_task_change_seen',{p_task_event_id:task.taskEventId});if(notices.some(n=>!n.acknowledged_at))await s.rpc('acknowledge_task_change',{p_task_event_id:task.taskEventId});document.dispatchEvent(new CustomEvent('basketball-task-change-read',{detail:{taskEventId:task.taskEventId}}))}catch(e){console.warn('Taakwijziging gelezen-status',e)}}
async function open(card){if(busy)return;busy=true;try{
 const r=await fetch('./data/tasks.json',{cache:'no-store'}),j=await r.json(),task=(j?.tasks||[]).find(x=>String(x.id)===String(card.dataset.taskId));if(!task)throw Error('Taak niet gevonden.');
 const [teams,s]=await Promise.all([matchup(task),client()]),{data:{session}}=await s.auth.getSession();let me=null,notices=[];
 if(session){const{data:m}=await s.rpc('sync_current_member');if(m?.active)me=m;if(me&&task.taskEventId){const q=await s.from('notifications').select('id,title,message,created_at,read_at,acknowledged_at').eq('recipient_member_id',me.id).eq('type','task_change').eq('task_event_id',task.taskEventId).order('created_at',{ascending:false}).limit(12);if(!q.error)notices=q.data||[]}}
 const changes=changeRows(task,notices),assign=[...(task.referees||[]).map(x=>['Scheidsrechter',x]),...(task.table||[]).map(x=>['Tafel',x])],body=$('taskDetailBody')||ensure().querySelector('#taskDetailBody');
 body.innerHTML=`<div class="task-detail-head"><div class="task-detail-head-main"><span class="task-detail-kicker">Taak</span><div class="task-detail-matchup">${teamHtml(teams.home)}<span class="task-detail-sep">—</span>${teamHtml(teams.away,true)}</div></div><button type="button" class="task-detail-close" data-task-detail-close aria-label="Sluiten">×</button></div><div class="task-detail-info"><span>Datum</span><strong>${esc(fmtDate(task.date))}</strong><span>Aanwezig</span><strong>${esc(task.arrivalTime||'—')}</strong><span>Start</span><strong>${esc(task.startTime||'—')}</strong><span>Locatie</span><strong>${esc([task.location,task.field].filter(Boolean).join(' · ')||'—')}</strong></div><section class="task-detail-section"><h3>Taken</h3><div class="task-detail-assignments">${assign.length?assign.map(([role,name])=>`<div class="task-detail-assignment">${esc(role)}: <b>${esc(name)}</b></div>`).join(''):'<div class="task-detail-empty">Geen taken toegewezen.</div>'}</div></section>${changes.length?`<section class="task-detail-section"><h3>Wijzigingen</h3><div class="task-detail-changes">${changes.map(x=>`<div class="task-detail-change"><b>${esc(x.title)}</b>${esc(x.text)}</div>`).join('')}</div></section>`:''}`;
 const legacy=$('matchDetailOverlay');if(legacy){legacy.hidden=true;document.body.classList.remove('match-detail-open')}ensure().hidden=false;if(me)await markSeen(s,task,notices);
 }catch(e){console.warn('Taakdetails',e);const toast=$('toast');if(toast){toast.textContent=e.message||'Taakdetails konden niet worden geladen.';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2400)}}finally{busy=false}}
function init(){css();ensure();
 window.addEventListener('click',e=>{
  if(e.target.closest?.('[data-task-detail-close]')){e.preventDefault();e.stopImmediatePropagation();close();return}
  const o=e.target.closest?.('#taskDetailOverlay');if(o&&e.target===o){e.preventDefault();e.stopImmediatePropagation();close();return}
  if(e.target.closest?.('button,a,input,select,textarea,label'))return;
  const card=e.target.closest?.('#agendaList article.event[data-task-id],#tasksList article.event[data-task-id]');if(!card)return;
  e.preventDefault();e.stopImmediatePropagation();const legacy=$('matchDetailOverlay');if(legacy){legacy.hidden=true;document.body.classList.remove('match-detail-open')}open(card);
 },true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!ensure().hidden)close()})
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();