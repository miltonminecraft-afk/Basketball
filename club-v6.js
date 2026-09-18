(()=>{
'use strict';

const U='https://elpnfmlrkoemjrnzaeok.supabase.co';
const K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
const F='52cfa65e-9782-4a81-ab35-e2f981fcb7a9';
const STATE_KEY='basketballApp.uiState.v2';

let sb=null,session=null,member=null;
let teams=[],memberTeams=[],members=[],memberTeamRows=[],taskEvents=[],attendanceRows=[],notifications=[],swaps=[],matchRows=[];
let realtime=null,refreshBusy=false,refreshQueued=false;

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const dateOnly=v=>String(v||'').slice(0,10);
const timeOnly=v=>String(v||'').slice(0,5);
const fmtDate=v=>{try{return new Intl.DateTimeFormat('nl-NL',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${dateOnly(v)}T12:00:00`))}catch{return String(v||'')}};
const seasonRange=()=>{const n=new Date(),y=n.getMonth()>=6?n.getFullYear():n.getFullYear()-1;return{start:`${y}-07-01`,end:`${y+1}-06-30`}};
const roleLabel=r=>r==='referee'?'Scheidsrechter':r==='table'?'Tafel':'Taak';

function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch{return {}}}
function writeState(patch){try{localStorage.setItem(STATE_KEY,JSON.stringify({...readState(),...patch,updatedAt:Date.now()}))}catch{}}
function toast(m){const e=$('toast');if(!e)return alert(m);e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2500)}

function inject(){
  if($('view-club'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href='./club.css?v=3';document.head.appendChild(link);
  const section=document.createElement('section');section.id='view-club';section.className='view';
  section.innerHTML='<div class="section-head"><div><h1>Club</h1><p>Leden, aanwezigheid, trainingen, taken en beheer.</p></div></div><div id="clubRoot"><div class="empty">Ledenomgeving laden…</div></div>';
  document.querySelector('main')?.appendChild(section);

  const nav=document.querySelector('.tabs');
  const b=document.createElement('button');b.className='tab';b.dataset.view='club';b.type='button';
  b.innerHTML='<span class="tab-icon">●</span><span class="club-tab-label">Club</span>';
  b.onclick=()=>{
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v===section));
    document.querySelectorAll('.tab[data-view]').forEach(t=>t.classList.toggle('active',t===b));
    writeState({main:'club'});
  };
  nav?.appendChild(b);
  if(readState().main==='club'){
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v===section));
    document.querySelectorAll('.tab[data-view]').forEach(t=>t.classList.toggle('active',t===b));
  }
}

async function client(){
  if(sb)return sb;
  const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});
  return sb;
}

async function init(){
  inject();
  try{
    const s=await client();
    const {data}=await s.auth.getSession();session=data.session;
    s.auth.onAuthStateChange((_event,next)=>{session=next;queueRefresh()});
    await refreshMember();
  }catch(e){
    console.error(e);
    if($('clubRoot'))$('clubRoot').innerHTML='<div class="empty error-box">De ledenomgeving kon niet worden geladen.</div>';
  }
}
function queueRefresh(){
  if(refreshBusy){refreshQueued=true;return}
  setTimeout(refreshMember,0);
}
async function refreshMember(){
  if(refreshBusy){refreshQueued=true;return}
  refreshBusy=true;
  try{
    clearRealtime();
    if(!session){member=null;clearData();renderLoggedOut();return}
    const s=await client(),{data,error}=await s.rpc('sync_current_member');
    if(error)throw error;
    member=data;
    if(member?.active){await loadBaseData();setupRealtime()}
    renderClub();
  }catch(e){
    console.error(e);
    if($('clubRoot'))$('clubRoot').innerHTML=`<div class="empty error-box">${esc(e.message||'Account kon niet worden geladen.')}</div>`;
  }finally{
    refreshBusy=false;
    if(refreshQueued){refreshQueued=false;setTimeout(refreshMember,0)}
  }
}
function clearData(){
  teams=[];memberTeams=[];members=[];memberTeamRows=[];taskEvents=[];attendanceRows=[];notifications=[];swaps=[];matchRows=[];
}

function renderLoggedOut(){
  updateNavLabel();
  const root=$('clubRoot');if(!root)return;
  root.innerHTML=`<div class="club-card-panel auth-box"><h2>Ledenlogin</h2><p>Alleen geregistreerde clubleden krijgen toegang tot aanwezigheid, taakwissels en beheer.</p><form id="loginForm" class="club-form"><label>E-mailadres<input id="loginEmail" type="email" required autocomplete="email" placeholder="jij@voorbeeld.nl"></label><button class="primary-button" type="submit">Stuur inloglink</button></form><div class="auth-message">Je ontvangt een beveiligde eenmalige inloglink per e-mail.</div></div>`;
  const form=$('loginForm');
  form?.addEventListener('submit',async e=>{
    e.preventDefault();
    const email=$('loginEmail')?.value.trim();if(!email)return;
    const s=await client(),{error}=await s.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:location.origin+location.pathname}});
    if(error)toast(error.message);else toast('Inloglink verstuurd. Controleer je e-mail.');
  });
}
function renderPending(){
  updateNavLabel();
  const root=$('clubRoot');if(!root)return;
  root.innerHTML=`<div class="club-card-panel auth-box"><h2>Account nog niet actief</h2><p>Je bent ingelogd, maar dit account is nog niet gekoppeld aan een actief lid.</p><div class="auth-message">Een admin kan jouw e-mailadres toevoegen aan de ledenadministratie.</div><div id="firstAdminBox" class="club-card-panel"><h3>Eerste administrator instellen</h3><form id="claimAdminForm" class="club-form"><label>Eenmalige setupcode<input id="adminSetupCode" class="bootstrap-code" required></label><button class="primary-button" type="submit">Maak mij eerste admin</button></form></div><div class="club-actions"><button class="mini-button" id="pendingRefresh">Opnieuw controleren</button><button class="mini-button" id="pendingLogout">Uitloggen</button></div></div>`;
  $('pendingRefresh').onclick=refreshMember;$('pendingLogout').onclick=signOut;
  $('claimAdminForm').onsubmit=async e=>{
    e.preventDefault();const s=await client(),{data,error}=await s.rpc('claim_first_admin',{p_code:$('adminSetupCode').value.trim()});
    if(error)return toast(error.message);member=data;toast('Eerste admin geactiveerd.');await refreshMember();
  };
}
async function signOut(){const s=await client();await s.auth.signOut()}

async function loadBaseData(){
  const s=await client();
  const req=[
    s.from('teams').select('*').eq('active',true).order('team_name'),
    s.from('member_teams').select('team_id,teams(*)').eq('member_id',member.id),
    s.from('task_events').select('*,task_assignments(*)').eq('active',true).order('event_date').order('start_time'),
    s.from('attendance').select('*').eq('member_id',member.id),
    s.from('notifications').select('*').eq('recipient_member_id',member.id).is('acknowledged_at',null).order('created_at',{ascending:false}).limit(100),
    s.from('task_swap_requests').select('*,task_assignments(*,task_events(*))').eq('status','open').order('created_at',{ascending:false})
  ];
  const a=await Promise.all(req);
  a.forEach(r=>{if(r.error)console.warn(r.error)});
  teams=a[0].data||[];
  memberTeams=(a[1].data||[]).map(x=>x.teams).filter(Boolean);
  taskEvents=a[2].data||[];
  attendanceRows=a[3].data||[];
  notifications=a[4].data||[];
  swaps=a[5].data||[];
  if(member.role==='admin')await loadAdminData();
  await loadMemberMatches();
}
async function loadAdminData(){
  const s=await client(),a=await Promise.all([
    s.from('members').select('*').order('full_name'),
    s.from('member_teams').select('*')
  ]);
  members=a[0].data||[];memberTeamRows=a[1].data||[];
}

async function loadMemberMatches(){
  const guids=[...new Set(memberTeams.map(t=>t.foy_team_guid).filter(Boolean))];
  if(!guids.length){matchRows=[];return}
  const q=seasonRange(),byId=new Map();let cursor=0;
  const workers=Array.from({length:Math.min(4,guids.length)},async()=>{
    while(cursor<guids.length){
      const guid=guids[cursor++];let skip=0,total=Infinity;
      while(skip<total){
        const p=new URLSearchParams({startDate:q.start,endDate:q.end,teamGuid:guid,skipCount:String(skip),maxResultCount:'100',sorting:'date asc, startTime asc'});
        const r=await fetch(`https://api.foys.io/competition/public-api/v1/matches?${p}`,{headers:{Accept:'application/json','X-FederationID':F},cache:'no-store'});
        if(!r.ok)break;
        const j=await r.json(),rows=j.items||[];rows.forEach(x=>byId.set(String(x.id),x));
        total=Number(j.totalCount)||rows.length;skip+=rows.length;if(!rows.length||rows.length<100)break;
      }
    }
  });
  await Promise.all(workers);
  matchRows=[...byId.values()].sort((a,b)=>`${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
}

function allowedViews(){
  const a=[];
  if(member?.role==='admin')a.push('admin');
  if(member?.is_trainer)a.push('trainer');
  a.push('presence','mytasks','swaps','notices');
  return a;
}
function updateNavLabel(){
  const n=document.querySelector('.tab[data-view="club"] .club-tab-label');if(!n)return;
  n.textContent=!member?.active?'Club/inloggen':member.role==='admin'&&member.is_trainer?'Club/admin/trainer':member.role==='admin'?'Club/admin':member.is_trainer?'Club/trainer':'Club';
}
function renderClub(){
  if(!session){renderLoggedOut();return}
  if(!member?.active){renderPending();return}
  updateNavLabel();
  const root=$('clubRoot');if(!root)return;
  const unread=notifications.filter(n=>!n.read_at).length,state=readState(),allowed=allowedViews();
  const desired=allowed.includes(state.club)?state.club:(member.role==='admin'?'admin':member.is_trainer?'trainer':'presence');
  const button=(name,label)=>`<button data-clubview="${name}" class="${desired===name?'active':''}">${label}</button>`;
  const view=name=>`<div id="club-sub-${name}" class="club-subview ${desired===name?'active':''}"></div>`;
  root.innerHTML=`<div class="club-card-panel"><div class="club-row-head"><div><h2>${esc(member.full_name||member.email||'Lid')}</h2><p>${member.role==='admin'?'Administrator':'Lid'} · ${esc(member.email||member.phone||'')}</p></div><button class="mini-button" id="logoutBtn">Uitloggen</button></div>${memberTeams.length?`<div>${memberTeams.map(t=>`<span class="club-pill">${esc(t.team_name)}</span>`).join('')}</div>`:'<p>Nog geen teams gekoppeld.</p>'}</div>
    <div class="club-section-tabs" id="clubTabs">
      ${member.role==='admin'?button('admin','Admin'):''}
      ${member.is_trainer?button('trainer','Trainer'):''}
      ${button('presence','Aanwezigheid')}
      ${button('mytasks','Mijn taken')}
      ${button('swaps','Wisselen')}
      ${button('notices',`Meldingen${unread?'<span class="notification-dot"></span>':''}`)}
    </div>
    ${member.role==='admin'?view('admin'):''}
    ${member.is_trainer?view('trainer'):''}
    ${view('presence')}${view('mytasks')}${view('swaps')}${view('notices')}`;
  $('logoutBtn').onclick=signOut;
  root.querySelectorAll('#clubTabs [data-clubview]').forEach(b=>b.onclick=()=>switchClubView(b.dataset.clubview));
  renderAttendance();renderMyTasks();renderSwaps();renderNotifications();
  if(member.role==='admin')renderAdmin();
  document.dispatchEvent(new CustomEvent('basketball-club-rendered',{detail:{view:desired,member:{id:member.id,role:member.role,is_trainer:!!member.is_trainer}}}));
  if(desired==='trainer')document.dispatchEvent(new CustomEvent('basketball-club-view-changed',{detail:{view:'trainer'}}));
}
function switchClubView(name){
  const root=$('clubRoot');if(!root||!allowedViews().includes(name))return;
  root.querySelectorAll('#clubTabs [data-clubview]').forEach(b=>b.classList.toggle('active',b.dataset.clubview===name));
  root.querySelectorAll(':scope > .club-subview').forEach(v=>v.classList.toggle('active',v.id===`club-sub-${name}`));
  writeState({main:'club',club:name});
  if(name==='notices')markNotificationsRead();
  if(name==='mytasks')scheduleMyTasksScroll(true,40);
  document.dispatchEvent(new CustomEvent('basketball-club-view-changed',{detail:{view:name}}));
}

function teamLabel(m,side){
  const sponsor=m[`${side}TeamSponsorClubName`],org=m[`${side}Organisation`]?.name,tn=m[`${side}TeamName`]||'';
  return [sponsor||org,tn].filter(Boolean).join(' ').trim();
}
function renderAttendance(){
  const target=$('club-sub-presence');if(!target)return;
  const today=new Date().toISOString().slice(0,10),rows=matchRows.filter(m=>dateOnly(m.date)>=today),byMatch=new Map(attendanceRows.map(a=>[String(a.foy_match_id),a.attending]));
  target.innerHTML=`<div class="club-card-panel"><h2>Aanwezigheid</h2><p>Kies per wedstrijd Ja of Nee.</p><div class="club-list">${rows.length?rows.map(m=>{const s=byMatch.get(String(m.id));return `<div class="club-row"><strong>${esc(teamLabel(m,'home'))} — ${esc(teamLabel(m,'away'))}</strong><small>${esc(fmtDate(m.date))} · ${esc(timeOnly(m.startTime))} · ${esc(m.accommodationName||'')}</small><div class="attendance-choice"><button class="mini-button yes ${s===true?'selected':''}" data-attend="yes" data-match="${esc(m.id)}">Ja</button><button class="mini-button no ${s===false?'selected':''}" data-attend="no" data-match="${esc(m.id)}">Nee</button></div></div>`}).join(''):'<div class="club-empty">Geen komende wedstrijden voor jouw teams.</div>'}</div></div>`;
  target.querySelectorAll('[data-attend]').forEach(b=>b.onclick=()=>saveAttendance(b.dataset.match,b.dataset.attend==='yes'));
}
async function saveAttendance(matchId,value){
  const s=await client(),{error}=await s.from('attendance').upsert({foy_match_id:Number(matchId),member_id:member.id,attending:value,updated_at:new Date().toISOString()},{onConflict:'foy_match_id,member_id'});
  if(error)return toast(error.message);
  const i=attendanceRows.findIndex(a=>String(a.foy_match_id)===String(matchId)),row={foy_match_id:Number(matchId),member_id:member.id,attending:value};
  if(i>=0)attendanceRows[i]=row;else attendanceRows.push(row);
  renderAttendance();toast(value?'Aanwezig: Ja':'Aanwezig: Nee');
}

function myAssignments(){
  const name=String(member.full_name||'').trim().toLowerCase();
  return taskEvents.flatMap(e=>(e.task_assignments||[]).filter(a=>a.assigned_member_id===member.id||(!a.assigned_member_id&&String(a.assigned_name||'').trim().toLowerCase()===name)).map(a=>({event:e,assignment:a}))).sort((a,b)=>`${a.event.event_date}T${a.event.start_time}`.localeCompare(`${b.event.event_date}T${b.event.start_time}`));
}
let myTasksDateScrollKey='';
function localTodayClub(){const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`}
function scrollMyTasksToCurrent(force=false){
  const target=$('club-sub-mytasks');if(!target?.classList.contains('active'))return false;
  const rows=[...target.querySelectorAll('[data-list-date]')];if(!rows.length)return false;
  const today=localTodayClub(),row=rows.find(x=>x.dataset.listDate===today)||rows.find(x=>x.dataset.listDate>today);
  if(!row)return false;
  const key=`${member?.id||''}|${today}`;
  if(!force&&myTasksDateScrollKey===key)return true;
  const topbar=document.querySelector('.topbar'),offset=(topbar?.getBoundingClientRect().height||0)+8;
  window.scrollTo({top:Math.max(0,row.getBoundingClientRect().top+window.scrollY-offset),behavior:'auto'});
  myTasksDateScrollKey=key;return true;
}
function scheduleMyTasksScroll(force=false,delay=50){setTimeout(()=>requestAnimationFrame(()=>scrollMyTasksToCurrent(force)),delay)}

function renderMyTasks(){
  const target=$('club-sub-mytasks');if(!target)return;const mine=myAssignments();
  target.innerHTML=`<div class="club-card-panel"><h2>Mijn taken</h2><p>Vraag hier een wissel aan voor een taak die aan jou is toegewezen.</p><div class="club-list">${mine.length?mine.map(x=>{const open=swaps.some(s=>s.assignment_id===x.assignment.id);return `<div class="club-row" data-list-date="${esc(x.event.event_date)}"><strong>${esc(roleLabel(x.assignment.role))} · ${esc(x.event.home)} — ${esc(x.event.away)}</strong><small>${esc(fmtDate(x.event.event_date))} · aanwezig ${esc(timeOnly(x.event.arrival_time||x.event.start_time))}</small><div class="mini-actions"><button class="mini-button ${open?'':'primary'}" data-swap-request="${x.assignment.id}" ${open?'disabled':''}>${open?'Wissel staat open':'Taak wisselen'}</button></div></div>`}).join(''):'<div class="club-empty">Geen taken aan jou gekoppeld.</div>'}</div></div>`;
  target.querySelectorAll('[data-swap-request]').forEach(b=>b.onclick=()=>requestSwap(b.dataset.swapRequest));
  scheduleMyTasksScroll(false,60);
}
async function requestSwap(id){const s=await client(),{error}=await s.rpc('request_task_swap',{p_assignment_id:id});if(error)return toast(error.message);toast('Taakwissel staat open.');await reloadDynamic()}

function renderSwaps(){
  const target=$('club-sub-swaps');if(!target)return;
  target.innerHTML=`<div class="club-card-panel"><h2>Open taakwissels</h2><div class="club-list">${swaps.length?swaps.map(s=>{const a=s.task_assignments||{},e=a.task_events||{},own=s.requested_by===member.id;return `<div class="club-row"><strong>${esc(roleLabel(a.role))} · ${esc(e.home||'Taak')} — ${esc(e.away||'')}</strong><small>${esc(fmtDate(e.event_date||s.created_at))} · ${esc(a.assigned_name||'')}</small><div class="mini-actions">${own?`<button class="mini-button danger" data-cancel-swap="${s.id}">Annuleren</button>`:`<button class="mini-button primary" data-accept-swap="${s.id}">Taak overnemen</button>`}</div></div>`}).join(''):'<div class="club-empty">Geen open wisselverzoeken.</div>'}</div></div>`;
  target.querySelectorAll('[data-accept-swap]').forEach(b=>b.onclick=()=>acceptSwap(b.dataset.acceptSwap));
  target.querySelectorAll('[data-cancel-swap]').forEach(b=>b.onclick=()=>cancelSwap(b.dataset.cancelSwap));
}
async function acceptSwap(id){const s=await client(),{error}=await s.rpc('accept_task_swap',{p_request_id:id});if(error)return toast(error.message);toast('Taak is aan jou toegewezen.');await reloadDynamic()}
async function cancelSwap(id){const s=await client(),{error}=await s.rpc('cancel_task_swap',{p_request_id:id});if(error)return toast(error.message);toast('Wissel geannuleerd.');await reloadDynamic()}

function renderNotifications(){
  const target=$('club-sub-notices');if(!target)return;
  target.innerHTML=`<div class="club-card-panel"><h2>Meldingen</h2><div class="club-list">${notifications.length?notifications.map(n=>`<div class="club-row notice-row ${n.read_at?'':'notice-unread'}"><button class="notice-dismiss" type="button" data-dismiss-notification="${esc(n.id)}" aria-label="Melding verwijderen">×</button><strong>${esc(n.title)}</strong><small>${esc(n.message)}<br>${esc(new Intl.DateTimeFormat('nl-NL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(n.created_at)))}</small></div>`).join(''):'<div class="club-empty">Geen meldingen.</div>'}</div></div>`;
  target.querySelectorAll('[data-dismiss-notification]').forEach(b=>b.onclick=()=>dismissNotification(b.dataset.dismissNotification));
}
function updateNotificationDot(){
  const button=document.querySelector('#clubTabs [data-clubview="notices"]');if(!button)return;
  const unread=notifications.some(n=>!n.read_at);
  const dot=button.querySelector('.notification-dot');
  if(unread&&!dot){const span=document.createElement('span');span.className='notification-dot';button.appendChild(span)}
  if(!unread&&dot)dot.remove();
}
async function dismissNotification(id){
  const item=notifications.find(n=>String(n.id)===String(id));if(!item)return;
  const s=await client(),now=new Date().toISOString();
  let q=s.from('notifications').update({read_at:now,acknowledged_at:now}).eq('recipient_member_id',member.id);
  q=item.source_key?q.eq('source_key',item.source_key):q.eq('id',item.id);
  const {error}=await q;if(error)return toast(error.message);
  notifications=notifications.filter(n=>item.source_key?String(n.source_key)!==String(item.source_key):String(n.id)!==String(item.id));
  renderNotifications();updateNotificationDot();
}
async function markNotificationsRead(){
  const unread=notifications.filter(n=>!n.read_at).map(n=>n.id);if(!unread.length){updateNotificationDot();return}
  const s=await client(),{error}=await s.from('notifications').update({read_at:new Date().toISOString()}).in('id',unread);
  if(error){console.warn(error);return}
  const now=new Date().toISOString();notifications.forEach(n=>{if(unread.includes(n.id))n.read_at=now});renderNotifications();updateNotificationDot();
}

function renderAdmin(){
  const target=$('club-sub-admin');if(!target)return;
  const saved=readState(),initial=saved.admin==='agenda'?'agenda':'members';
  target.innerHTML=`<div class="club-card-panel"><h2>Adminbeheer</h2><p>Beheer leden, trainingsschema en taken.</p><div class="club-section-tabs" id="adminTabs"><button data-adminview="members" class="${initial==='members'?'active':''}">Leden</button><button data-adminview="agenda" class="${initial==='agenda'?'active':''}">Agenda beheren</button></div><div id="admin-members" ${initial==='members'?'':'hidden'}></div><div id="admin-agenda" ${initial==='agenda'?'':'hidden'}></div></div>`;
  target.querySelectorAll('#adminTabs [data-adminview]').forEach(b=>b.onclick=()=>switchAdminView(b.dataset.adminview));
  renderAdminMembers();
  document.dispatchEvent(new CustomEvent('basketball-admin-view-changed',{detail:{view:initial}}));
}
function switchAdminView(view){
  const target=$('club-sub-admin');if(!target)return;
  target.querySelectorAll('#adminTabs [data-adminview]').forEach(b=>b.classList.toggle('active',b.dataset.adminview===view));
  if($('admin-members'))$('admin-members').hidden=view!=='members';
  if($('admin-agenda'))$('admin-agenda').hidden=view!=='agenda';
  writeState({main:'club',club:'admin',admin:view});
  document.dispatchEvent(new CustomEvent('basketball-admin-view-changed',{detail:{view}}));
}
function renderAdminMembers(editId=''){
  const target=$('admin-members');if(!target)return;
  const edit=members.find(m=>String(m.id)===String(editId)),selectedTeams=new Set(memberTeamRows.filter(x=>String(x.member_id)===String(editId)).map(x=>String(x.team_id)));
  target.innerHTML=`<h3>${edit?'Lid wijzigen':'Nieuw lid'}</h3><form id="memberForm" class="club-form"><input type="hidden" id="memberId" value="${esc(edit?.id||'')}"><div class="club-form two"><label>Naam<input id="memberName" required value="${esc(edit?.full_name||'')}"></label><label>E-mail<input id="memberEmail" type="email" value="${esc(edit?.email||'')}"></label><label>Telefoon<input id="memberPhone" type="tel" value="${esc(edit?.phone||'')}"></label><label class="member-admin-option"><input id="memberAdmin" type="checkbox" ${edit?.role==='admin'?'checked':''}> Admin</label></div><label><input id="memberActive" type="checkbox" ${edit?edit.active?'checked':'':'checked'}> Actief</label><div><strong style="font-size:9px">Teams</strong><div class="member-team-grid">${teams.filter(t=>String(t.team_name||'').trim().toLowerCase()!=='alle teams').map(t=>`<label class="member-team-option"><input type="checkbox" name="memberTeam" value="${t.id}" ${selectedTeams.has(String(t.id))?'checked':''}>${esc(t.team_name)}</label>`).join('')}</div></div><div class="club-actions"><button class="primary-button" type="submit">${edit?'Opslaan':'Lid toevoegen'}</button>${edit?'<button class="mini-button" type="button" id="memberCancel">Annuleren</button>':''}</div></form><h3>Leden</h3><div class="club-list">${members.map(m=>{const mts=memberTeamRows.filter(x=>x.member_id===m.id).map(x=>teams.find(t=>t.id===x.team_id)?.team_name).filter(x=>x&&String(x).trim().toLowerCase()!=='alle teams');return `<div class="club-row"><div class="club-row-head"><div><strong>${esc(m.full_name||'(naam ontbreekt)')}</strong><small>${esc(m.email||m.phone||'Geen login-id')} · ${m.active?'Actief':'Inactief'}</small></div><span class="club-pill ${m.role==='admin'?'admin':''}">${m.role==='admin'?'Admin':'Lid'}</span></div><div>${mts.map(x=>`<span class="club-pill">${esc(x)}</span>`).join('')}</div><div class="mini-actions"><button class="mini-button" data-edit-member="${m.id}">Wijzigen</button></div></div>`}).join('')}</div>`;
  $('memberForm')?.addEventListener('submit',saveMember);
  $('memberCancel')?.addEventListener('click',()=>renderAdminMembers());
  target.querySelectorAll('[data-edit-member]').forEach(b=>b.onclick=()=>{renderAdminMembers(b.dataset.editMember);document.dispatchEvent(new CustomEvent('basketball-admin-members-rendered'));requestAnimationFrame(()=>$('memberForm')?.scrollIntoView({behavior:'smooth',block:'start'}))});
  document.dispatchEvent(new CustomEvent('basketball-admin-members-rendered'));
}
async function saveMember(e){
  e.preventDefault();
  const s=await client(),id=$('memberId').value||null,payload={full_name:$('memberName').value.trim(),email:$('memberEmail').value.trim()||null,phone:$('memberPhone').value.trim()||null,role:$('memberAdmin').checked?'admin':'member',active:$('memberActive').checked};
  let mid=id;
  if(id){const r=await s.from('members').update(payload).eq('id',id);if(r.error)return toast(r.error.message)}
  else{const r=await s.from('members').insert(payload).select().single();if(r.error)return toast(r.error.message);mid=r.data.id}
  let r=await s.from('member_teams').delete().eq('member_id',mid);if(r.error)return toast(r.error.message);
  const blocked=new Set(teams.filter(t=>String(t.team_name||'').trim().toLowerCase()==='alle teams').map(t=>String(t.id))),teamIds=[...document.querySelectorAll('input[name="memberTeam"]:checked')].map(x=>x.value).filter(id=>!blocked.has(String(id)));
  if(teamIds.length){r=await s.from('member_teams').insert(teamIds.map(team_id=>({member_id:mid,team_id})));if(r.error)return toast(r.error.message)}
  toast('Lid opgeslagen.');await loadAdminData();renderAdminMembers();
}

async function reloadDynamic(){await loadBaseData();renderClub()}

function clearRealtime(){
  if(realtime&&sb){try{sb.removeChannel(realtime)}catch{}}
  realtime=null;
}
function setupRealtime(){
  if(!sb||!member)return;
  clearRealtime();
  const c=sb.channel(`club-v6-${member.id}-${Date.now()}`);
  c.on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`recipient_member_id=eq.${member.id}`},()=>queueRefresh());
  c.on('postgres_changes',{event:'*',schema:'public',table:'task_swap_requests'},()=>queueRefresh());
  c.on('postgres_changes',{event:'*',schema:'public',table:'task_assignments'},()=>queueRefresh());
  c.on('postgres_changes',{event:'*',schema:'public',table:'task_events'},()=>queueRefresh());
  realtime=c;c.subscribe();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();