(()=>{
'use strict';

const U='https://elpnfmlrkoemjrnzaeok.supabase.co';
const K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
const F='52cfa65e-9782-4a81-ab35-e2f981fcb7a9';
const A='a4a2e2fa-0635-46a5-8969-1d0fef40444f';
const API='https://api.foys.io/competition/public-api/v1';
const CLUB_API='https://api.foys.io/foys/api/v2/pub';

let sb=null;
let member=null;
let teams=[];
let trainerTeams=[];
let allTeams=[];
let trainerAll=false;
let allMatches=null;
let current=null;
let promptDismissed=false;
let promptBusy=false;

const logoCache=new Map();
const clubLogoCache=new Map();
const orgTeamsCache=new Map();

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const d=v=>String(v||'').slice(0,10);
const t=v=>String(v||'').slice(0,5);
const role=r=>r==='referee'?'Scheidsrechter':r==='table'?'Tafel':'Taak';

function season(){
  const n=new Date(),y=n.getMonth()>=6?n.getFullYear():n.getFullYear()-1;
  return{start:`${y}-07-01`,end:`${y+1}-06-30`};
}
function fmt(v){
  try{return new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(new Date(`${d(v)}T12:00:00`))}
  catch{return v}
}
function label(m,s){
  return[
    m?.[`${s}TeamSponsorClubName`]||m?.[`${s}Organisation`]?.name,
    m?.[`${s}TeamName`]||m?.[`${s}Team`]?.name
  ].filter(Boolean).join(' ').trim()||'Onbekend team';
}
function teamGuid(m,s){
  return String(m?.[`${s}TeamGuid`]||m?.[`${s}Team`]?.guid||'');
}
function sideClubName(m,s){
  return String(m?.[`${s}TeamSponsorClubName`]||m?.[`${s}Organisation`]?.name||m?.[`${s}ClubName`]||'').trim();
}
function sideTeamName(m,s){
  return String(m?.[`${s}TeamName`]||m?.[`${s}Team`]?.name||'').trim();
}
function directLogo(m,side){
  return m?.[`${side}TeamLogoUrl`]
    ||m?.[`${side}Team`]?.logoUrl
    ||m?.[`${side}Organisation`]?.logoUrl
    ||m?.[`${side}TeamSponsorClubLogoUrl`]
    ||m?.[`${side}ClubLogoUrl`]
    ||'';
}
function organisationId(m,side){
  return String(
    m?.[`${side}Organisation`]?.id
    ||m?.[`${side}Organisation`]?.guid
    ||m?.[`${side}OrganisationId`]
    ||m?.[`${side}OrganisationGuid`]
    ||m?.[`${side}ClubId`]
    ||m?.[`${side}ClubGuid`]
    ||''
  );
}
async function orgTeams(id){
  if(!id)return[];
  if(orgTeamsCache.has(id))return orgTeamsCache.get(id);
  try{
    const r=await fetch(`${API}/organisations/${encodeURIComponent(id)}/teams`,{headers:{Accept:'application/json','X-FederationID':F},cache:'no-store'});
    if(!r.ok)throw 0;
    const rows=await r.json(),list=Array.isArray(rows)?rows:[];
    orgTeamsCache.set(id,list);
    return list;
  }catch{
    orgTeamsCache.set(id,[]);
    return[];
  }
}
async function clubLogo(name){
  const key=norm(name);
  if(!key)return'';
  if(clubLogoCache.has(key))return clubLogoCache.get(key);
  try{
    const p=new URLSearchParams({quickSearch:name,maxResultCount:'20',skipCount:'0'});
    const r=await fetch(`${CLUB_API}/organisations/${F}/clubs?${p}`,{cache:'no-store'});
    if(!r.ok)throw 0;
    const j=await r.json(),rows=Array.isArray(j)?j:(j?.items||[]);
    const hit=rows.find(x=>norm(x.name)===key)||rows[0];
    const src=hit?.logoUrl||hit?.logo||'';
    clubLogoCache.set(key,src);
    return src;
  }catch{
    clubLogoCache.set(key,'');
    return'';
  }
}
async function logoFor(m,side){
  const g=teamGuid(m,side);
  if(g&&logoCache.has(g))return logoCache.get(g);
  let src=directLogo(m,side);
  if(!src){
    const oid=organisationId(m,side);
    if(oid){
      const list=await orgTeams(oid),tm=list.find(x=>String(x.guid)===g);
      src=tm?.logoUrl||'';
    }
  }
  if(!src)src=await clubLogo(sideClubName(m,side));
  if(g)logoCache.set(g,src||'');
  return src||'';
}
function argonSide(m){
  if(!m)return'';
  const homeClub=norm(sideClubName(m,'home')),awayClub=norm(sideClubName(m,'away'));
  if(homeClub==='svargon'||homeClub.startsWith('svargon'))return'home';
  if(awayClub==='svargon'||awayClub.startsWith('svargon'))return'away';
  const homeLabel=norm(label(m,'home')),awayLabel=norm(label(m,'away'));
  if(homeLabel.startsWith('svargon'))return'home';
  if(awayLabel.startsWith('svargon'))return'away';
  return'';
}
function toast(m){
  const e=$('toast');
  if(!e)return alert(m);
  e.textContent=m;
  e.classList.add('show');
  setTimeout(()=>e.classList.remove('show'),2800);
}
function rowsWithTeam(r){
  return (r?.data||[]).map(x=>x.teams?{...x.teams,id:x.team_id}:null).filter(Boolean);
}

async function client(){
  if(sb)return sb;
  const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});
  return sb;
}

async function identity(){
  const s=await client(),{data:{session}}=await s.auth.getSession();
  if(!session){
    member=null;teams=[];trainerTeams=[];allTeams=[];trainerAll=false;
    return false;
  }
  const {data:m,error}=await s.rpc('sync_current_member');
  if(error||!m?.active){
    member=null;teams=[];trainerTeams=[];allTeams=[];trainerAll=false;
    return false;
  }
  member=m;
  const [players,trainers,all]=await Promise.all([
    s.from('member_teams').select('team_id,teams(id,team_name,foy_team_guid)').eq('member_id',m.id),
    s.from('member_trainer_teams').select('team_id,teams(id,team_name,foy_team_guid)').eq('member_id',m.id),
    s.from('teams').select('id,team_name,foy_team_guid').eq('active',true)
  ]);
  teams=rowsWithTeam(players);
  trainerTeams=rowsWithTeam(trainers);
  allTeams=all.data||[];
  trainerAll=trainerTeams.some(x=>norm(x.team_name)==='alleteams');
  return true;
}

async function matches(){
  if(allMatches)return allMatches;
  const q=season(),p=new URLSearchParams({
    startDate:q.start,endDate:q.end,teamGuid:`all-${A}`,skipCount:'0',maxResultCount:'100',sorting:'date asc, startTime asc'
  });
  const r=await fetch(`${API}/matches?${p}`,{headers:{Accept:'application/json','X-FederationID':F},cache:'no-store'});
  if(!r.ok)throw new Error('Wedstrijden konden niet worden opgehaald');
  const j=await r.json();
  allMatches=Array.isArray(j?.items)?j.items:[];
  return allMatches;
}

function argonTeamRef(m){
  const side=argonSide(m);
  if(!side)return{side:'',guid:'',name:''};
  return{side,guid:teamGuid(m,side),name:norm(sideTeamName(m,side))};
}
function matchesTeamRef(team,ref){
  if(!team||!ref?.side)return false;
  if(ref.guid)return String(team.foy_team_guid||'')===ref.guid;
  return !!ref.name&&norm(team.team_name)===ref.name;
}
function teamFromList(m,list){
  const ref=argonTeamRef(m);
  if(!ref.side)return null;
  return (list||[]).find(x=>matchesTeamRef(x,ref))||null;
}
function teamFor(m){return teamFromList(m,teams)}
function relationFor(m){
  const ref=argonTeamRef(m);
  if(!ref.side)return{team:null,player:false,trainer:false};
  const canonical=(allTeams||[]).find(x=>matchesTeamRef(x,ref))||null;
  const playerTeam=(teams||[]).find(x=>matchesTeamRef(x,ref))||null;
  const directTrainerTeam=(trainerTeams||[]).find(x=>matchesTeamRef(x,ref))||null;
  const player=!!playerTeam;
  const trainer=!!member?.is_trainer&&(trainerAll||!!directTrainerTeam);
  return{team:canonical||playerTeam||directTrainerTeam||null,player,trainer};
}
async function classify(m){
  if(window.BasketballMatchRules?.classify){
    try{return await window.BasketballMatchRules.classify(m)}catch{}
  }
  const status=norm(m?.status);
  const played=['final','played','finished','completed','eindstand','gespeeld'].includes(status)
    ||(m?.homeScore!==null&&m?.homeScore!==undefined&&m?.awayScore!==null&&m?.awayScore!==undefined);
  if(played)return{played:true,away:false,home:false};
  const home=/^sv\s*argon/i.test(label(m,'home'));
  const away=/^sv\s*argon/i.test(label(m,'away'));
  return{played:false,away:!home&&away,home};
}

async function syncBusy(){
  if(!member)return;
  const rows=[];
  for(const m of await matches()){
    const tm=teamFor(m);
    if(tm)rows.push({team_id:tm.id,foy_match_id:Number(m.id),match_date:d(m.date),start_time:t(m.startTime)});
  }
  const{error}=await sb.rpc('sync_member_match_busy',{p_rows:rows});
  if(error)console.warn(error);
}
function same(ev,m){
  return ev&&m&&d(ev.event_date)===d(m.date)&&norm(ev.home)===norm(label(m,'home'))&&norm(ev.away)===norm(label(m,'away'))
    &&(!t(ev.start_time)||!t(m.startTime)||t(ev.start_time)===t(m.startTime));
}
async function eventForMatch(m){
  let r=await sb.from('task_events').select('*,task_assignments(*)').eq('active',true).eq('foy_match_id',Number(m.id)).maybeSingle();
  if(r.data)return r.data;
  r=await sb.from('task_events').select('*,task_assignments(*)').eq('active',true).eq('event_date',d(m.date));
  return(r.data||[]).find(x=>same(x,m))||null;
}
async function eventByLegacy(id){
  const{data}=await sb.from('task_events').select('*,task_assignments(*)').eq('active',true).eq('legacy_id',id).maybeSingle();
  return data||null;
}
async function matchForEvent(ev){
  const ms=await matches();
  return ev?.foy_match_id?ms.find(x=>String(x.id)===String(ev.foy_match_id))||null:ms.find(x=>same(ev,x))||null;
}
async function attendance(mid){
  const{data}=await sb.from('attendance').select('*').eq('foy_match_id',Number(mid)).eq('member_id',member.id).maybeSingle();
  return data||null;
}
async function attendees(mid){
  const{data,error}=await sb.rpc('get_match_attendees',{p_match_id:Number(mid)});
  if(error){console.warn(error);return[]}
  return data||[];
}
async function drivers(mid){
  const{data,error}=await sb.rpc('get_match_drivers',{p_match_id:Number(mid)});
  if(error){console.warn(error);return[]}
  return data||[];
}
async function openSwaps(as){
  const ids=(as||[]).map(x=>x.id);
  if(!ids.length)return[];
  const{data}=await sb.from('task_swap_requests').select('*').eq('status','open').in('assignment_id',ids);
  return data||[];
}
function mine(a){
  return a&&(a.assigned_member_id===member?.id||(!a.assigned_member_id&&norm(a.assigned_name)===norm(member?.full_name)));
}

function injectDetailStyle(){
  if($('centralMatchDetailStyleV2'))return;
  $('centralMatchDetailStyleV1')?.remove();
  const style=document.createElement('style');
  style.id='centralMatchDetailStyleV2';
  style.textContent=`
    #matchDetailOverlay .match-detail-sheet{padding:14px 18px 24px}
    #matchDetailOverlay .match-detail-head{align-items:flex-start;gap:12px}
    #matchDetailOverlay .match-detail-kicker{display:block;color:var(--muted);font-size:12px;line-height:1.2;margin-bottom:5px}
    #matchDetailOverlay #matchDetailTitle{margin:0 0 16px;font-size:clamp(27px,7vw,40px);line-height:1.08;overflow-wrap:anywhere}
    #matchDetailOverlay.central-compact-head #matchDetailTitle{display:none!important}
    #matchDetailOverlay .central-head-matchup{display:grid;grid-template-columns:minmax(0,1fr) 14px minmax(0,1fr);gap:7px;align-items:center;margin:3px 0 8px}
    #matchDetailOverlay .central-head-team{display:flex;align-items:center;gap:7px;min-width:0}
    #matchDetailOverlay .central-head-team.away{justify-content:flex-end}
    #matchDetailOverlay .central-head-team.away .central-head-name{text-align:right}
    #matchDetailOverlay .central-head-logo{width:34px;height:34px;flex:0 0 34px;object-fit:contain;border-radius:7px;background:#fff}
    #matchDetailOverlay .central-head-logo-empty{display:block;background:#eef0f5}
    #matchDetailOverlay .central-head-name{font-size:11.5px;font-weight:900;line-height:1.12;overflow-wrap:anywhere;min-width:0}
    #matchDetailOverlay .central-head-sep{text-align:center;font-size:11px;font-weight:950;color:var(--muted)}
    #matchDetailOverlay .match-detail-close{flex:0 0 44px;width:44px;height:44px;font-size:28px}
    #matchDetailOverlay .match-summary{border:0!important;border-radius:0!important;background:transparent!important;padding:0 0 15px!important;margin:0!important;border-bottom:1px solid var(--line)!important}
    #matchDetailOverlay .match-summary-date{display:block;font-size:17px;font-weight:900;line-height:1.25;margin-bottom:9px}
    #matchDetailOverlay .match-summary-row{display:grid;grid-template-columns:76px minmax(0,1fr);gap:10px;align-items:start;padding:3px 0;font-size:14px;line-height:1.35}
    #matchDetailOverlay .match-summary-label{color:var(--muted);font-weight:700}
    #matchDetailOverlay .match-summary-value{color:var(--text);font-weight:700;min-width:0}
    #matchDetailOverlay .match-detail-section{border-top:0!important;padding:18px 0 0!important}
    #matchDetailOverlay .match-detail-section+.match-detail-section{margin-top:18px;border-top:1px solid var(--line)!important}
    #matchDetailOverlay .match-detail-section>h3{margin:0 0 11px;font-size:20px;line-height:1.15}
    #matchDetailOverlay .presence-segment{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    #matchDetailOverlay .match-action{min-height:48px;border-radius:11px;font-size:12px}
    #matchDetailOverlay .drive-action{width:100%;min-height:48px;margin-top:8px;border:0;border-radius:11px;padding:10px 13px;display:flex;align-items:center;gap:10px;background:#f0f1f5;color:var(--navy);font:inherit;font-weight:900;text-align:left;cursor:pointer}
    #matchDetailOverlay .drive-action.selected{background:#fff0e7;color:var(--task-text)}
    #matchDetailOverlay .drive-check{width:23px;height:23px;flex:0 0 23px;border:2px solid #aeb1bb;border-radius:6px;display:grid;place-items:center;background:#fff;font-size:15px;line-height:1}
    #matchDetailOverlay .drive-action.selected .drive-check{border-color:currentColor}
    #matchDetailOverlay .match-people{display:grid;gap:15px}
    #matchDetailOverlay .people-block h4{margin:0 0 8px;font-size:13px;line-height:1.2}
    #matchDetailOverlay .people-list{display:flex;flex-wrap:wrap;gap:6px}
    #matchDetailOverlay .person-chip{display:inline-flex;align-items:center;border-radius:999px;padding:6px 9px;background:#eef0f5;color:var(--navy);font-size:10px;font-weight:850}
    #matchDetailOverlay .people-empty{margin:0;color:var(--muted);font-size:11px;line-height:1.4}
    #matchDetailOverlay .detail-task{border-radius:10px}
    @media(max-width:480px){
      #matchDetailOverlay .match-detail-sheet{padding:13px 16px 22px}
      #matchDetailOverlay #matchDetailTitle{font-size:31px}
      #matchDetailOverlay .central-head-logo{width:30px;height:30px;flex-basis:30px}
      #matchDetailOverlay .central-head-name{font-size:10.5px}
      #matchDetailOverlay .match-summary-row{grid-template-columns:68px minmax(0,1fr);font-size:13px}
    }
  `;
  document.head.appendChild(style);
}
function ui(){
  injectDetailStyle();
  if($('matchDetailOverlay'))return;
  const o=document.createElement('div');
  o.id='matchDetailOverlay';
  o.className='match-detail-overlay';
  o.hidden=true;
  o.innerHTML=`<div class="match-detail-sheet"><div class="match-detail-grabber"></div><div class="match-detail-head"><div><span id="matchDetailKicker" class="match-detail-kicker">Wedstrijd</span><h2 id="matchDetailTitle">Wedstrijd</h2></div><button class="match-detail-close" data-close-detail>×</button></div><div id="matchDetailBody"></div></div>`;
  document.body.appendChild(o);
  o.onclick=e=>{if(e.target===o||e.target.closest('[data-close-detail]'))close()};
}
function clearCompactMatchHead(){
  const overlay=$('matchDetailOverlay');
  if(!overlay)return;
  overlay.classList.remove('central-compact-head');
  overlay.querySelector('.central-head-matchup')?.remove();
  const title=$('matchDetailTitle');
  if(title)title.hidden=false;
}
function centralHeadTeam(name,logo,away=false){
  const image=logo
    ?`<img class="central-head-logo" src="${esc(logo)}" alt="">`
    :'<span class="central-head-logo central-head-logo-empty" aria-hidden="true"></span>';
  return `<div class="central-head-team ${away?'away':''}">${away?`<span class="central-head-name">${esc(name)}</span>${image}`:`${image}<span class="central-head-name">${esc(name)}</span>`}</div>`;
}
async function setCompactMatchHead(m,kicker){
  if(!m)return false;
  const [homeLogo,awayLogo]=await Promise.all([logoFor(m,'home'),logoFor(m,'away')]);
  const overlay=$('matchDetailOverlay'),wrap=overlay?.querySelector('.match-detail-head>div:first-child');
  if(!overlay||!wrap)return false;
  clearCompactMatchHead();
  const box=document.createElement('div');
  box.className='central-head-matchup';
  box.innerHTML=`${centralHeadTeam(label(m,'home'),homeLogo)}<span class="central-head-sep">—</span>${centralHeadTeam(label(m,'away'),awayLogo,true)}`;
  wrap.appendChild(box);
  overlay.classList.add('central-compact-head');
  const title=$('matchDetailTitle');
  if(title)title.hidden=true;
  $('matchDetailKicker').textContent=kicker;
  return true;
}
function shell(title='Wedstrijd',kick='Wedstrijd'){
  ui();
  clearCompactMatchHead();
  $('matchDetailTitle').textContent=title;
  $('matchDetailKicker').textContent=kick;
  $('matchDetailBody').innerHTML='<div class="match-detail-loading">Gegevens laden…</div>';
  $('matchDetailOverlay').hidden=false;
  document.body.classList.add('match-detail-open');
}
function close(){
  clearCompactMatchHead();
  $('matchDetailOverlay').hidden=true;
  document.body.classList.remove('match-detail-open');
  current=null;
}
function loginNeeded(){
  shell('Ledenlogin nodig','Beveiligd');
  $('matchDetailBody').innerHTML=`<div class="match-detail-message"><strong>Log eerst in als lid</strong><p>Aanwezigheid, rijden en taakwissels zijn alleen beschikbaar voor ingelogde actieve leden.</p><button class="match-action primary" id="goClub">Naar Club</button></div>`;
  $('goClub').onclick=()=>{close();document.querySelector('.tab[data-view="club"]')?.click()};
}
function summary(m,e){
  return m?{
    title:`${label(m,'home')} — ${label(m,'away')}`,
    date:d(m.date),
    start:t(m.startTime),
    arrival:e?.arrival_time?t(e.arrival_time):'',
    loc:[m.accommodationName,m.fieldName].filter(Boolean).join(' · ')||e?.location||''
  }:{
    title:`${e?.home||'Wedstrijd'} — ${e?.away||''}`,
    date:d(e?.event_date),
    start:t(e?.start_time),
    arrival:t(e?.arrival_time),
    loc:[e?.location,e?.field].filter(Boolean).join(' · ')
  };
}
function taskHtml(a,sw){
  let act='';
  if(mine(a))act=sw
    ?`<div class="detail-task-actions"><button class="match-action" data-cancel="${sw.id}">Wissel annuleren</button><span class="swap-open-label">Wissel staat open</span></div>`
    :`<div class="detail-task-actions"><button class="match-action primary" data-request="${a.id}">Taak wisselen</button></div>`;
  else if(sw)act=`<div class="detail-task-actions"><button class="match-action primary" data-take="${sw.id}">Taak overnemen</button></div>`;
  return`<div class="detail-task ${mine(a)?'mine':''}"><span class="detail-task-role">${role(a.role)}</span><strong>${esc(a.assigned_name||'Niet toegewezen')}</strong>${act}</div>`;
}
function chips(rows,empty){
  return rows.length
    ?`<div class="people-list">${rows.map(r=>`<span class="person-chip">${esc(r.full_name||'Lid')}</span>`).join('')}</div>`
    :`<p class="people-empty">${esc(empty)}</p>`;
}

async function render(m,e){
  const as=(e?.task_assignments||[]).sort((a,b)=>(a.role||'').localeCompare(b.role||'')||a.slot-b.slot);
  const [ss,state]=await Promise.all([openSwaps(as),m?classify(m):Promise.resolve({played:false,away:false,home:false})]);
  const sm=new Map(ss.map(x=>[x.assignment_id,x]));
  const relation=m?relationFor(m):{team:e?.team_id?allTeams.find(x=>String(x.id)===String(e.team_id)):null,player:false,trainer:false};
  if(!m&&relation.team)relation.player=teams.some(x=>String(x.id)===String(relation.team.id));
  const [at,playerRows,driverRows]=m?await Promise.all([
    relation.team?attendance(m.id):Promise.resolve(null),
    attendees(m.id),
    state.away?drivers(m.id):Promise.resolve([])
  ]):[null,[],[]];
  const s=summary(m,e);
  current={m,e,relation,at,state};

  clearCompactMatchHead();
  $('matchDetailTitle').textContent=s.title;
  $('matchDetailKicker').textContent=e?'Wedstrijd & taken':'Wedstrijd';
  if(m&&!state.played)await setCompactMatchHead(m,e?'Wedstrijd & taken':'Wedstrijd');

  const summaryHtml=`<div class="match-summary">
    <strong class="match-summary-date">${esc(fmt(s.date))}</strong>
    ${s.arrival?`<div class="match-summary-row"><span class="match-summary-label">Aanwezig</span><span class="match-summary-value">${esc(s.arrival)}</span></div>`:''}
    <div class="match-summary-row"><span class="match-summary-label">Start</span><span class="match-summary-value">${esc(s.start||'—')}</span></div>
    <div class="match-summary-row"><span class="match-summary-label">Locatie</span><span class="match-summary-value">${esc(s.loc||'Locatie nog niet bekend')}</span></div>
  </div>`;

  const canPlayer=!state.played&&!!relation.team&&relation.player;
  const canTrainerDrive=!state.played&&!!relation.team&&!relation.player&&relation.trainer&&state.away;
  const canDrive=!state.played&&!!relation.team&&state.away&&(relation.player||relation.trainer);

  let mineHtml='';
  if(canPlayer||canTrainerDrive){
    const pres=canPlayer?`<div class="presence-segment">
      <button class="match-action ${at?.attending===true?'selected yes':''}" data-pres="yes">Aanwezig</button>
      <button class="match-action ${at?.attending===false?'selected no':''}" data-pres="no">Afwezig</button>
    </div>`:'';
    const drive=canDrive?`<button class="drive-action ${at?.driving===true?'selected':''}" type="button" data-drive>
      <span class="drive-check">${at?.driving===true?'✓':''}</span><span>Ik rijd</span>
    </button>`:'';
    mineHtml=`<div class="match-detail-section"><h3>Mijn wedstrijd</h3>${pres}${drive}</div>`;
  }

  const peopleHtml=m?`<div class="match-detail-section match-people-section">
    <h3>Wie komen er?</h3>
    <div class="match-people">
      <div class="people-block"><h4>Aanwezige spelers</h4>${chips(playerRows,'Nog niemand heeft zich aanwezig gemeld.')}</div>
      ${state.away?`<div class="people-block"><h4>Rijders</h4>${chips(driverRows,'Nog niemand heeft aangegeven te rijden.')}</div>`:''}
    </div>
  </div>`:'';

  const taskSection=as.length?`<div class="match-detail-section"><h3>Taken</h3><div class="detail-task-list">${as.map(a=>taskHtml(a,sm.get(a.id))).join('')}</div></div>`:'';

  $('matchDetailBody').innerHTML=summaryHtml+mineHtml+peopleHtml+taskSection;

  document.querySelectorAll('[data-pres]').forEach(b=>b.onclick=()=>savePresence(b.dataset.pres==='yes'));
  const driveButton=document.querySelector('#matchDetailBody [data-drive]');
  if(driveButton)driveButton.onclick=()=>saveDrive(!(current?.at?.driving===true));
  document.querySelectorAll('[data-request]').forEach(b=>b.onclick=()=>request(b.dataset.request));
  document.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>cancelSwap(b.dataset.cancel));
  document.querySelectorAll('[data-take]').forEach(b=>b.onclick=()=>take(b.dataset.take));
}

async function savePresence(v){
  if(!current?.m||!current?.relation?.team||!current.relation.player)return;
  const {data,error}=await sb.rpc('set_match_attendance',{
    p_match_id:Number(current.m.id),
    p_team_id:current.relation.team.id,
    p_attending:v,
    p_driving:!!(v&&current.state.away&&current.at?.driving===true)
  });
  if(error)return toast(error.message);
  current.at=data;
  toast(v?'Aanwezig opgeslagen.':'Afwezig opgeslagen.');
  document.dispatchEvent(new CustomEvent('basketball-attendance-changed',{detail:{matchId:Number(current.m.id)}}));
  await render(current.m,current.e);
}
async function saveDrive(v){
  if(!current?.m||!current?.relation?.team||!current.state.away)return;
  if(!current.relation.player&&!current.relation.trainer)return;
  const attending=current.relation.player?(v?true:current.at?.attending===true):false;
  const {data,error}=await sb.rpc('set_match_attendance',{
    p_match_id:Number(current.m.id),
    p_team_id:current.relation.team.id,
    p_attending:attending,
    p_driving:!!v
  });
  if(error)return toast(error.message);
  current.at=data;
  toast(v?'Rijden opgeslagen.':'Rijden uitgezet.');
  document.dispatchEvent(new CustomEvent('basketball-attendance-changed',{detail:{matchId:Number(current.m.id)}}));
  await render(current.m,current.e);
}

async function request(id){
  const{error}=await sb.rpc('request_task_swap',{p_assignment_id:id});
  if(error)return toast(error.message);
  toast('Taakwissel staat open.');
  await refresh();
}
async function cancelSwap(id){
  const{error}=await sb.rpc('cancel_task_swap',{p_request_id:id});
  if(error)return toast(error.message);
  toast('Taakwissel geannuleerd.');
  await refresh();
}
async function take(id){
  await syncBusy();
  const{data:c,error:ce}=await sb.rpc('check_task_swap_conflict',{p_request_id:id});
  if(ce)return toast(ce.message);
  if(c)return toast(c);
  const{error}=await sb.rpc('accept_task_swap',{p_request_id:id});
  if(error)return toast(error.message);
  toast('Taak is aan jou toegewezen.');
  await refresh();
}
async function refresh(){
  if(!current)return;
  if(current.m)await render(current.m,await eventForMatch(current.m));
  else if(current.e){
    const e=await eventByLegacy(current.e.legacy_id);
    await render(await matchForEvent(e),e);
  }
}
async function openMatch(id){
  if(!(await identity()))return loginNeeded();
  shell('Wedstrijd laden…');
  try{
    const m=(await matches()).find(x=>String(x.id)===String(id));
    if(!m)throw Error('Wedstrijd niet gevonden');
    await render(m,await eventForMatch(m));
  }catch(e){
    $('matchDetailBody').innerHTML=`<div class="match-detail-message"><strong>Niet beschikbaar</strong><p>${esc(e.message)}</p></div>`;
  }
}
async function openTask(id){
  if(!(await identity()))return loginNeeded();
  shell('Taak laden…','Taak');
  try{
    const e=await eventByLegacy(id);
    if(!e)throw Error('Taak niet gevonden');
    await render(await matchForEvent(e),e);
  }catch(e){
    $('matchDetailBody').innerHTML=`<div class="match-detail-message"><strong>Niet beschikbaar</strong><p>${esc(e.message)}</p></div>`;
  }
}

async function promptSwap(){
  if(promptDismissed||promptBusy||!member)return;
  promptBusy=true;
  try{
    const[{data:o},{data:r}]=await Promise.all([
      sb.from('task_swap_requests').select('*,task_assignments(*,task_events(*))').eq('status','open').order('created_at'),
      sb.from('task_swap_responses').select('request_id,response').eq('member_id',member.id)
    ]);
    const no=new Set((r||[]).filter(x=>x.response==='declined').map(x=>x.request_id));
    const s=(o||[]).find(x=>x.requested_by!==member.id&&!no.has(x.id));
    if(!s)return;
    await syncBusy();
    const{data:c}=await sb.rpc('check_task_swap_conflict',{p_request_id:s.id});
    const a=s.task_assignments||{},e=a.task_events||{};
    shell('Taak overnemen?','Open taakwissel');
    $('matchDetailBody').innerHTML=`<div class="swap-popup-card"><span class="detail-task-role">${role(a.role)}</span><h3>${esc(e.home||'Taak')} — ${esc(e.away||'')}</h3><p>${esc(fmt(e.event_date||s.created_at))} · aanwezig ${esc(t(e.arrival_time||e.start_time))} · start ${esc(t(e.start_time))}</p><p>Van: <strong>${esc(a.assigned_name||'Lid')}</strong></p>${c?`<div class="swap-conflict">${esc(c)}</div>`:''}</div><div class="swap-popup-actions"><button class="match-action primary" id="swapYes" ${c?'disabled':''}>Ja</button><button class="match-action no" id="swapNo">Nee</button><button class="match-action" id="swapLater">× Wegdrukken</button></div>`;
    $('swapLater').onclick=()=>{promptDismissed=true;close()};
    $('swapNo').onclick=async()=>{
      const{error}=await sb.rpc('decline_task_swap',{p_request_id:s.id});
      if(error)return toast(error.message);
      close();promptBusy=false;setTimeout(promptSwap,120);
    };
    $('swapYes').onclick=async()=>{
      const{error}=await sb.rpc('accept_task_swap',{p_request_id:s.id});
      if(error)return toast(error.message);
      toast('Taak is aan jou toegewezen.');
      close();promptBusy=false;setTimeout(promptSwap,120);
    };
  }catch(e){console.warn(e)}
  finally{promptBusy=false}
}

async function bootstrap(){
  try{
    const s=await client(),ok=await identity();
    if(ok){await syncBusy();setTimeout(promptSwap,250)}
    s.auth.onAuthStateChange(async()=>{
      allMatches=null;
      if(await identity()){await syncBusy();setTimeout(promptSwap,220)}
    });
  }catch(e){console.warn(e)}
}

document.addEventListener('click',e=>{
  const c=e.target.closest('article.event[data-match-id],article.event[data-task-id]');
  if(!c||e.target.closest('button,a,input,select,label'))return;
  e.preventDefault();
  c.dataset.matchId?openMatch(c.dataset.matchId):openTask(c.dataset.taskId);
},true);

document.addEventListener('DOMContentLoaded',()=>{ui();bootstrap()});
})();