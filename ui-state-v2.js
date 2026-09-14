(()=>{
'use strict';

const KEY='basketballApp.uiState.v2';

function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
function write(state){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function sanitize(){
  const state=read();
  if(state.club==='clubagenda')state.club='admin';
  if(state.admin&&!['members','agenda'].includes(state.admin))delete state.admin;
  write(state);
  return state;
}
function applyStaticMain(){
  const state=read(),main=String(state.main||'agenda');
  if(main==='club')return;
  const tab=document.querySelector(`.tab[data-view="${CSS.escape(main)}"]`),view=document.getElementById(`view-${main}`);
  if(!tab||!view)return;
  document.querySelectorAll('.tab[data-view]').forEach(x=>x.classList.toggle('active',x===tab));
  document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x===view));
}
function saveMain(name){const state=read();state.main=name;state.updatedAt=Date.now();write(state)}
function saveClub(name){const state=read();state.main='club';state.club=name;state.updatedAt=Date.now();write(state)}
function saveAdmin(name){const state=read();state.main='club';state.club='admin';state.admin=name;state.updatedAt=Date.now();write(state)}
function init(){
  sanitize();
  applyStaticMain();
  document.addEventListener('click',event=>{
    const admin=event.target.closest?.('#adminTabs [data-adminview]');
    if(admin){saveAdmin(admin.dataset.adminview);return}
    const club=event.target.closest?.('#clubTabs [data-clubview]');
    if(club){saveClub(club.dataset.clubview);return}
    const main=event.target.closest?.('.tab[data-view]');
    if(main)saveMain(main.dataset.view);
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();