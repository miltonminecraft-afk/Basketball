(()=>{
'use strict';

const ARGON_ID='a4a2e2fa-0635-46a5-8969-1d0fef40444f';
const ARGON_NAME='SV Argon';
const STORE='basketballApp.selection.v3';
const SUPABASE_URL='https://elpnfmlrkoemjrnzaeok.supabase.co';
const SUPABASE_KEY='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
const DEFAULT_SELECTION={
  clubId:ARGON_ID,
  clubName:ARGON_NAME,
  clubLogo:'https://images.foys.io/foys/a4a2e2fa-0635-46a5-8969-1d0fef40444f/CC586FA3B4D02C36D9D21FBE50E20E47.gif',
  teamId:50553,
  teamGuid:'9b807e1c-8acb-442f-8bb0-35d16bc76e78',
  teamName:'MSE-2',
  teamLogo:'https://images.foys.io/foys/a4a2e2fa-0635-46a5-8969-1d0fef40444f/CC586FA3B4D02C36D9D21FBE50E20E47.gif?w=200'
};

let sb=null,clubLabelAt=0,clubLabelBusy=false;

async function getClient(){
  if(sb)return sb;
  const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb=mod.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});
  sb.auth.onAuthStateChange(()=>{clubLabelAt=0;setTimeout(()=>updateClubTab(true),50)});
  return sb;
}
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
  if(select)[...select.options].filter(o=>o.value==='__change_club__').forEach(o=>o.remove());
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
function setClubLabel(label){
  const tab=document.querySelector('.tab[data-view="club"]');
  if(!tab)return;
  const current=tab.querySelector('.club-tab-label')?.textContent||'';
  if(current===label)return;
  tab.innerHTML=`<span class="tab-icon">●</span><span class="club-tab-label">${label}</span>`;
}
async function updateClubTab(force=false){
  if(clubLabelBusy||(!force&&Date.now()-clubLabelAt<900))return;
  const tab=document.querySelector('.tab[data-view="club"]');
  if(!tab)return;
  clubLabelBusy=true;
  try{
    const s=await getClient(),{data:{session}}=await s.auth.getSession();
    if(!session){setClubLabel('Club/inloggen');return}
    const{data:m,error}=await s.rpc('sync_current_member');
    if(error){setClubLabel('Club');return}
    if(m?.active&&m?.role==='admin'&&m?.is_trainer)setClubLabel('Club/admin/trainer');
    else if(m?.active&&m?.role==='admin')setClubLabel('Club/admin');
    else if(m?.active&&m?.is_trainer)setClubLabel('Club/trainer');
    else setClubLabel('Club');
  }catch{
    const root=document.getElementById('clubRoot');
    setClubLabel(root?.querySelector('[data-clubview="admin"]')?'Club/admin':root?.querySelector('.auth-box h2')?'Club/inloggen':'Club');
  }finally{
    clubLabelAt=Date.now();
    clubLabelBusy=false;
  }
}
function initStatic(){fixTeamUi();updateClubTab(true)}
document.addEventListener('basketball-club-rendered',()=>updateClubTab(true));
document.addEventListener('basketball-agenda-polished',fixTeamUi);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initStatic,{once:true});else initStatic();
})();