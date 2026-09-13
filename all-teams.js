(()=>{
  'use strict';

  const PREFIX='all-';
  const TEAM_PATH='/competition/public-api/v1/organisations/';
  const MATCH_PATH='/competition/public-api/v1/matches';
  const originalFetch=window.fetch.bind(window);
  const clubTeamsCache=new Map();

  function isFoys(url){return url.hostname==='api.foys.io'}
  function clubIdFromTeamsUrl(url){
    const path=url.pathname;
    if(!path.includes(TEAM_PATH)||!path.endsWith('/teams'))return '';
    const rest=path.split(TEAM_PATH)[1]||'';
    return decodeURIComponent(rest.slice(0,-'/teams'.length));
  }
  function allGuid(clubId){return `${PREFIX}${clubId}`}
  function clubIdFromAllGuid(guid){return String(guid||'').startsWith(PREFIX)?String(guid).slice(PREFIX.length):''}
  function syntheticTeam(clubId,teams){
    const first=teams[0]||{};
    return {id:null,guid:allGuid(clubId),name:'Alle teams',organisationName:first.organisationName||first.organisation?.name||'Vereniging',logoUrl:first.logoUrl||''};
  }
  function jsonResponse(data,sourceResponse){
    const headers=new Headers(sourceResponse?.headers||{});
    headers.set('Content-Type','application/json; charset=utf-8');
    return new Response(JSON.stringify(data),{status:200,statusText:'OK',headers});
  }
  async function loadRealTeams(clubId,requestInit){
    if(clubTeamsCache.has(clubId))return clubTeamsCache.get(clubId);
    const url=`https://api.foys.io/competition/public-api/v1/organisations/${encodeURIComponent(clubId)}/teams`;
    const response=await originalFetch(url,{...requestInit,cache:'no-store'});
    if(!response.ok)throw new Error(`Teams ophalen mislukt: ${response.status}`);
    const data=await response.json();
    const teams=(Array.isArray(data)?data:[]).filter(team=>team?.guid&&!String(team.guid).startsWith(PREFIX));
    clubTeamsCache.set(clubId,teams);
    return teams;
  }
  async function fetchTeamMatches(guid,baseUrl,requestInit){
    const rows=[];let skip=0,total=Infinity;const pageSize=100;
    while(skip<total){
      const url=new URL(baseUrl.href);
      url.searchParams.set('teamGuid',guid);
      url.searchParams.set('skipCount',String(skip));
      url.searchParams.set('maxResultCount',String(pageSize));
      const response=await originalFetch(url.href,{...requestInit,cache:'no-store'});
      if(!response.ok)throw new Error(`Wedstrijden ophalen mislukt: ${response.status}`);
      const data=await response.json();
      const items=Array.isArray(data?.items)?data.items:[];
      total=Number.isFinite(Number(data?.totalCount))?Number(data.totalCount):items.length;
      rows.push(...items);skip+=items.length;
      if(!items.length||items.length<pageSize)break;
    }
    return rows;
  }
  async function fetchAllClubMatches(url,clubId,requestInit){
    const teams=await loadRealTeams(clubId,requestInit);
    const guids=[...new Set(teams.map(team=>team.guid).filter(Boolean))];
    const byId=new Map();let cursor=0;
    const workers=Array.from({length:Math.min(4,Math.max(1,guids.length))},async()=>{
      while(cursor<guids.length){const index=cursor++;const rows=await fetchTeamMatches(guids[index],url,requestInit);rows.forEach(match=>byId.set(String(match.id),match));}
    });
    await Promise.all(workers);
    const items=[...byId.values()].sort((a,b)=>`${String(a.date||'')}T${String(a.startTime||'')}`.localeCompare(`${String(b.date||'')}T${String(b.startTime||'')}`));
    return {items,totalCount:items.length};
  }

  window.fetch=async function(input,init={}){
    const request=input instanceof Request?input:null;
    const rawUrl=request?request.url:String(input);
    let url;
    try{url=new URL(rawUrl,location.href)}catch{return originalFetch(input,init)}
    if(!isFoys(url))return originalFetch(input,init);
    const requestInit=request?{method:request.method,headers:request.headers,credentials:request.credentials,mode:request.mode,redirect:request.redirect,referrer:request.referrer,referrerPolicy:request.referrerPolicy,integrity:request.integrity,keepalive:request.keepalive,signal:request.signal,...init}:init;
    const clubId=clubIdFromTeamsUrl(url);
    if(clubId){
      const response=await originalFetch(input,init);if(!response.ok)return response;
      const data=await response.clone().json();if(!Array.isArray(data))return response;
      const real=data.filter(team=>team?.guid&&!String(team.guid).startsWith(PREFIX));
      clubTeamsCache.set(clubId,real);return jsonResponse([syntheticTeam(clubId,real),...real],response);
    }
    if(url.pathname.endsWith(MATCH_PATH)){
      const allClubId=clubIdFromAllGuid(url.searchParams.get('teamGuid')||'');
      if(allClubId)return jsonResponse(await fetchAllClubMatches(url,allClubId,requestInit));
    }
    return originalFetch(input,init);
  };
})();

(()=>{
'use strict';
const U='https://elpnfmlrkoemjrnzaeok.supabase.co',K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
const D={1:'Maandag',2:'Dinsdag',3:'Woensdag',4:'Donderdag',5:'Vrijdag',6:'Zaterdag',7:'Zondag'};
let sb=null,m=null,teams=[],trs=[],slots=[],members=[];
const $=id=>document.getElementById(id),e=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])),tt=v=>String(v||'').slice(0,5);
function toast(x){const n=$('toast');if(!n)return alert(x);n.textContent=x;n.classList.add('show');setTimeout(()=>n.classList.remove('show'),2400)}
async function client(){if(sb)return sb;const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});sb.auth.onAuthStateChange(()=>setTimeout(load,100));return sb}
function css(){if($('trainerCss'))return;const s=document.createElement('style');s.id='trainerCss';s.textContent='.trainer-check{display:flex!important;align-items:center;gap:10px;min-height:44px;font-size:14px!important;font-weight:750}.trainer-check input{width:22px!important;height:22px!important;margin:0!important}.trainer-teams{margin:12px 0}.trainer-teams strong{display:block;font-size:14px;margin-bottom:8px}.trainer-grid{display:grid;gap:8px}.trainer-grid label{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-size:13px;font-weight:700}.trainer-grid input{width:20px;height:20px;margin:0}.slot-panel{margin:14px 0;padding:14px;border:1px solid var(--line);border-radius:16px}.slot-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}.slot-form label{font-size:13px;font-weight:750}.slot-form select,.slot-form input{width:100%;margin-top:5px}.slot-list{display:grid;gap:8px;margin-top:12px}.slot-row{border:1px solid var(--line);border-radius:12px;padding:11px}.slot-row strong,.slot-row small{display:block}.trainer-time{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;margin-top:8px}.trainer-time label{font-size:12px;font-weight:750}.trainer-time input{width:100%;margin-top:4px}.training-agenda{margin:14px 0}.training-agenda h3{margin:0 0 8px}.training-agenda div{padding:8px 0;border-top:1px solid var(--line)}.training-agenda strong,.training-agenda small{display:block}@media(max-width:560px){.slot-form{grid-template-columns:1fr}.trainer-time{grid-template-columns:1fr 1fr}.trainer-time button{grid-column:1/-1}}';document.head.appendChild(s)}
async function load(){try{const s=await client(),{data:{session}}=await s.auth.getSession();if(!session){m=null;teams=[];trs=[];slots=[];members=[];return}const r=await s.rpc('sync_current_member');if(r.error||!r.data?.active){m=null;return}m=r.data;const q=[s.from('teams').select('id,team_name').eq('active',true).order('team_name'),s.from('member_trainer_teams').select('*'),s.from('training_slots').select('*,teams(team_name)').eq('active',true).order('weekday').order('start_time')];if(m.role==='admin')q.push(s.from('members').select('id,is_trainer'));const a=await Promise.all(q);teams=a[0].data||[];trs=a[1].data||[];slots=a[2].data||[];members=a[3]?.data||[];document.querySelector('#trainingAgendaExtra')?.remove();enhance()}catch(x){console.warn(x)}}
function label(){if(!m)return 'Club/inloggen';if(m.role==='admin'&&m.is_trainer)return 'Club/admin/trainer';if(m.role==='admin')return 'Club/admin';if(m.is_trainer)return 'Club/trainer';return 'Club'}
function nav(){const n=document.querySelector('.tab[data-view="club"]');if(!n)return;let l=n.querySelector('.club-tab-label');if(!l){n.innerHTML='<span class="tab-icon">●</span><span class="club-tab-label"></span>';l=n.querySelector('.club-tab-label')}l.textContent=label()}
function tids(id=m?.id){return new Set(trs.filter(x=>x.member_id===id).map(x=>x.team_id))}
function tabs(){const b=$('clubTabs');if(!b||!m)return;const ag=b.querySelector('[data-clubview="clubagenda"]'),ad=b.querySelector('[data-clubview="admin"]');if(ad&&ag)b.insertBefore(ad,ag);let tr=b.querySelector('[data-clubview="trainer"]'),v=$('club-sub-trainer');if(m.is_trainer){if(!tr){tr=document.createElement('button');tr.dataset.clubview='trainer';tr.textContent='Trainer';tr.onclick=()=>{document.querySelectorAll('#clubTabs button').forEach(x=>x.classList.toggle('active',x===tr));document.querySelectorAll('.club-subview').forEach(x=>x.classList.toggle('active',x===v))};ad?ad.insertAdjacentElement('afterend',tr):b.insertBefore(tr,ag)}if(!v){v=document.createElement('div');v.id='club-sub-trainer';v.className='club-subview';$('club-sub-clubagenda')?.insertAdjacentElement('beforebegin',v)}trainer(v)}else{tr?.remove();v?.remove()}}
function trainer(v){const ids=tids(),a=slots.filter(x=>ids.has(x.team_id));v.innerHTML=`<div class="club-card-panel"><h2>Trainer</h2><p>Pas de trainingstijden aan van jouw teams.</p><div class="slot-list">${a.length?a.map(x=>`<div class="slot-row"><strong>${e(x.teams?.team_name||'Team')} · ${D[x.weekday]}</strong><div class="trainer-time"><label>Start<input id="ts-${x.id}" type="time" value="${e(tt(x.start_time))}"></label><label>Einde<input id="te-${x.id}" type="time" value="${e(tt(x.end_time))}"></label><button class="mini-button primary" data-tsave="${x.id}">Opslaan</button></div></div>`).join(''):'<div class="club-empty">Nog geen trainingen ingesteld.</div>'}</div></div>`;v.querySelectorAll('[data-tsave]').forEach(b=>b.onclick=async()=>{const s=await client(),r=await s.rpc('trainer_update_training_slot',{p_slot_id:b.dataset.tsave,p_start_time:$(`ts-${b.dataset.tsave}`).value,p_end_time:$(`te-${b.dataset.tsave}`).value});if(r.error)return toast(r.error.message);toast('Trainingstijd aangepast.');load()})}
function form(){if(m?.role!=='admin')return;const f=$('memberForm');if(!f||f.dataset.trainer==='1')return;f.dataset.trainer='1';f.onsubmit=null;const id=$('memberId')?.value||'',row=members.find(x=>x.id===id),sel=tids(id),two=f.querySelector('.club-form.two');const lab=document.createElement('label');lab.className='trainer-check';lab.innerHTML=`<input id="memberTrainer" type="checkbox" ${row?.is_trainer?'checked':''}> Trainer`;two?.appendChild(lab);$('memberActive')?.closest('label')?.classList.add('trainer-check');const w=document.createElement('div');w.id='trainerTeams';w.className='trainer-teams';w.hidden=!row?.is_trainer;w.innerHTML=`<strong>Teams als trainer</strong><div class="trainer-grid">${teams.map(t=>`<label><input name="trainerTeam" type="checkbox" value="${t.id}" ${sel.has(t.id)?'checked':''}>${e(t.team_name)}</label>`).join('')}</div>`;f.querySelector('.member-team-grid')?.parentElement?.insertAdjacentElement('afterend',w);$('memberTrainer')?.addEventListener('change',x=>w.hidden=!x.target.checked);f.addEventListener('submit',saveMember)}
async function saveMember(ev){ev.preventDefault();ev.stopImmediatePropagation();const s=await client(),id=$('memberId').value||null,p={full_name:$('memberName').value.trim(),email:$('memberEmail').value.trim()||null,phone:$('memberPhone').value.trim()||null,role:$('memberAdmin').checked?'admin':'member',is_trainer:$('memberTrainer').checked,active:$('memberActive').checked};let mid=id;if(id){const r=await s.from('members').update(p).eq('id',id);if(r.error)return toast(r.error.message)}else{const r=await s.from('members').insert(p).select().single();if(r.error)return toast(r.error.message);mid=r.data.id}const pt=[...document.querySelectorAll('input[name="memberTeam"]:checked')].map(x=>x.value),tr=p.is_trainer?[...document.querySelectorAll('input[name="trainerTeam"]:checked')].map(x=>x.value):[];await s.from('member_teams').delete().eq('member_id',mid);if(pt.length)await s.from('member_teams').insert(pt.map(team_id=>({member_id:mid,team_id})));await s.from('member_trainer_teams').delete().eq('member_id',mid);if(tr.length)await s.from('member_trainer_teams').insert(tr.map(team_id=>({member_id:mid,team_id})));toast('Lid opgeslagen.');setTimeout(()=>location.reload(),300)}
function opts(sel=''){return teams.map(t=>`<option value="${t.id}" ${t.id===sel?'selected':''}>${e(t.team_name)}</option>`).join('')}
function days(sel=1){return Object.entries(D).map(([n,v])=>`<option value="${n}" ${+n===+sel?'selected':''}>${v}</option>`).join('')}
function slotHtml(id=''){const x=slots.find(s=>s.id===id);return `<h3>${x?'Training wijzigen':'Training toevoegen'}</h3><p>Kies team, dag en tijdslot. Een team kan meerdere trainingen hebben.</p><form id="slotForm" class="slot-form"><input id="slotId" type="hidden" value="${e(x?.id||'')}"><label>Team<select id="slotTeam">${opts(x?.team_id||'')}</select></label><label>Dag<select id="slotDay">${days(x?.weekday||1)}</select></label><label>Start<input id="slotStart" type="time" required value="${e(tt(x?.start_time||''))}"></label><label>Einde<input id="slotEnd" type="time" required value="${e(tt(x?.end_time||''))}"></label><button class="primary-button" type="submit">${x?'Opslaan':'Training toevoegen'}</button></form><div class="slot-list">${slots.length?slots.map(s=>`<div class="slot-row"><strong>${e(s.teams?.team_name||'Team')} · ${D[s.weekday]}</strong><small>${e(tt(s.start_time))} - ${e(tt(s.end_time))}</small><div class="mini-actions"><button class="mini-button" data-edit-slot="${s.id}">Wijzigen</button><button class="mini-button danger" data-del-slot="${s.id}">Verwijderen</button></div></div>`).join(''):'<div class="club-empty">Nog geen trainingen ingesteld.</div>'}</div>`}
function agendaAdmin(){if(m?.role!=='admin')return;const r=$('admin-agenda');if(!r||r.querySelector('#slotPanel'))return;const old=$('trainingForm');if(old){old.hidden=true;if(old.previousElementSibling?.tagName==='H3')old.previousElementSibling.hidden=true}const p=document.createElement('div');p.id='slotPanel';p.className='slot-panel';p.innerHTML=slotHtml();$('taskEventForm')?.previousElementSibling?.insertAdjacentElement('beforebegin',p);bindSlots(p)}
function bindSlots(p){p.querySelector('#slotForm')?.addEventListener('submit',saveSlot);p.querySelectorAll('[data-edit-slot]').forEach(b=>b.onclick=()=>{p.innerHTML=slotHtml(b.dataset.editSlot);bindSlots(p)});p.querySelectorAll('[data-del-slot]').forEach(b=>b.onclick=async()=>{if(!confirm('Training verwijderen?'))return;const s=await client(),r=await s.from('training_slots').delete().eq('id',b.dataset.delSlot);if(r.error)return toast(r.error.message);toast('Training verwijderd.');load()})}
async function saveSlot(ev){ev.preventDefault();const s=await client(),id=$('slotId').value,p={team_id:$('slotTeam').value,weekday:+$('slotDay').value,start_time:$('slotStart').value,end_time:$('slotEnd').value,active:true,created_by:m.id},r=id?await s.from('training_slots').update(p).eq('id',id):await s.from('training_slots').insert(p);if(r.error)return toast(r.error.message);toast(id?'Training gewijzigd.':'Training toegevoegd.');load()}
function agenda(){const p=document.querySelector('#club-sub-clubagenda .club-card-panel');if(!p||p.querySelector('#trainingAgendaExtra')||!slots.length)return;const now=new Date();now.setHours(12,0,0,0);const a=[];for(let i=0;i<22;i++){const d=new Date(now);d.setDate(now.getDate()+i);const wd=d.getDay()||7;slots.filter(s=>+s.weekday===wd).forEach(s=>a.push({d,s}))}a.sort((x,y)=>x.d-y.d||tt(x.s.start_time).localeCompare(tt(y.s.start_time)));const z=document.createElement('div');z.id='trainingAgendaExtra';z.className='training-agenda';z.innerHTML='<h3>Trainingen</h3>'+a.slice(0,30).map(x=>`<div><strong>${e(x.s.teams?.team_name||'Team')} · ${e(new Intl.DateTimeFormat('nl-NL',{weekday:'short',day:'2-digit',month:'short'}).format(x.d))}</strong><small>${e(tt(x.s.start_time))} - ${e(tt(x.s.end_time))}</small></div>`).join('');p.querySelector('.club-list')?.insertAdjacentElement('beforebegin',z)}
function enhance(){css();nav();tabs();form();agendaAdmin();agenda()}
document.addEventListener('DOMContentLoaded',async()=>{await load();setInterval(enhance,650)});
})();
