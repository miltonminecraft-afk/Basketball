(()=>{
'use strict';

const KEY='basketballApp.uiState.v2';
let restoring=false;
let restoreTimer=0;

function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
function write(state){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function activeMain(){return document.querySelector('.tab.active[data-view]')?.dataset.view||'agenda'}
function activeClub(){return document.querySelector('#clubTabs button.active[data-clubview]')?.dataset.clubview||''}
function activeAdmin(){return document.querySelector('#adminTabs button.active[data-adminview]')?.dataset.adminview||''}
function save(){const state=read();state.main=activeMain();if(state.main==='club'){const club=activeClub();if(club)state.club=club;if(club==='admin'){const admin=activeAdmin();if(admin)state.admin=admin}}state.updatedAt=Date.now();write(state)}
function restore(){
  if(restoring)return;
  restoring=true;
  try{
    const state=read();
    const main=state.main||'agenda';
    const mainTab=document.querySelector(`.tab[data-view="${CSS.escape(main)}"]`);
    if(mainTab&&!mainTab.classList.contains('active'))mainTab.click();
    if(main!=='club')return;

    const club=String(state.club||'');
    const clubBtn=club?document.querySelector(`#clubTabs [data-clubview="${CSS.escape(club)}"]`):null;
    if(clubBtn&&!clubBtn.classList.contains('active'))clubBtn.click();

    if(club==='admin'){
      const admin=String(state.admin||'members');
      const adminBtn=document.querySelector(`#adminTabs [data-adminview="${CSS.escape(admin)}"]`);
      if(adminBtn&&!adminBtn.classList.contains('active'))adminBtn.click();
    }
  }finally{restoring=false}
}
function scheduleRestore(delay=30){clearTimeout(restoreTimer);restoreTimer=setTimeout(restore,delay)}
function init(){
  document.addEventListener('click',event=>{
    if(event.target.closest?.('.tab[data-view],#clubTabs [data-clubview],#adminTabs [data-adminview]'))setTimeout(save,0);
  },true);
  document.addEventListener('basketball-club-structure-ready',()=>scheduleRestore(20));
  window.addEventListener('pagehide',save);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save()});
  scheduleRestore(40);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();