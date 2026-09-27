(()=>{
'use strict';
function fix(root=document){
 for(const el of root.querySelectorAll?.('.feed-team-player-points')||[]){
  const v=String(el.textContent||'').trim();
  if(!v)continue;
  let next=v;
  if(v.startsWith('≈'))next=v.replace(/\s*(?:pt|pnt)?$/i,' pnt');
  else if(v.startsWith('≥')||v==='—'||v==='-')next='-';
  else{const m=v.match(/^(-?\d+)\s*(?:pt|pnt)?$/i);if(m)next=`${m[1]} pnt`}
  if(next!==v)el.textContent=next;
 }
 for(const note of root.querySelectorAll?.('.feed-team-players-note')||[]){
  const overlay=note.closest('.feed-team-players-sheet');
  const hasEstimate=!!overlay?.querySelector('.feed-team-player-points');
  const estimated=[...(overlay?.querySelectorAll('.feed-team-player-points')||[])].some(el=>String(el.textContent||'').trim().startsWith('≈'));
  const next=estimated?'≈ = deels geschat uit teamscore · - = punten onbekend.':'- = punten onbekend.';
  if(String(note.textContent||'')!==next)note.textContent=next
 }
}
function init(){fix();const o=new MutationObserver(()=>fix());o.observe(document.body,{childList:true,subtree:true,characterData:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
