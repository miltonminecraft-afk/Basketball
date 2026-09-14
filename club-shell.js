(()=>{
'use strict';

const STATE_KEY='basketballApp.uiState.v2';
let rootObserver=null;
let normalizing=false;
let lastSignature='';

function readState(){
  try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch{return {}}
}
function validButton(tabs,name){return !!tabs?.querySelector(`[data-clubview="${CSS.escape(name)}"]`)}
function activeClub(tabs){return tabs?.querySelector('[data-clubview].active')?.dataset.clubview||''}
function activateClub(tabs,name){
  if(!tabs||!name)return;
  tabs.querySelectorAll('[data-clubview]').forEach(b=>b.classList.toggle('active',b.dataset.clubview===name));
  document.querySelectorAll('#clubRoot > .club-subview').forEach(v=>v.classList.toggle('active',v.id===`club-sub-${name}`));
}
function orderTabs(tabs){
  if(!tabs)return;
  const order=['admin','trainer','presence','mytasks','swaps','notices'];
  for(const name of order){const b=tabs.querySelector(`[data-clubview="${name}"]`);if(b)tabs.appendChild(b)}
}
function normalize(){
  if(normalizing)return;
  const root=document.getElementById('clubRoot');
  const tabs=document.getElementById('clubTabs');
  if(!root||!tabs)return;
  normalizing=true;
  try{
    const legacyButton=tabs.querySelector('[data-clubview="clubagenda"]');
    const legacyView=document.getElementById('club-sub-clubagenda');
    const legacyWasActive=!!legacyButton?.classList.contains('active')||!!legacyView?.classList.contains('active');
    legacyButton?.remove();
    legacyView?.remove();
    orderTabs(tabs);

    const state=readState();
    let wanted=activeClub(tabs);
    if(!wanted||legacyWasActive||!validButton(tabs,wanted)){
      const saved=String(state.club||'');
      if(saved&&validButton(tabs,saved))wanted=saved;
      else if(validButton(tabs,'admin'))wanted='admin';
      else if(validButton(tabs,'trainer'))wanted='trainer';
      else if(validButton(tabs,'presence'))wanted='presence';
      else wanted=tabs.querySelector('[data-clubview]')?.dataset.clubview||'';
      activateClub(tabs,wanted);
    }

    const adminTabs=document.getElementById('adminTabs');
    if(adminTabs){
      const savedAdmin=String(state.admin||'');
      const current=adminTabs.querySelector('[data-adminview].active')?.dataset.adminview||'';
      const wantedAdmin=current||((savedAdmin&&adminTabs.querySelector(`[data-adminview="${CSS.escape(savedAdmin)}"]`))?savedAdmin:'members');
      adminTabs.querySelectorAll('[data-adminview]').forEach(b=>b.classList.toggle('active',b.dataset.adminview===wantedAdmin));
      const members=document.getElementById('admin-members');
      const agenda=document.getElementById('admin-agenda');
      if(members)members.hidden=wantedAdmin!=='members';
      if(agenda)agenda.hidden=wantedAdmin!=='agenda';
    }

    const signature=[...tabs.querySelectorAll('[data-clubview]')].map(b=>b.dataset.clubview).join('|')+'#'+(activeClub(tabs)||'');
    if(signature!==lastSignature){
      lastSignature=signature;
      document.dispatchEvent(new CustomEvent('basketball-club-structure-ready',{detail:{club:activeClub(tabs)}}));
    }
  }finally{normalizing=false}
}
function observe(){
  const root=document.getElementById('clubRoot');
  if(!root)return;
  rootObserver?.disconnect();
  rootObserver=new MutationObserver(mutations=>{
    const relevant=mutations.some(m=>m.type==='childList'&&(m.target===root||m.target.id==='clubTabs'||m.target.id==='adminTabs'||m.target.parentElement?.id==='clubTabs'||m.target.parentElement?.id==='adminTabs'));
    if(relevant)normalize();
  });
  rootObserver.observe(root,{childList:true,subtree:true});
  normalize();
}
function boot(){
  const existing=document.getElementById('clubRoot');
  if(existing)observe();
  const bodyObserver=new MutationObserver(mutations=>{
    if(mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.id==='view-club'||n.querySelector?.('#view-club'))))){bodyObserver.disconnect();observe()}
  });
  if(!existing)bodyObserver.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    if(e.target.closest?.('#clubTabs [data-clubview],#adminTabs [data-adminview]'))queueMicrotask(normalize);
  },true);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();