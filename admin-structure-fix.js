(()=>{
'use strict';
let timer=0;

function requestAdminAgendaRemount(){
  const root=document.getElementById('admin-agenda');
  if(!root||root.hidden)return;
  const ready=root.querySelector('.admin-agenda-v2-head')&&root.querySelector('#adminAgendaV2List');
  if(ready)return;
  root.removeAttribute('data-admin-agenda-v2');
  const marker=document.createElement('span');
  marker.hidden=true;
  marker.dataset.adminAgendaRemount='1';
  root.appendChild(marker);
  requestAnimationFrame(()=>marker.remove());
}

function schedule(){
  clearTimeout(timer);
  timer=setTimeout(requestAdminAgendaRemount,40);
}

document.addEventListener('click',event=>{
  if(event.target.closest?.('[data-adminview="agenda"]'))setTimeout(requestAdminAgendaRemount,30);
},true);

const observer=new MutationObserver(mutations=>{
  for(const mutation of mutations){
    if(mutation.type!=='attributes'||mutation.attributeName!=='hidden')continue;
    const target=mutation.target;
    if(target?.id==='admin-agenda'&&!target.hidden){schedule();break;}
  }
});

function start(){
  observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['hidden']});
  schedule();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();
