(()=>{
'use strict';
const ARGON_ID='a4a2e2fa-0635-46a5-8969-1d0fef40444f';
const ARGON_NAME='SV Argon';
const STORE='basketballApp.selection.v3';
const SUPABASE_URL='https://elpnfmlrkoemjrnzaeok.supabase.co';
const SUPABASE_KEY='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
const DEFAULT_SELECTION={clubId:ARGON_ID,clubName:ARGON_NAME,clubLogo:'https://images.foys.io/foys/a4a2e2fa-0635-46a5-8969-1d0fef40444f/CC586FA3B4D02C36D9D21FBE50E20E47.gif',teamId:50553,teamGuid:'9b807e1c-8acb-442f-8bb0-35d16bc76e78',teamName:'MSE-2',teamLogo:'https://images.foys.io/foys/a4a2e2fa-0635-46a5-8969-1d0fef40444f/CC586FA3B4D02C36D9D21FBE50E20E47.gif?w=200'};
let sb=null,memberContextCache=null,memberContextAt=0,clubLabelAt=0,clubLabelBusy=false,detailBusy=false,activeMatchId=null,activeMatchTitle='';
const norm=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const isArgon=v=>/^SV Argon(?:\s|$)/i.test(String(v||'').trim());
function esc(value){return String(value??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
function injectStyle(){
  if(document.getElementById('argonUiStyleV7'))return;
  document.getElementById('argonUiStyleV6')?.remove();
  const style=document.createElement('style');
  style.id='argonUiStyleV7';
  style.textContent=`
    .club-tab-label{display:block}
    #matchDetailTitle{margin:8px 0 16px;font-size:clamp(24px,6vw,36px);line-height:1.08;overflow-wrap:anywhere}
    #matchDetailBody .match-summary{display:grid;grid-template-columns:1fr;gap:6px;padding:13px 14px;margin-bottom:12px}
    #matchDetailBody .match-summary>*{display:block;margin:0;min-width:0}
    #matchDetailBody .match-summary strong{font-size:15px;line-height:1.28}
    #matchDetailBody .match-summary span{font-size:12px;line-height:1.42;color:var(--muted)}
    #matchDetailBody .match-detail-section{padding:16px 0}
    #matchDetailBody .match-detail-section>h3{margin:0 0 12px;font-size:20px;line-height:1.15}
    #matchDetailBody .presence-segment{gap:10px}
    #matchDetailBody .match-action{min-height:50px;padding:11px 12px;font-size:12px;border-radius:12px}
    #matchDetailBody .drive-toggle{min-height:56px;margin-top:9px;padding:12px 14px;gap:11px;border-radius:12px;font-size:17px;font-weight:800;cursor:pointer;user-select:none;transition:background .12s ease,transform .08s ease}
    #matchDetailBody .drive-toggle:active{transform:scale(.995)}
    #matchDetailBody .drive-toggle input{width:24px;height:24px;flex:0 0 24px;margin:0}
    .drivers-list{margin-top:10px;border:1px solid var(--line);border-radius:12px;padding:11px 12px}
    .drivers-list strong{display:block;font-size:11px;margin-bottom:7px}
    .drivers-names{display:flex;gap:6px;flex-wrap:wrap}
    .driver-name{display:inline-flex;border-radius:999px;padding:6px 9px;background:#eef0f5;color:var(--navy);font-size:10px;font-weight:850}
    .attendees-section{padding-top:16px!important}
    .attendees-list{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
    .attendee-name{display:inline-flex;align-items:center;border-radius:999px;padding:7px 10px;background:#eef0f5;color:var(--navy);font-size:11px;font-weight:850}
    @media(max-width:480px){
      #matchDetailTitle{font-size:28px}
      #matchDetailBody .match-summary{padding:12px}
      #matchDetailBody .match-detail-section>h3{font-size:19px}
    }
  `;
  document.head.appendChild(style);
}
async function getClient(){if(sb)return sb;const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');sb=mod.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});sb.auth.onAuthStateChange(()=>{memberContextCache=null;memberContextAt=0;clubLabelAt=0;setTimeout(()=>updateClubTab(true),50)});return sb}
function lockSelection(){try{const raw=localStorage.getItem(STORE);if(!raw)return false;const value=JSON.parse(raw);if(value?.clubId===ARGON_ID)return false;localStorage.setItem(STORE,JSON.stringify(DEFAULT_SELECTION));location.reload();return true}catch{return false}}
if(lockSelection())return;
function fixTeamUi(){const select=document.getElementById('teamSelect');if(select)[...select.options].filter(o=>o.value==='__change_club__').forEach(o=>o.remove());const button=document.getElementById('changeTeamBtn');if(button)button.textContent='Team wijzigen';const settingsClub=document.getElementById('settingsClub');if(settingsClub)settingsClub.textContent=ARGON_NAME;const title=document.getElementById('teamModalTitle');if(title)title.textContent='Team kiezen';const sheet=document.querySelector('#teamModal .team-sheet');if(sheet){const intro=sheet.querySelector('.sheet-title-row p');if(intro)intro.textContent='Kies een team van SV Argon of Alle teams.';sheet.querySelectorAll('.search-label,.search-row,.search-status,.club-results,.chosen-club-head').forEach(el=>el.style.display='none');const chosen=document.getElementById('chosenClub');if(chosen)chosen.hidden=false;const name=document.getElementById('chosenClubName');if(name)name.textContent=ARGON_NAME}}
function setClubLabel(label){const tab=document.querySelector('.tab[data-view="club"]');if(!tab)return;const current=tab.querySelector('.club-tab-label')?.textContent||'';if(current===label)return;tab.innerHTML=`<span class="tab-icon">●</span><span class="club-tab-label">${label}</span>`}
async function updateClubTab(force=false){if(clubLabelBusy||(!force&&Date.now()-clubLabelAt<900))return;const tab=document.querySelector('.tab[data-view="club"]');if(!tab)return;clubLabelBusy=true;try{const s=await getClient(),{data:{session}}=await s.auth.getSession();if(!session){setClubLabel('Club/inloggen');return}const{data:m,error}=await s.rpc('sync_current_member');if(error){setClubLabel('Club');return}if(m?.active&&m?.role==='admin'&&m?.is_trainer)setClubLabel('Club/admin/trainer');else if(m?.active&&m?.role==='admin')setClubLabel('Club/admin');else if(m?.active&&m?.is_trainer)setClubLabel('Club/trainer');else setClubLabel('Club')}catch{const root=document.getElementById('clubRoot');setClubLabel(root?.querySelector('[data-clubview="admin"]')?'Club/admin':root?.querySelector('.auth-box h2')?'Club/inloggen':'Club')}finally{clubLabelAt=Date.now();clubLabelBusy=false}}
async function memberContext(force=false){if(!force&&memberContextCache&&Date.now()-memberContextAt<15000)return memberContextCache;const s=await getClient(),{data:{session}}=await s.auth.getSession();if(!session)return null;const{data:m,error}=await s.rpc('sync_current_member');if(error||!m?.active)return null;const{data:rows}=await s.from('member_teams').select('team_id,teams(id,team_name,foy_team_guid)').eq('member_id',m.id);memberContextCache={member:m,teams:(rows||[]).map(x=>x.teams?{...x.teams,id:x.team_id}:null).filter(Boolean)};memberContextAt=Date.now();return memberContextCache}
function detailTeams(){const title=document.getElementById('matchDetailTitle')?.textContent?.trim()||'';const parts=title.split(/\s+[—–-]\s+/).map(x=>x.trim()).filter(Boolean);return{title,home:parts[0]||'',away:parts[1]||''}}
function detailLocation(){const spans=[...document.querySelectorAll('#matchDetailBody .match-summary span')];return spans.at(-1)?.textContent?.trim()||''}
function isAwayDetail(home,away,location){return !isArgon(home)&&isArgon(away)&&!/eendracht|phoenix/i.test(location)}
function argonTeamName(home,away){const side=isArgon(home)?home:isArgon(away)?away:'';return side.replace(/^SV Argon\s*/i,'').trim()}
function resolveMatchId(title){if(activeMatchId&&(!activeMatchTitle||norm(activeMatchTitle)===norm(title)))return Number(activeMatchId);const card=[...document.querySelectorAll('article.event[data-match-id]')].find(c=>norm(c.querySelector('.match-title')?.textContent)===norm(title));return card?Number(card.dataset.matchId):null}
async function ownAttendance(matchId,memberId){const s=await getClient(),{data}=await s.from('attendance').select('attending,driving').eq('foy_match_id',Number(matchId)).eq('member_id',memberId).maybeSingle();return data||null}
async function drivers(matchId){const s=await getClient(),{data,error}=await s.rpc('get_match_drivers',{p_match_id:Number(matchId)});if(error)return[];return data||[]}
async function attendees(matchId){const s=await getClient(),{data,error}=await s.rpc('get_match_attendees',{p_match_id:Number(matchId)});if(error)return[];return data||[]}
function applyAttendanceVisual(state,away){const yes=document.querySelector('#matchDetailBody [data-pres="yes"]'),no=document.querySelector('#matchDetailBody [data-pres="no"]'),input=document.getElementById('drive');if(yes){yes.classList.toggle('selected',state?.attending===true);yes.classList.toggle('yes',state?.attending===true)}if(no){no.classList.toggle('selected',state?.attending===false);no.classList.toggle('no',state?.attending===false)}if(input){input.checked=away&&state?.driving===true;input.disabled=!away}}
async function renderDrivers(matchId){let box=document.querySelector('#matchDetailBody .drivers-list');if(!box){const toggle=document.querySelector('#matchDetailBody .drive-toggle');if(!toggle)return;box=document.createElement('div');box.className='drivers-list';toggle.insertAdjacentElement('afterend',box)}const rows=await drivers(matchId);box.innerHTML=`<strong>Rijders</strong><div class="drivers-names">${rows.length?rows.map(r=>`<span class="driver-name">${esc(r.full_name||'Lid')}</span>`).join(''):'<span class="match-muted">Nog niemand heeft aangegeven te rijden.</span>'}</div>`}
async function renderAttendees(matchId){const body=document.getElementById('matchDetailBody');if(!body)return;const rows=await attendees(matchId);let section=body.querySelector('.attendees-section');if(!section){section=document.createElement('div');section.className='match-detail-section attendees-section';const taskSection=[...body.querySelectorAll('.match-detail-section')].find(x=>x.querySelector('h3')?.textContent?.trim()==='Taken');if(taskSection)taskSection.insertAdjacentElement('beforebegin',section);else body.appendChild(section)}section.innerHTML=`<h3>Aanwezige spelers</h3>${rows.length?`<div class="attendees-list">${rows.map(r=>`<span class="attendee-name">${esc(r.full_name||'Lid')}</span>`).join('')}</div>`:'<p class="match-muted">Nog niemand heeft zich aanwezig gemeld.</p>'}`}
async function saveAttendance(ctx,attending){const input=document.getElementById('drive'),driving=!!(attending&&ctx.away&&input?.checked),s=await getClient();const{data,error}=await s.rpc('set_match_attendance',{p_match_id:ctx.matchId,p_team_id:ctx.team.id,p_attending:attending,p_driving:driving});if(error){window.alert(error.message);return}applyAttendanceVisual(data,ctx.away);if(ctx.away)await renderDrivers(ctx.matchId);await renderAttendees(ctx.matchId);document.dispatchEvent(new CustomEvent('basketball-attendance-changed',{detail:{matchId:ctx.matchId}}))}
async function saveDriving(ctx,checked){const s=await getClient(),{data,error}=await s.rpc('set_match_attendance',{p_match_id:ctx.matchId,p_team_id:ctx.team.id,p_attending:true,p_driving:!!checked});if(error){window.alert(error.message);return}applyAttendanceVisual(data,true);await renderDrivers(ctx.matchId);await renderAttendees(ctx.matchId);document.dispatchEvent(new CustomEvent('basketball-attendance-changed',{detail:{matchId:ctx.matchId}}))}
async function configureDetail(){if(detailBusy)return;const overlay=document.getElementById('matchDetailOverlay');if(!overlay||overlay.hidden)return;detailBusy=true;try{const dt=detailTeams(),matchId=resolveMatchId(dt.title);if(!matchId)return;const context=await memberContext();if(!context)return;await renderAttendees(matchId);const teamName=argonTeamName(dt.home,dt.away),team=context.teams.find(x=>norm(x.team_name)===norm(teamName));if(!team)return;const yes=document.querySelector('#matchDetailBody [data-pres="yes"]'),no=document.querySelector('#matchDetailBody [data-pres="no"]'),toggle=document.querySelector('#matchDetailBody .drive-toggle');if(!yes&&!no&&!toggle)return;const away=isAwayDetail(dt.home,dt.away,detailLocation()),ctx={matchId,team,away},input=document.getElementById('drive');overlay.dataset.argonDetailSignature=`${matchId}:${team.id}:${away?'away':'home'}`;if(toggle){toggle.style.display=away?'flex':'none';toggle.classList.remove('disabled')}if(input){input.disabled=!away;input.onchange=null;input.dataset.argonBound='1';input.onchange=()=>saveDriving(ctx,input.checked)}if(yes){yes.onclick=null;yes.dataset.argonBound='1';yes.onclick=()=>saveAttendance(ctx,true)}if(no){no.onclick=null;no.dataset.argonBound='1';no.onclick=()=>saveAttendance(ctx,false)}let state=await ownAttendance(matchId,context.member.id);if(!away&&state?.driving){const s=await getClient(),{data}=await s.rpc('set_match_attendance',{p_match_id:matchId,p_team_id:team.id,p_attending:state.attending===true,p_driving:false});state=data||state}applyAttendanceVisual(state,away);const old=document.querySelector('#matchDetailBody .drivers-list');if(!away)old?.remove();else await renderDrivers(matchId)}finally{detailBusy=false}}
function waitForDetail(attempt=0){const overlay=document.getElementById('matchDetailOverlay');if(overlay&&!overlay.hidden&&document.getElementById('matchDetailTitle')){configureDetail();return}if(attempt<40)requestAnimationFrame(()=>waitForDetail(attempt+1))}
function initStatic(){injectStyle();fixTeamUi();updateClubTab(true)}
document.addEventListener('click',e=>{
  const toggle=e.target.closest?.('#matchDetailBody .drive-toggle');
  if(toggle&&e.target?.id!=='drive'){
    const input=toggle.querySelector('#drive')||document.getElementById('drive');
    if(input&&!input.disabled&&toggle.style.display!=='none'){e.preventDefault();input.click()}
    return;
  }
  const card=e.target.closest?.('article.event[data-match-id],article.event[data-task-id]');if(!card)return;if(card.dataset.matchId){activeMatchId=Number(card.dataset.matchId);activeMatchTitle=card.querySelector('.match-title')?.textContent||'';requestAnimationFrame(()=>waitForDetail())}else{activeMatchId=null;activeMatchTitle=''}
},true);
document.addEventListener('basketball-club-rendered',()=>{memberContextCache=null;memberContextAt=0;updateClubTab(true)});
document.addEventListener('basketball-agenda-polished',()=>fixTeamUi());
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initStatic,{once:true});else initStatic();
})();