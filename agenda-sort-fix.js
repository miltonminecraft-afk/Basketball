(()=>{
'use strict';
let tasks=null,timer=null;
const date=v=>String(v||'').slice(0,10),time=v=>String(v||'').slice(0,5);
async function loadTasks(){if(tasks)return tasks;try{const r=await fetch('./data/tasks.json',{cache:'no-store'}),j=await r.json();tasks=new Map((j.tasks||[]).map(x=>[String(x.id),x]));}catch{tasks=new Map()}return tasks}
async function fix(){const root=document.getElementById('agendaList');if(!root)return;const map=await loadTasks();for(const day of root.querySelectorAll('.day')){if(!day.dataset.reworkDate){const c=day.querySelector('article[data-task-id]'),row=c?map.get(String(c.dataset.taskId)):null;if(row)day.dataset.reworkDate=date(row.date)}for(const c of day.querySelectorAll('article[data-task-id]')){const row=map.get(String(c.dataset.taskId));if(row)c.dataset.reworkTime=time(row.arrivalTime||row.startTime)}}const days=[...root.querySelectorAll('.day')];days.sort((a,b)=>(a.dataset.reworkDate||'9999-12-31').localeCompare(b.dataset.reworkDate||'9999-12-31')).forEach(x=>root.appendChild(x));for(const day of days){const cards=[...day.querySelectorAll(':scope > article.event')];cards.sort((a,b)=>(a.dataset.reworkTime||a.dataset.polishTime||'99:99').localeCompare(b.dataset.reworkTime||b.dataset.polishTime||'99:99')).forEach(x=>day.appendChild(x))}}
function schedule(){clearTimeout(timer);timer=setTimeout(fix,250)}
document.addEventListener('DOMContentLoaded',()=>{schedule();new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true})});
})();
import('./ux-v3.js?v=1').catch(error=>console.warn('UX v3 kon niet worden geladen',error));