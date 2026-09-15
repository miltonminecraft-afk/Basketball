(()=>{
'use strict';
const $=id=>document.getElementById(id);
let timer=null,data=null,dataAt=0,observer=null,busy=false;
async function load(force=false){
 if(!force&&data&&Date.now()-dataAt<5000)return data;
 const r=await fetch('./data/tasks.json',{cache:'no-store'});if(!r.ok)throw Error('Takenschema niet beschikbaar');
 data=await r.json();dataAt=Date.now();return data;
}
function textFor(task){
 if(task.changeType==='new')return'Nieuw in laatste schema';
 const list=Array.isArray(task.changes)?task.changes:[];
 if(!list.length)return'Gewijzigd in laatste schema';
 const parts=list.slice(0,2).map(x=>`${x.field}: ${x.from||'—'} → ${x.to||'—'}`);
 if(list.length>2)parts.push(`+${list.length-2}`);
 return parts.join(' · ');
}
function css(){
 if($('taskChangeLabelsV1Css'))return;
 const s=document.createElement('style');s.id='taskChangeLabelsV1Css';s.textContent=`
.task-change-pill{display:inline-flex;align-items:center;margin-left:5px;padding:3px 6px;border-radius:999px;background:#fff0df;color:#9b4c00;font-size:8px;font-weight:900;line-height:1}
.task-change-note{margin-top:5px;font-size:8px;font-weight:800;color:#9b4c00;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;document.head.appendChild(s);
}
async function apply(force=false){
 if(busy)return;busy=true;
 try{
  css();const j=await load(force),map=new Map((j?.tasks||[]).map(x=>[String(x.id),x]));
  for(const card of document.querySelectorAll('#agendaList article.event[data-task-id],#tasksList article.event[data-task-id]')){
   card.querySelectorAll('.task-change-pill,.task-change-note').forEach(x=>x.remove());
   const task=map.get(String(card.dataset.taskId));if(!task?.changed)continue;
   const badge=card.querySelector('.badge-task');
   if(badge){const pill=document.createElement('span');pill.className='task-change-pill';pill.textContent='Gewijzigd';badge.insertAdjacentElement('afterend',pill)}
   const host=card.querySelector('.officials')||card.querySelector('.meta')||card.querySelector('.event-main');
   if(host){const note=document.createElement('div');note.className='task-change-note';note.textContent=textFor(task);host.insertAdjacentElement('afterend',note)}
  }
 }catch(e){console.warn(e)}finally{busy=false}
}
function schedule(force=false,delay=80){clearTimeout(timer);timer=setTimeout(()=>apply(force),delay)}
function init(){
 css();observer=new MutationObserver(()=>schedule(false,100));
 for(const id of ['agendaList','tasksList']){const el=$(id);if(el)observer.observe(el,{childList:true,subtree:true})}
 document.addEventListener('task-schedule-imported',()=>{data=null;dataAt=0;schedule(true,50)});
 document.addEventListener('basketball-team-data-rendered',()=>schedule(false,80));
 schedule(true,800);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();