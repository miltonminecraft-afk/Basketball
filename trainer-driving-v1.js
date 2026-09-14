(()=>{
'use strict';

const U='https://elpnfmlrkoemjrnzaeok.supabase.co';
const K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
let sb=null,ctx=null,ctxAt=0,activeMatchId=null,busy=false;

const norm=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const isArgon=v=>/^SV Argon(?:\s|$)/i.test(String(v||'').trim());
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));

async function client(){
  if(sb)return sb;
  const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});
  sb.auth.onAuthStateChange(()=>{ctx=null;ctxAt=0});
  return sb;
}

function rowsWithTeam(result){
  return (result.data||[]).map(x=>x.teams?{...x.teams,id:x.team_id}:null).filter(Boolean);
}
async function context(force=false){
  if(!force&&ctx&&Date.now()-ctxAt<15000)return ctx;
  const s=await client(),{data:{session}}=await s.auth.getSession();
  if(!session){ctx=null;ctxAt=Date.now();return null}
  const {data:member,error}=await s.rpc('sync_current_member');
  if(error||!member?.active){ctx=null;ctxAt=Date.now();return null}
  const [players,trainers,all]=await Promise.all([
    s.from('member_teams').select('team_id,teams(id,team_name,foy_team_guid)').eq('member_id',member.id),
    s.from('member_trainer_teams').select('team_id,teams(id,team_name,foy_team_guid)').eq('member_id',member.id),
    s.from('teams').select('id,team_name,foy_team_guid').eq('active',true)
  ]);
  if(players.error||trainers.error||all.error)return null;
  ctx={member,playerTeams:rowsWithTeam(players),trainerTeams:rowsWithTeam(trainers),allTeams:all.data||[]};
  ctxAt=Date.now();
  return ctx;
}

function detailTeams(){
  const title=document.getElementById('matchDetailTitle')?.textContent?.trim()||'';
  const parts=title.split(/\s+[—–-]\s+/).map(x=>x.trim()).filter(Boolean);
  return{home:parts[0]||'',away:parts[1]||''};
}
function detailLocation(){
  const spans=[...document.querySelectorAll('#matchDetailBody .match-summary span')];
  return spans.at(-1)?.textContent?.trim()||'';
}
function isAway(home,away,location){return !isArgon(home)&&isArgon(away)&&!/eendracht|phoenix/i.test(location)}
function argonTeamName(home,away){
  const side=isArgon(home)?home:isArgon(away)?away:'';
  return side.replace(/^SV Argon\s*/i,'').trim();
}
function hasTeam(list,team){return list.some(x=>String(x.id)===String(team.id))}
function hasAllTeams(list){return list.some(x=>norm(x.team_name)==='alleteams')}

async function ownDriving(matchId,memberId){
  const s=await client(),{data}=await s.from('attendance').select('driving').eq('foy_match_id',Number(matchId)).eq('member_id',memberId).maybeSingle();
  return data?.driving===true;
}
async function renderDrivers(matchId){
  const toggle=document.querySelector('#matchDetailBody .drive-toggle');
  if(!toggle)return;
  let box=document.querySelector('#matchDetailBody .drivers-list');
  if(!box){box=document.createElement('div');box.className='drivers-list';toggle.insertAdjacentElement('afterend',box)}
  const s=await client(),{data,error}=await s.rpc('get_match_drivers',{p_match_id:Number(matchId)});
  const rows=error?[]:(data||[]);
  box.innerHTML=`<strong>Rijders</strong><div class="drivers-names">${rows.length?rows.map(r=>`<span class="driver-name">${esc(r.full_name||'Lid')}</span>`).join(''):'<span class="match-muted">Nog niemand heeft aangegeven te rijden.</span>'}</div>`;
}

function clearTrainerBinding(input){
  if(!input?.dataset.trainerDriveBound)return;
  input.onchange=null;
  delete input.dataset.trainerDriveBound;
}
async function configure(matchId){
  if(busy)return;
  const overlay=document.getElementById('matchDetailOverlay');
  if(!overlay||overlay.hidden||!Number.isFinite(Number(matchId)))return;
  busy=true;
  try{
    const c=await context();if(!c)return;
    const dt=detailTeams(),name=argonTeamName(dt.home,dt.away);
    const team=c.allTeams.find(x=>norm(x.team_name)===norm(name)&&norm(x.team_name)!=='alleteams');
    if(!team)return;

    const input=document.getElementById('drive'),toggle=document.querySelector('#matchDetailBody .drive-toggle');
    const player=hasTeam(c.playerTeams,team);
    const trainer=hasTeam(c.trainerTeams,team)||hasAllTeams(c.trainerTeams);

    // Spelers blijven volledig door de bestaande Agenda-code afgehandeld.
    if(player){clearTrainerBinding(input);return}
    // Adminstatus op zichzelf geeft hier bewust geen rechten.
    if(!trainer){clearTrainerBinding(input);return}

    const away=isAway(dt.home,dt.away,detailLocation());
    if(toggle)toggle.style.display=away?'flex':'none';
    if(!input)return;
    input.disabled=!away;
    input.checked=away&&await ownDriving(matchId,c.member.id);
    if(!away){document.querySelector('#matchDetailBody .drivers-list')?.remove();return}

    const signature=`${matchId}:${team.id}`;
    if(input.dataset.trainerDriveBound!==signature){
      input.onchange=null;
      input.dataset.trainerDriveBound=signature;
      input.onchange=async()=>{
        const checked=input.checked,s=await client();
        input.disabled=true;
        const {data,error}=await s.rpc('set_match_attendance',{
          p_match_id:Number(matchId),p_team_id:team.id,p_attending:false,p_driving:checked
        });
        input.disabled=false;
        if(error){input.checked=!checked;window.alert(error.message);return}
        input.checked=data?.driving===true;
        await renderDrivers(matchId);
      };
    }
    await renderDrivers(matchId);
  }finally{busy=false}
}

function waitForDetail(matchId,attempt=0){
  const overlay=document.getElementById('matchDetailOverlay');
  if(overlay&&!overlay.hidden&&document.getElementById('matchDetailTitle')&&document.getElementById('drive')){configure(matchId);return}
  if(attempt<40)requestAnimationFrame(()=>waitForDetail(matchId,attempt+1));
}

document.addEventListener('click',e=>{
  const card=e.target.closest?.('article.event[data-match-id]');
  if(!card)return;
  const id=Number(card.dataset.matchId);if(!Number.isFinite(id))return;
  activeMatchId=id;
  requestAnimationFrame(()=>waitForDetail(activeMatchId));
},true);

// Een admin krijgt Trainer-toegang, maar trainer-teams blijven apart bepalend voor rijrechten.
document.addEventListener('change',e=>{
  if(e.target?.id!=='memberAdmin'||!e.target.checked)return;
  const trainer=document.getElementById('memberTrainer');
  if(trainer&&!trainer.checked){trainer.checked=true;trainer.dispatchEvent(new Event('change',{bubbles:true}))}
},true);
document.addEventListener('submit',e=>{
  const form=e.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='memberForm')return;
  const admin=document.getElementById('memberAdmin'),trainer=document.getElementById('memberTrainer');
  if(admin?.checked&&trainer)trainer.checked=true;
},true);

document.addEventListener('basketball-club-rendered',()=>{ctx=null;ctxAt=0});
})();
