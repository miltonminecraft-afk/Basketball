(()=>{
'use strict';

function markUnknownPoints(root=document){
  for(const row of root.querySelectorAll?.('#matchDetailOverlay .played-players .played-player-row')||[]){
    if(row.querySelector('.played-player-points'))continue;
    const points=document.createElement('span');
    points.className='played-player-points';
    points.textContent='—';
    points.title='Individuele punten zijn voor deze wedstrijd niet volledig openbaar.';
    row.appendChild(points);
  }
}

function init(){
  markUnknownPoints();
  const target=document.getElementById('matchDetailBody')||document.body;
  const observer=new MutationObserver(mutations=>{
    for(const mutation of mutations){
      for(const node of mutation.addedNodes){
        if(node.nodeType===1)markUnknownPoints(node.matches?.('#matchDetailOverlay')?node:document);
      }
    }
  });
  observer.observe(target,{childList:true,subtree:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
