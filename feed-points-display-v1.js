(()=>{
'use strict';
function fix(root=document){
 for(const el of root.querySelectorAll?.('.feed-team-player-points')||[]){
  const v=String(el.textContent||'').trim();
  if(!v)continue;
  if(v.startsWith('≥')||v==='—'||v==='-'){el.textContent='-';continue}
  const m=v.match(/^(-?\d+)\s*(?:pt|pnt)?$/i);if(m)el.textContent=`${m[1]} pnt`;
 }
 for(const note of root.querySelectorAll?.('.feed-team-players-note')||[])note.textContent='- = punten onbekend.';
}
function init(){fix();const o=new MutationObserver(()=>fix());o.observe(document.body,{childList:true,subtree:true,characterData:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
