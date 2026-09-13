(()=>{
'use strict';
const ARGON_ID='a4a2e2fa-0635-46a5-8969-1d0fef40444f';
const ARGON_NAME='SV Argon';
const STORE='basketballApp.selection.v3';
const DEFAULT_SELECTION={clubId:ARGON_ID,clubName:ARGON_NAME,clubLogo:'https://images.foys.io/foys/a4a2e2fa-0635-46a5-8969-1d0fef40444f/CC586FA3B4D02C36D9D21FBE50E20E47.gif',teamId:50553,teamGuid:'9b807e1c-8acb-442f-8bb0-35d16bc76e78',teamName:'MSE-2',teamLogo:'https://images.foys.io/foys/a4a2e2fa-0635-46a5-8969-1d0fef40444f/CC586FA3B4D02C36D9D21FBE50E20E47.gif?w=200'};

function lockSelection(){
 try{
  const raw=localStorage.getItem(STORE);
  if(!raw)return false;
  const value=JSON.parse(raw);
  if(value?.clubId===ARGON_ID)return false;
  localStorage.setItem(STORE,JSON.stringify(DEFAULT_SELECTION));
  location.reload();
  return true;
 }catch{return false}
}
if(lockSelection())return;

function fixTeamUi(){
 const select=document.getElementById('teamSelect');
 if(select){
  [...select.options].filter(o=>o.value==='__change_club__').forEach(o=>o.remove());
 }
 const button=document.getElementById('changeTeamBtn');
 if(button)button.textContent='Team wijzigen';
 const settingsClub=document.getElementById('settingsClub');
 if(settingsClub)settingsClub.textContent=ARGON_NAME;
 const title=document.getElementById('teamModalTitle');
 if(title)title.textContent='Team kiezen';
 const sheet=document.querySelector('#teamModal .team-sheet');
 if(sheet){
  const intro=sheet.querySelector('.sheet-title-row p');
  if(intro)intro.textContent='Kies een team van SV Argon of Alle teams.';
  sheet.querySelectorAll('.search-label,.search-row,.search-status,.club-results,.chosen-club-head').forEach(el=>el.style.display='none');
  const chosen=document.getElementById('chosenClub');
  if(chosen)chosen.hidden=false;
  const name=document.getElementById('chosenClubName');
  if(name)name.textContent=ARGON_NAME;
 }
}

function addressAfterBreak(meta){
 let after=false,text='';
 for(const node of meta.childNodes){
  if(node.nodeName==='BR'){after=true;continue}
  if(after&&!node.classList?.contains('maps-link'))text+=node.textContent||'';
 }
 return text.replace(/\s*·\s*Maps\s*$/i,'').trim();
}
function addMapsLinks(){
 document.querySelectorAll('article.event[data-match-id] .meta').forEach(meta=>{
  if(meta.querySelector('.maps-link'))return;
  const address=addressAfterBreak(meta);
  if(!address)return;
  const link=document.createElement('a');
  link.className='maps-link';
  link.href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  link.target='_blank';
  link.rel='noopener noreferrer';
  link.textContent='Maps';
  link.setAttribute('aria-label',`Open ${address} in Google Maps`);
  meta.append(document.createTextNode(' · '),link);
 });
}

function isArgon(side){return /^SV Argon(?:\s|$)/i.test(String(side||'').trim())}
function fixDriving(){
 const overlay=document.getElementById('matchDetailOverlay');
 const toggle=overlay?.querySelector('.drive-toggle');
 if(!toggle)return;
 const title=document.getElementById('matchDetailTitle')?.textContent||'';
 const parts=title.split(/\s+[—–-]\s+/);
 const away=parts.length>1&&!isArgon(parts[0])&&isArgon(parts[1]);
 toggle.style.display=away?'flex':'none';
 const input=toggle.querySelector('input');
 if(input&&!away)input.disabled=true;
}

function updateClubTab(){
 const tab=document.querySelector('.tab[data-view="club"]');
 if(!tab)return;
 let label='Club';
 const root=document.getElementById('clubRoot');
 const loginTitle=root?.querySelector('.auth-box h2')?.textContent?.trim()||'';
 if(/Ledenlogin/i.test(loginTitle))label='Club/inloggen';
 else if(root?.querySelector('[data-clubview="admin"]'))label='Club/admin';
 let labelEl=tab.querySelector('.club-tab-label');
 if(!labelEl){
  [...tab.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>n.remove());
  labelEl=document.createElement('span');
  labelEl.className='club-tab-label';
  tab.appendChild(labelEl);
 }
 if(labelEl.textContent!==label)labelEl.textContent=label;
}

let queued=false;
function apply(){
 queued=false;
 fixTeamUi();
 addMapsLinks();
 fixDriving();
 updateClubTab();
}
function schedule(){
 if(queued)return;
 queued=true;
 requestAnimationFrame(apply);
}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
document.addEventListener('DOMContentLoaded',schedule);
document.addEventListener('click',schedule,true);
setTimeout(schedule,300);
})();
