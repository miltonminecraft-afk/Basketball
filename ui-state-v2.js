(()=>{
'use strict';

const KEY='basketballApp.uiState.v2';
let restoring=false;
let restoreTimer=0;
let observer=null;
let scrollTimer=0;

function read(){
  try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}
}
function write(state){
  try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}
}
function activeMain(){return document.querySelector('.tab.active[data-view]')?.dataset.view||'agenda'}
function activeClub(){return document.querySelector('#clubTabs button.active[data-clubview]')?.dataset.clubview||''}
function activeAdmin(){return document.querySelector('#adminTabs button.active[data-adminview]')?.dataset.adminview||''}
function pathKey(main=activeMain(),club=activeClub(),admin=activeAdmin()){
  return [main,main==='club'?club:'',main==='club'&&club==='admin'?admin:''].filter(Boolean).join('/');
}
function saveScroll(){
  const state=read();
  state.main=activeMain();
  if(state.main==='club'){
    const club=activeClub();
    if(club)state.club=club;
    if(club==='admin'){
      const admin=activeAdmin();
      if(admin)state.admin=admin;
    }
  }
  state.scrolls=state.scrolls||{};
  state.scrolls[pathKey(state.main,state.club,state.admin)]=window.scrollY||0;
  state.updatedAt=Date.now();
  write(state);
}
function saveBeforeAction(){saveScroll()}
function restoreScroll(state){
  const key=pathKey(state.main||'agenda',state.club||'',state.admin||'');
  const y=Number(state.scrolls?.[key]);
  if(!Number.isFinite(y))return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'auto'})));
}
function restore(){
  if(restoring)return;
  restoring=true;
  try{
    const state=read();
    const main=state.main||'agenda';
    const mainTab=document.querySelector(`.tab[data-view="${CSS.escape(main)}"]`);
    if(mainTab&&!mainTab.classList.contains('active'))mainTab.click();

    if(main==='club'){
      const club=state.club||'';
      const clubBtn=club?document.querySelector(`#clubTabs [data-clubview="${CSS.escape(club)}"]`):null;
      if(clubBtn&&!clubBtn.classList.contains('active'))clubBtn.click();
      if(club==='admin'){
        const admin=state.admin||'members';
        const adminBtn=document.querySelector(`#adminTabs [data-adminview="${CSS.escape(admin)}"]`);
        if(adminBtn&&!adminBtn.classList.contains('active'))adminBtn.click();
      }
    }
    restoreScroll(state);
  }finally{
    restoring=false;
  }
}
function scheduleRestore(delay=80){
  clearTimeout(restoreTimer);
  restoreTimer=setTimeout(restore,delay);
}
function bindClicks(){
  document.addEventListener('pointerdown',event=>{
    if(event.target.closest?.('.tab[data-view],#clubTabs [data-clubview],#adminTabs [data-adminview],#view-club button,#view-club select,#view-club input,#view-club form'))saveBeforeAction();
  },true);
  document.addEventListener('click',event=>{
    const main=event.target.closest?.('.tab[data-view]');
    if(main){
      const state=read();state.main=main.dataset.view;write(state);setTimeout(()=>scheduleRestore(20),0);return;
    }
    const club=event.target.closest?.('#clubTabs [data-clubview]');
    if(club){
      const state=read();state.main='club';state.club=club.dataset.clubview;write(state);setTimeout(()=>scheduleRestore(20),0);return;
    }
    const admin=event.target.closest?.('#adminTabs [data-adminview]');
    if(admin){
      const state=read();state.main='club';state.club='admin';state.admin=admin.dataset.adminview;write(state);setTimeout(()=>scheduleRestore(20),0);
    }
  },true);
}
function bindScroll(){
  window.addEventListener('scroll',()=>{
    clearTimeout(scrollTimer);
    scrollTimer=setTimeout(saveScroll,120);
  },{passive:true});
  window.addEventListener('pagehide',saveScroll);
  window.addEventListener('beforeunload',saveScroll);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveScroll()});
}
function observeDynamicUi(){
  observer?.disconnect();
  observer=new MutationObserver(mutations=>{
    const relevant=mutations.some(m=>[...m.addedNodes].some(node=>node.nodeType===1&&(node.id==='clubRoot'||node.id==='clubTabs'||node.id==='adminTabs'||node.querySelector?.('#clubTabs,#adminTabs,#clubRoot'))));
    if(relevant)scheduleRestore(90);
  });
  observer.observe(document.body,{childList:true,subtree:true});
}
function init(){
  bindClicks();
  bindScroll();
  observeDynamicUi();
  scheduleRestore(20);
  setTimeout(()=>scheduleRestore(0),350);
  setTimeout(()=>scheduleRestore(0),900);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
