(()=>{
'use strict';

const U='https://elpnfmlrkoemjrnzaeok.supabase.co';
const K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
let sb=null,me=null,teams=[],members=[],events=[],swaps=[],loading=false,adminDateScrollKey='';
const filter={team:'',person:'',editing:''};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const tm=v=>String(v||'').slice(0,5);
const norm=v=>String(v||'').trim().toLowerCase();
const roleLabel=r=>r==='referee'?'Scheidsrechter':r==='table'?'Tafel':'Overig';
const dateLabel=v=>{try{return new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(new Date(`${String(v).slice(0,10)}T12:00:00`)).toUpperCase()}catch{return String(v||'').toUpperCase()}};

function toast(m){const e=$('toast');if(!e)return alert(m);e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2400)}
async function client(){if(sb)return sb;const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});return sb}

function css(){
  if($('adminAgendaV4Css'))return;
  const s=document.createElement('style');s.id='adminAgendaV4Css';
  s.textContent=`.admin-agenda-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin:4px 0 12px}.admin-agenda-head h3{margin:0;font-size:18px}.admin-agenda-head p{margin:3px 0 0;color:var(--muted);font-size:11px;line-height:1.35}.admin-agenda-filters{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}.admin-agenda-filters label{font-size:10px;font-weight:800;color:var(--muted)}.admin-agenda-filters select{margin-top:4px;width:100%;min-height:40px;border:1px solid var(--line);border-radius:12px;background:var(--card);padding:0 10px;font:inherit;font-size:12px;font-weight:700;color:var(--ink)}.admin-agenda-day{margin:16px 0 8px;font-size:11px;font-weight:900}.admin-agenda-event{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px 11px;margin-bottom:8px}.admin-agenda-event-top{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:9px;align-items:start}.admin-agenda-time{font-size:17px;font-weight:900}.admin-agenda-time small{display:block;margin-top:4px;font-size:8px;color:var(--muted);font-weight:800}.admin-agenda-title{font-size:12px;font-weight:900}.admin-agenda-meta{margin-top:3px;font-size:9px;color:var(--muted)}.admin-task-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}.admin-task-chip{display:inline-flex;padding:4px 6px;border-radius:9px;background:#f1f2f7;font-size:9px}.admin-task-chip.swap{background:#fff1e8;color:#a64700}.admin-agenda-edit{border-top:1px solid var(--line);margin-top:10px;padding-top:10px}.admin-edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.admin-edit-grid label{font-size:9px;font-weight:800;color:var(--muted)}.admin-edit-grid input,.admin-edit-grid select{width:100%;margin-top:3px;min-height:38px;border:1px solid var(--line);border-radius:10px;background:var(--card);padding:0 9px;font:inherit;font-size:11px;color:var(--ink)}.admin-assignment-edit{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,.9fr) auto;gap:6px;align-items:center;margin-top:7px}.admin-assignment-edit select{width:100%;min-height:36px;border:1px solid var(--line);border-radius:10px;background:var(--card);padding:0 7px;font:inherit;font-size:10px;color:var(--ink)}.admin-edit-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.admin-swap-note{font-size:8px;font-weight:900;color:#b44a00;margin-top:3px}@media(max-width:520px){.admin-agenda-event-top{grid-template-columns:46px minmax(0,1fr) auto}.admin-assignment-edit{grid-template-columns:1fr 1fr}.admin-assignment-actions{grid-column:1/-1}}`;
  document.head.appendChild(s);
}

async function secureLogin(form){
  const email=String(form.querySelector('#loginEmail')?.value||'').trim();if(!email)return;
  const button=form.querySelector('button[type="submit"]');if(button){button.disabled=true;button.textContent='Controleren…'}
  try{
    const s=await client(),{data:allowed,error:check}=await s.rpc('member_login_allowed',{p_email:email,p_phone:null});
    if(check)throw check;if(!allowed){toast('Dit e-mailadres staat niet als actief lid geregistreerd.');return}
    if(button)button.textContent='Inloglink versturen…';
    const {error}=await s.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:location.origin+location.pathname}});
    if(error)throw error;toast('Inloglink verstuurd. Controleer je e-mail.');
  }catch(e){console.error(e);toast(e.message||'Inloggen is mislukt.')}
  finally{if(button){button.disabled=false;button.textContent='Stuur inloglink'}}
}

async function loadData(){
  const s=await client(),{data:{session}}=await s.auth.getSession();if(!session)throw new Error('Niet ingelogd.');
  const {data:m,error:memberError}=await s.rpc('sync_current_member');if(memberError)throw memberError;if(m?.role!=='admin')throw new Error('Alleen admins hebben toegang tot Beheeragenda.');
  me=m;
  const a=await Promise.all([
    s.from('teams').select('*').eq('active',true).order('team_name'),
    s.from('members').select('*').eq('active',true).order('full_name'),
    s.from('task_events').select('*,task_assignments(*)').eq('active',true).order('event_date').order('start_time'),
    s.from('task_swap_requests').select('*').order('created_at',{ascending:false}).limit(500)
  ]);
  for(const r of a)if(r.error)throw r.error;
  teams=a[0].data||[];members=a[1].data||[];events=a[2].data||[];swaps=a[3].data||[];
}
function teamOptions(selected='',label='Alle teams'){return `<option value="">${label}</option>${teams.map(x=>`<option value="${esc(x.id)}" ${String(selected)===String(x.id)?'selected':''}>${esc(x.team_name)}</option>`).join('')}`}
function memberOptions(selected='',all=false){return `<option value="">${all?'Alle personen':'Niet toegewezen'}</option>${members.map(x=>`<option value="${esc(x.id)}" ${String(selected)===String(x.id)?'selected':''}>${esc(x.full_name||x.email||'Lid')}</option>`).join('')}`}
function swapFor(a){return swaps.find(s=>String(s.assignment_id)===String(a.id))||null}
function passes(e){
  if(filter.team&&String(e.team_id||'')!==String(filter.team))return false;
  if(filter.person){
    const m=members.find(x=>String(x.id)===String(filter.person));
    return (e.task_assignments||[]).some(a=>String(a.assigned_member_id||'')===String(filter.person)||(!a.assigned_member_id&&norm(a.assigned_name)===norm(m?.full_name)));
  }
  return true;
}
function taskChips(e){
  const as=e.task_assignments||[];if(!as.length)return '<span class="admin-task-chip"><strong>Geen taken</strong></span>';
  return as.map(a=>{const sw=swapFor(a),changed=sw&&sw.status!=='cancelled',tag=changed?(sw.status==='open'?' · wissel open':' · gewisseld'):'';return `<span class="admin-task-chip ${changed?'swap':''}"><strong>${esc(roleLabel(a.role))}:</strong>&nbsp;${esc(a.assigned_name||'Niet toegewezen')}${esc(tag)}</span>`}).join('');
}
function assignmentEditor(a){
  const sw=swapFor(a),note=sw?(sw.status==='open'?'Wissel staat open':sw.status==='cancelled'?'':'Taak is via wissel aangepast'):'';
  return `<div class="admin-assignment-edit" data-assignment="${esc(a.id)}"><select data-assignment-member>${memberOptions(a.assigned_member_id||'')}</select><select data-assignment-role><option value="referee" ${a.role==='referee'?'selected':''}>Scheidsrechter</option><option value="table" ${a.role==='table'?'selected':''}>Tafel</option><option value="other" ${a.role==='other'?'selected':''}>Overig</option></select><div class="admin-assignment-actions"><button class="mini-button" data-save-assignment="${esc(a.id)}">Opslaan</button><button class="mini-button danger" data-delete-assignment="${esc(a.id)}">×</button></div>${note?`<div class="admin-swap-note">${esc(note)}</div>`:''}</div>`;
}
function editBlock(e){
  return `<div class="admin-agenda-edit" data-edit-block="${esc(e.id)}"><div class="admin-edit-grid"><label>Team<select data-event-field="team_id">${teamOptions(e.team_id||'','Geen team')}</select></label><label>Datum<input data-event-field="event_date" type="date" value="${esc(e.event_date||'')}"></label><label>Aanwezig-tijd<input data-event-field="arrival_time" type="time" value="${esc(tm(e.arrival_time))}"></label><label>Start wedstrijd<input data-event-field="start_time" type="time" value="${esc(tm(e.start_time))}"></label><label>Locatie<input data-event-field="location" value="${esc(e.location||'')}"></label><label>Veld<input data-event-field="field" value="${esc(e.field||'')}"></label></div><div class="admin-edit-actions"><button class="mini-button primary" data-save-event="${esc(e.id)}">Gegevens opslaan</button><button class="mini-button" data-close-event>Sluiten</button></div><div style="margin-top:10px;font-size:10px;font-weight:900">Taken</div>${(e.task_assignments||[]).map(assignmentEditor).join('')}<div class="admin-edit-actions"><button class="mini-button" data-add-assignment="${esc(e.id)}">+ Toewijzing</button><button class="mini-button danger" data-delete-event="${esc(e.id)}">Taakmoment verwijderen</button></div></div>`;
}
function eventCard(e){
  const team=teams.find(x=>String(x.id)===String(e.team_id)),location=[e.location,e.field].filter(Boolean).join(' · ');
  return `<div class="admin-agenda-event" data-event="${esc(e.id)}"><div class="admin-agenda-event-top"><div class="admin-agenda-time">${esc(tm(e.start_time)||'—')}<small>${e.arrival_time?`aanw. ${esc(tm(e.arrival_time))}`:'geen aankomsttijd'}</small></div><div><div class="admin-agenda-title">${esc(e.home||'')} — ${esc(e.away||'')}</div><div class="admin-agenda-meta">${esc(team?.team_name||'Geen team')}${location?' · '+esc(location):''}</div><div class="admin-task-chips">${taskChips(e)}</div></div><button class="mini-button" data-edit-event="${esc(e.id)}">Wijzigen</button></div>${String(filter.editing)===String(e.id)?editBlock(e):''}</div>`;
}
function localToday(){const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`}
function scrollAdminAgendaToCurrent(force=false){
  const root=$('admin-agenda');if(!root||root.hidden)return false;
  const days=[...root.querySelectorAll('.admin-agenda-day[data-list-date]')];
  if(!days.length)return false;
  const today=localToday(),target=days.find(x=>x.dataset.listDate===today)||days.find(x=>x.dataset.listDate>today);
  if(!target)return false;
  const key=`${filter.team}|${filter.person}|${today}`;
  if(!force&&adminDateScrollKey===key)return true;
  const topbar=document.querySelector('.topbar'),offset=(topbar?.getBoundingClientRect().height||0)+8;
  const top=Math.max(0,target.getBoundingClientRect().top+window.scrollY-offset);
  window.scrollTo({top,behavior:'auto'});adminDateScrollKey=key;return true;
}
function scheduleAdminAgendaScroll(force=false,delay=50){setTimeout(()=>requestAnimationFrame(()=>scrollAdminAgendaToCurrent(force)),delay)}

function render(){
  const root=$('admin-agenda');if(!root||root.hidden)return;
  root.dataset.adminAgendaV4='1';
  const rows=events.filter(passes).sort((a,b)=>`${a.event_date}T${a.start_time||''}`.localeCompare(`${b.event_date}T${b.start_time||''}`));
  let body='',day='';
  for(const e of rows){if(e.event_date!==day){day=e.event_date;body+=`<div class="admin-agenda-day" data-list-date="${esc(day)}">${esc(dateLabel(day))}</div>`}body+=eventCard(e)}
  root.innerHTML=`<div class="admin-agenda-head"><div><h3>Beheeragenda</h3><p>Taken, toewijzingen en lokale wedstrijdtijden beheren.</p></div></div><div class="admin-agenda-filters"><label>Team<select id="adminAgendaTeamFilter">${teamOptions(filter.team)}</select></label><label>Persoon<select id="adminAgendaPersonFilter">${memberOptions(filter.person,true)}</select></label></div><div>${body||'<div class="club-empty">Geen taakmomenten voor deze filters.</div>'}</div>`;
  bind(root);
  scheduleAdminAgendaScroll(false,60);
  document.dispatchEvent(new CustomEvent('admin-agenda-refreshed'));
}
function bind(root){
  $('adminAgendaTeamFilter').onchange=e=>{filter.team=e.target.value;filter.editing='';adminDateScrollKey='';render()};
  $('adminAgendaPersonFilter').onchange=e=>{filter.person=e.target.value;filter.editing='';adminDateScrollKey='';render()};
  root.querySelectorAll('[data-edit-event]').forEach(b=>b.onclick=()=>{filter.editing=b.dataset.editEvent;render()});
  root.querySelectorAll('[data-close-event]').forEach(b=>b.onclick=()=>{filter.editing='';render()});
  root.querySelectorAll('[data-save-event]').forEach(b=>b.onclick=()=>saveEvent(b.dataset.saveEvent));
  root.querySelectorAll('[data-save-assignment]').forEach(b=>b.onclick=()=>saveAssignment(b.dataset.saveAssignment));
  root.querySelectorAll('[data-delete-assignment]').forEach(b=>b.onclick=()=>deleteAssignment(b.dataset.deleteAssignment));
  root.querySelectorAll('[data-add-assignment]').forEach(b=>b.onclick=()=>addAssignment(b.dataset.addAssignment));
  root.querySelectorAll('[data-delete-event]').forEach(b=>b.onclick=()=>deleteEvent(b.dataset.deleteEvent));
}
async function refresh(keep=true){
  const edit=filter.editing;await loadData();filter.editing=keep?edit:'';render();
}
async function saveEvent(id){
  const block=document.querySelector(`[data-edit-block="${CSS.escape(String(id))}"]`);if(!block)return;
  const val=k=>block.querySelector(`[data-event-field="${k}"]`)?.value||'',payload={team_id:val('team_id')||null,event_date:val('event_date'),arrival_time:val('arrival_time')||null,start_time:val('start_time'),location:val('location').trim()||null,field:val('field').trim()||null};
  if(!payload.event_date||!payload.start_time)return toast('Datum en starttijd zijn verplicht.');
  const s=await client(),{error}=await s.from('task_events').update(payload).eq('id',id);if(error)return toast(error.message);
  toast('Wedstrijdgegevens opgeslagen.');await refresh(true);
}
async function saveAssignment(id){
  const row=document.querySelector(`[data-assignment="${CSS.escape(String(id))}"]`);if(!row)return;
  const memberId=row.querySelector('[data-assignment-member]')?.value||null,role=row.querySelector('[data-assignment-role]')?.value||'other',m=members.find(x=>String(x.id)===String(memberId));
  const s=await client(),{error}=await s.from('task_assignments').update({assigned_member_id:memberId,assigned_name:m?.full_name||'Niet toegewezen',role}).eq('id',id);
  if(error)return toast(error.message);toast('Taak opgeslagen.');await refresh(true);
}
async function deleteAssignment(id){if(!confirm('Deze toewijzing verwijderen?'))return;const s=await client(),{error}=await s.from('task_assignments').delete().eq('id',id);if(error)return toast(error.message);await refresh(true)}
async function addAssignment(eventId){
  const e=events.find(x=>String(x.id)===String(eventId)),slot=Math.max(0,...(e?.task_assignments||[]).map(x=>Number(x.slot)||0))+1,s=await client();
  const {error}=await s.from('task_assignments').insert({task_event_id:eventId,assigned_member_id:null,assigned_name:'Niet toegewezen',role:'other',slot});
  if(error)return toast(error.message);await refresh(true);
}
async function deleteEvent(id){if(!confirm('Dit taakmoment en alle toewijzingen verwijderen?'))return;const s=await client(),{error}=await s.from('task_events').delete().eq('id',id);if(error)return toast(error.message);filter.editing='';await refresh(false)}

function addMemberDeleteButtons(){
  document.querySelectorAll('#admin-members [data-edit-member]').forEach(edit=>{
    const id=String(edit.dataset.editMember||'');if(!id||edit.parentElement?.querySelector(`[data-admin-delete-member="${CSS.escape(id)}"]`))return;
    const card=edit.closest('.club-row'),name=String(card?.querySelector('strong')?.textContent||'dit lid').trim(),del=document.createElement('button');
    del.type='button';del.className='mini-button danger';del.dataset.adminDeleteMember=id;del.dataset.memberName=name;del.textContent='Verwijderen';edit.parentElement?.appendChild(del);
  });
}
async function deleteMember(button){
  const id=String(button.dataset.adminDeleteMember||''),name=String(button.dataset.memberName||'dit lid');if(!id||!confirm(`Weet je zeker dat je ${name} wilt verwijderen?`))return;
  button.disabled=true;
  try{const s=await client(),{error}=await s.rpc('admin_delete_member',{p_member_id:id});if(error)throw error;toast('Lid verwijderd.');setTimeout(()=>location.reload(),180)}
  catch(e){console.error(e);toast(e.message||'Lid verwijderen is mislukt.');button.disabled=false}
}

async function openAgenda(){
  const root=$('admin-agenda');if(!root||root.hidden)return;
  if(loading)return;
  loading=true;
  try{
    css();
    root.innerHTML='<div class="club-empty">Beheeragenda laden…</div>';
    await loadData();
    render();
  }catch(e){
    console.error(e);
    if(root)root.innerHTML=`<div class="club-empty">${esc(e.message||'Beheeragenda kon niet worden geladen.')}</div>`;
  }finally{loading=false}
}

function init(){
  css();
  document.addEventListener('submit',e=>{const form=e.target;if(!(form instanceof HTMLFormElement)||form.id!=='loginForm')return;e.preventDefault();e.stopImmediatePropagation();secureLogin(form)},true);
  document.addEventListener('basketball-admin-view-changed',e=>{
    if(e.detail?.view==='agenda')openAgenda();
    else if(e.detail?.view==='members')addMemberDeleteButtons();
  });
  document.addEventListener('basketball-club-rendered',()=>{addMemberDeleteButtons();const root=$('admin-agenda');if(root&&!root.hidden)openAgenda()});
  document.addEventListener('basketball-admin-members-rendered',addMemberDeleteButtons);
  document.addEventListener('training-data-changed',()=>{const root=$('admin-agenda');if(root&&!root.hidden&&root.dataset.adminAgendaV4==='1')refresh(true)});
  document.addEventListener('click',e=>{const del=e.target.closest?.('[data-admin-delete-member]');if(del){e.preventDefault();deleteMember(del)}},true);
}

init();
})();