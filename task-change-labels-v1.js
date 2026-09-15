(()=>{
'use strict';
const U='https://elpnfmlrkoemjrnzaeok.supabase.co',K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
const $=id=>document.getElementById(id);
let sb=null,timer=null,data=null,dataAt=0,member=null,memberAt=0,unread=new Set(),busy=false;
async function client(){if(sb)return sb;const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});sb.auth.onAuthStateChange(()=>{member=null;memberAt=0;unread.clear();schedule(true,80)});return sb}
async function tasks(force=false){if(!force&&data&&Date.now()-dataAt<5000)return data;const r=await fetch('./data/tasks.json',{cache:'no-store'});if(!r.ok)throw Error('Takenschema niet beschikbaar');data=await r.json();dataAt=Date.now();return data}
async function who(force=false){if(!force&&member&&Date.now()-memberAt<10000)return member;const s=await client(),{data:{session}}=await s.auth.getSession();if(!session){member=null;memberAt=Date.now();return null}const{data:m}=await s.rpc('sync_current_member');member=m?.active?m:null;memberAt=Date.now();return member}
function selectedPerson(){return $('personSelect')?.value||'__all__'}
async function unreadEventsForSelected(force=false){
 unread=new Set();
 const selected=selectedPerson();
 if(selected==='__all__')return unread;
 const m=await who(force);if(!m)return unread;
 const s=await client();let targetId=null;
 if(String(selected).trim().toLowerCase()===String(m.full_name||'').trim().toLowerCase())targetId=m.id;
 else if(m.role==='admin'){
  const q=await s.from('members').select('id,full_name').eq('active',true).eq('full_name',selected).limit(2);
  if(!q.error&&q.data?.length===1)targetId=q.data[0].id;
 }
 if(!targetId)return unread;
 const{data:rows,error}=await s.from('notifications').select('task_event_id,acknowledged_at').eq('recipient_member_id',targetId).eq('type','task_change').is('acknowledged_at',null);
 if(error)throw error;
 for(const n of rows||[])if(n.task_event_id)unread.add(String(n.task_event_id));
 return unread;
}
function css(){if($('taskChangeLabelsV3Css'))return;document.querySelector('#taskChangeLabelsV1Css')?.remove();document.querySelector('#taskChangeLabelsV2Css')?.remove();const s=document.createElement('style');s.id='taskChangeLabelsV3Css';s.textContent=`.task-change-pill{display:inline-flex;align-items:center;margin-left:5px;padding:3px 6px;border-radius:999px;background:#fff0df;color:#9b4c00;font-size:8px;font-weight:900;line-height:1}`;document.head.appendChild(s)}
async function apply(force=false){if(busy)return;busy=true;try{css();const j=await tasks(force),selected=selectedPerson();if(selected!=='__all__')await unreadEventsForSelected(force);const map=new Map((j?.tasks||[]).map(x=>[String(x.id),x]));for(const card of document.querySelectorAll('#agendaList article.event[data-task-id],#tasksList article.event[data-task-id]')){card.querySelectorAll('.task-change-pill,.task-change-note').forEach(x=>x.remove());const task=map.get(String(card.dataset.taskId));if(!task)continue;const changed=selected==='__all__'?!!task.changed:unread.has(String(task.taskEventId||''));if(!changed)continue;const badge=card.querySelector('.badge-task');if(badge){const pill=document.createElement('span');pill.className='task-change-pill';pill.textContent='Gewijzigd';badge.insertAdjacentElement('afterend',pill)}}}catch(e){console.warn('Taakwijzigingslabels',e)}finally{busy=false}}
function schedule(force=false,delay=80){clearTimeout(timer);timer=setTimeout(()=>apply(force),delay)}
function init(){css();const observer=new MutationObserver(()=>schedule(false,100));for(const id of ['agendaList','tasksList']){const el=$(id);if(el)observer.observe(el,{childList:true,subtree:true})}for(const ev of ['task-schedule-imported','staff-task-updated','basketball-task-change-read'])document.addEventListener(ev,()=>{data=null;dataAt=0;memberAt=0;schedule(true,40)});document.addEventListener('basketball-team-data-rendered',()=>schedule(false,80));$('personSelect')?.addEventListener('change',()=>schedule(true,60));schedule(true,700)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
