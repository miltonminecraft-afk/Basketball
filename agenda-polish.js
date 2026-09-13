(()=>{
'use strict';

const SUPABASE_URL='https://elpnfmlrkoemjrnzaeok.supabase.co';
const SUPABASE_KEY='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
const FED='52cfa65e-9782-4a81-ab35-e2f981fcb7a9';
const API='https://api.foys.io/competition/public-api/v1';
const CLUB_API='https://api.foys.io/foys/api/v2/pub';
const STORE='basketballApp.selection.v3';
const CACHE_PREFIX='basketballApp.matches.v3.';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const d=v=>String(v||'').slice(0,10);
const t=v=>String(v||'').slice(0,5);
const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');

let sb=null,ctx=null,ctxAt=0,rendering=false,timer=null,taskCache=null;
const matchCache=new Map(),logoCache=new Map(),clubLogoCache=new Map(),orgTeamsCache=new Map();
let agendaObserver=null,gamesObserver=null;

function selection(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}}
function season(){const n=new Date(),y=n.getMonth()>=6?n.getFullYear():n.getFullYear()-1;return{start:`${y}-07-01`,end:`${y+1}-06-30`}}
function headers(){return{Accept:'application/json','X-FederationID':FED}}
function hasScore(m){return m?.homeScore!==null&&m?.homeScore!==undefined&&m?.awayScore!==null&&m?.awayScore!==undefined}
function teamGuid(m,side){return String(m?.[`${side}TeamGuid`]||m?.[`${side}Team`]?.guid||'')}
function clubName(m,side){return String(m?.[`${side}TeamSponsorClubName`]||m?.[`${side}Organisation`]?.name||'').trim()}
function teamName(m,side){return [clubName(m,side),m?.[`${side}TeamName`]||m?.[`${side}Team`]?.name].filter(Boolean).join(' ').trim()||'Onbekend team'}
function formatDay(v){return new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(new Date(`${v}T12:00:00`)).toUpperCase()}

async function client(){
 if(sb)return sb;
 const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
 sb=mod.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});
 sb.auth.onAuthStateChange(()=>{ctx=null;ctxAt=0;schedule(true,120)});
 return sb;
}
async function context(force=false){
 if(!force&&ctx&&Date.now()-ctxAt<15000)return ctx;
 const s=await client(),{data:{session}}=await s.auth.getSession();
 let member=null,memberTeams=[],trainerTeams=[];
 if(session){
  const {data:m}=await s.rpc('sync_current_member');
  if(m?.active){
   member=m;
   const [pt,tt]=await Promise.all([
    s.from('member_teams').select('team_id,teams(id,team_name,foy_team_guid)').eq('member_id',m.id),
    s.from('member_trainer_teams').select('team_id,teams(id,team_name,foy_team_guid)').eq('member_id',m.id)
   ]);
   const map=r=>(r.data||[]).map(x=>x.teams?{...x.teams,id:x.team_id}:null).filter(Boolean);
   memberTeams=map(pt);trainerTeams=map(tt);
  }
 }
 const [teams,slots]=await Promise.all([
  s.from('teams').select('id,team_name,foy_team_guid').eq('active',true),
  s.from('training_slots').select('*,teams(id,team_name,foy_team_guid)').eq('active',true).order('weekday').order('start_time')
 ]);
 ctx={member,memberTeams,trainerTeams,allTeams:teams.data||[],slots:slots.data||[]};ctxAt=Date.now();return ctx;
}
async function teamMatches(guid){
 if(!guid||String(guid).startsWith('all-'))return[];
 if(matchCache.has(guid))return matchCache.get(guid);
 const q=season(),rows=[];let skip=0,total=Infinity;
 while(skip<total){
  const p=new URLSearchParams({startDate:q.start,endDate:q.end,teamGuid:guid,skipCount:String(skip),maxResultCount:'100',sorting:'date asc, startTime asc'}),r=await fetch(`${API}/matches?${p}`,{headers:headers(),cache:'no-store'});if(!r.ok)break;
  const j=await r.json(),part=Array.isArray(j?.items)?j.items:[];rows.push(...part);total=Number(j?.totalCount)||part.length;skip+=part.length;if(!part.length||part.length<100)break;
 }
 matchCache.set(guid,rows);return rows;
}
function matchMap(){
 const map=new Map();
 for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(CACHE_PREFIX))continue;try{for(const m of JSON.parse(localStorage.getItem(key)||'{}')?.matches||[])map.set(String(m.id),m)}catch{}}
 for(const rows of matchCache.values())for(const m of rows)map.set(String(m.id),m);return map;
}
async function tasks(){if(taskCache)return taskCache;try{const r=await fetch('./data/tasks.json',{cache:'no-store'}),j=await r.json();taskCache=Array.isArray(j?.tasks)?j.tasks:[]}catch{taskCache=[]}return taskCache}

function directLogo(m,side){return m?.[`${side}TeamLogoUrl`]||m?.[`${side}Team`]?.logoUrl||m?.[`${side}Organisation`]?.logoUrl||m?.[`${side}TeamSponsorClubLogoUrl`]||m?.[`${side}ClubLogoUrl`]||''}
function organisationId(m,side){return String(m?.[`${side}Organisation`]?.id||m?.[`${side}Organisation`]?.guid||m?.[`${side}OrganisationId`]||m?.[`${side}OrganisationGuid`]||m?.[`${side}ClubId`]||m?.[`${side}ClubGuid`]||'')}
async function orgTeams(id){if(!id)return[];if(orgTeamsCache.has(id))return orgTeamsCache.get(id);try{const r=await fetch(`${API}/organisations/${encodeURIComponent(id)}/teams`,{headers:headers(),cache:'no-store'});if(!r.ok)throw 0;const rows=await r.json(),list=Array.isArray(rows)?rows:[];orgTeamsCache.set(id,list);return list}catch{orgTeamsCache.set(id,[]);return[]}}
async function clubLogo(name){
 const key=norm(name);if(!key)return'';if(clubLogoCache.has(key))return clubLogoCache.get(key);
 try{const p=new URLSearchParams({quickSearch:name,maxResultCount:'20',skipCount:'0'}),r=await fetch(`${CLUB_API}/organisations/${FED}/clubs?${p}`,{cache:'no-store'});if(!r.ok)throw 0;const j=await r.json(),rows=Array.isArray(j)?j:(j?.items||[]),hit=rows.find(x=>norm(x.name)===key)||rows[0],src=hit?.logoUrl||hit?.logo||'';clubLogoCache.set(key,src);return src}catch{clubLogoCache.set(key,'');return''}
}
async function logoFor(m,side){
 const g=teamGuid(m,side);if(g&&logoCache.has(g))return logoCache.get(g);
 let src=directLogo(m,side);if(!src){const oid=organisationId(m,side);if(oid){const list=await orgTeams(oid),tm=list.find(x=>String(x.guid)===g);src=tm?.logoUrl||''}}if(!src)src=await clubLogo(clubName(m,side));if(g)logoCache.set(g,src||'');return src||'';
}

function injectCss(){
 if($('agendaPolishV3Css'))return;
 const s=document.createElement('style');s.id='agendaPolishV3Css';s.textContent=`
 .agenda-team-title{display:flex;align-items:center;flex-wrap:wrap;gap:4px 6px}
 .agenda-team-side{display:inline-flex;align-items:center;gap:5px;min-width:0}
 .agenda-team-logo{width:18px;height:18px;object-fit:contain;flex:0 0 18px;border-radius:4px;background:#fff}
 .agenda-team-sep{font-weight:800;color:var(--navy)}
 .agenda-training .badge{background:#eef1ff;color:var(--navy)}
 .agenda-training .match-title{margin-top:4px}
 .agenda-training .meta{margin-top:4px}
 `;document.head.appendChild(s);
}
function cleanupClubAgenda(){
 const tabs=$('clubTabs'),agendaBtn=tabs?.querySelector('[data-clubview="clubagenda"]'),agendaView=$('club-sub-clubagenda');
 if(!agendaBtn&&!agendaView)return;
 const adminAgenda=$('admin-agenda'),adminHost=$('club-sub-admin');
 if(adminAgenda&&agendaView?.contains(adminAgenda)&&adminHost){adminAgenda.classList.remove('in-club-agenda');adminAgenda.hidden=false;adminAgenda.style.display='';adminHost.appendChild(adminAgenda)}
 const adminAgendaBtn=$('adminTabs')?.querySelector('[data-adminview="agenda"]');if(adminAgendaBtn)adminAgendaBtn.style.display='';
 const active=agendaBtn?.classList.contains('active')||agendaView?.classList.contains('active');agendaBtn?.remove();agendaView?.remove();
 if(active){const next=tabs?.querySelector('[data-clubview="admin"]')||tabs?.querySelector('[data-clubview="trainer"]')||tabs?.querySelector('[data-clubview="presence"]')||tabs?.querySelector('button');next?.click()}
}

async function tagDays(root,map){
 const taskRows=await tasks(),taskMap=new Map(taskRows.map(x=>[String(x.id),x]));
 for(const day of root.querySelectorAll('.day')){
  let date=day.dataset.agendaDate||'';
  if(!date){const mc=day.querySelector('[data-match-id]');if(mc)date=d(map.get(String(mc.dataset.matchId))?.date);if(!date){const tc=day.querySelector('[data-task-id]'),row=tc?taskMap.get(String(tc.dataset.taskId)):null;if(row)date=d(row.date)}}
  if(date)day.dataset.agendaDate=date;
 }
 for(const card of root.querySelectorAll('article.event')){
  if(card.dataset.matchId)card.dataset.agendaTime=t(map.get(String(card.dataset.matchId))?.startTime);
  else if(card.dataset.taskId){const row=taskMap.get(String(card.dataset.taskId));card.dataset.agendaTime=t(row?.arrivalTime||row?.startTime)}
 }
}
function findDay(root,date){let day=[...root.querySelectorAll('.day')].find(x=>x.dataset.agendaDate===date);if(day)return day;day=document.createElement('section');day.className='day';day.dataset.agendaDate=date;day.innerHTML=`<div class="day-head">${esc(formatDay(date))}</div>`;root.appendChild(day);return day}
function occurrences(slots,start,end){const out=[],a=new Date(`${start}T12:00:00`),b=new Date(`${end}T12:00:00`);for(let cur=new Date(a);cur<=b;cur.setDate(cur.getDate()+1)){const wd=cur.getDay()||7,date=cur.toISOString().slice(0,10);for(const slot of slots)if(Number(slot.weekday)===wd)out.push({date,slot})}return out}
function trainingCard(o){const s=o.slot,team=s.teams?.team_name||'Alle teams';return `<article class="event agenda-training" data-agenda-time="${esc(t(s.start_time))}" data-training-slot="${esc(s.id)}"><div class="event-row"><div class="time-col"><div class="event-time">${esc(t(s.start_time))}</div><span class="event-status">Training</span></div><div class="event-main"><span class="badge">Training</span><div class="match-title">SV Argon ${esc(team)}</div><div class="meta">${esc(t(s.start_time))} - ${esc(t(s.end_time))}${s.location?` · ${esc(s.location)}`:''}</div></div></div></article>`}
function extraMatchCard(m){const final=hasScore(m),score=`${m.homeScore} – ${m.awayScore}`,loc=[m.accommodationName,m.fieldName].filter(Boolean).join(' · ');return `<article class="event agenda-extra-match" data-match-id="${esc(m.id)}" data-agenda-time="${esc(t(m.startTime))}"><div class="event-row"><div class="time-col"><div class="event-time">${esc(t(m.startTime))}</div><span class="event-status">${final?'Eindstand':'Gepland'}</span></div><div class="event-main"><span class="badge ${final?'badge-final':'badge-game'}">${final?'Uitslag':'Wedstrijd'}</span><div class="match-title">${esc(teamName(m,'home'))} — ${esc(teamName(m,'away'))}</div>${final?`<div class="score-line">${esc(score)}</div>`:''}<div class="meta">${esc(loc||'Locatie niet bekend')}</div><div class="competition">${esc(m.competition?.name||'')} · wedstrijd-ID ${esc(m.id)}</div></div></div></article>`}
function sortAgenda(root){
 for(const day of root.querySelectorAll('.day')){[...day.querySelectorAll(':scope > article.event')].sort((a,b)=>(a.dataset.agendaTime||'99:99').localeCompare(b.dataset.agendaTime||'99:99')).forEach(c=>day.appendChild(c))}
 [...root.querySelectorAll('.day')].sort((a,b)=>(a.dataset.agendaDate||'9999-99-99').localeCompare(b.dataset.agendaDate||'9999-99-99')).forEach(day=>root.appendChild(day));
}
async function polishMatches(map){
 const cards=[...document.querySelectorAll('#agendaList article.event[data-match-id],#gamesList article.event[data-match-id]')];
 await Promise.all(cards.map(async card=>{
  const m=map.get(String(card.dataset.matchId));if(!m)return;card.dataset.agendaTime=t(m.startTime);
  if(hasScore(m)){const timeEl=card.querySelector('.time-col .event-time');if(timeEl){timeEl.textContent=t(m.startTime);timeEl.classList.remove('score')}card.querySelectorAll('.final-start,.final-start-compact').forEach(x=>x.remove())}
  const title=card.querySelector('.match-title');if(!title)return;
  const [hl,al]=await Promise.all([logoFor(m,'home'),logoFor(m,'away')]);
  title.classList.add('agenda-team-title');title.innerHTML=`<span class="agenda-team-side">${hl?`<img class="agenda-team-logo" src="${esc(hl)}" alt="">`:''}<span>${esc(teamName(m,'home'))}</span></span><span class="agenda-team-sep">—</span><span class="agenda-team-side">${al?`<img class="agenda-team-logo" src="${esc(al)}" alt="">`:''}<span>${esc(teamName(m,'away'))}</span></span>`;
 }))
}

function pauseObservers(){agendaObserver?.disconnect();gamesObserver?.disconnect()}
function resumeObservers(){
 const a=$('agendaList'),g=$('gamesList');
 if(a&&agendaObserver)agendaObserver.observe(a,{childList:true,subtree:true});
 if(g&&gamesObserver)gamesObserver.observe(g,{childList:true,subtree:true});
}
async function render(force=false){
 const root=$('agendaList');if(!root||rendering)return;rendering=true;pauseObservers();
 try{
  injectCss();cleanupClubAgenda();if(force){ctx=null;ctxAt=0;matchCache.clear()}
  const c=await context(force),sel=selection(),allSelected=String(sel?.teamGuid||'').startsWith('all-');
  const extraGuids=new Set([...c.memberTeams,...c.trainerTeams].map(x=>String(x.foy_team_guid||'')).filter(Boolean));
  if(sel?.teamGuid&&!allSelected)extraGuids.add(String(sel.teamGuid));
  await Promise.all([...extraGuids].map(teamMatches));
  let map=matchMap();await tagDays(root,map);
  root.querySelectorAll('.agenda-training,.agenda-extra-match').forEach(x=>x.remove());

  const existing=new Set([...root.querySelectorAll('[data-match-id]')].map(x=>String(x.dataset.matchId)));
  const personalGuids=new Set([...c.memberTeams,...c.trainerTeams].map(x=>String(x.foy_team_guid||'')).filter(Boolean));
  for(const g of personalGuids)for(const m of matchCache.get(g)||[]){if(existing.has(String(m.id)))continue;existing.add(String(m.id));findDay(root,d(m.date)).insertAdjacentHTML('beforeend',extraMatchCard(m))}

  map=matchMap();await tagDays(root,map);
  const selectedTeam=c.allTeams.find(x=>String(x.foy_team_guid)===String(sel?.teamGuid||''));
  const relevantIds=new Set([...c.memberTeams,...c.trainerTeams].map(x=>x.id));if(selectedTeam)relevantIds.add(selectedTeam.id);
  const visibleSlots=c.slots.filter(slot=>allSelected||slot.team_id==null||!slot.teams||relevantIds.has(slot.team_id));
  const q=season(),today=new Date().toISOString().slice(0,10);
  for(const o of occurrences(visibleSlots,today,q.end))findDay(root,o.date).insertAdjacentHTML('beforeend',trainingCard(o));

  await polishMatches(map);sortAgenda(root);
 }catch(e){console.warn('Agenda kon niet worden aangevuld',e)}finally{rendering=false;resumeObservers()}
}
function schedule(force=false,delay=220){clearTimeout(timer);timer=setTimeout(()=>render(force),delay)}
function installObservers(){
 agendaObserver=new MutationObserver(muts=>{if(rendering)return;if(muts.some(m=>m.addedNodes.length||m.removedNodes.length))schedule(false,180)});
 gamesObserver=new MutationObserver(muts=>{if(rendering)return;if(muts.some(m=>m.addedNodes.length||m.removedNodes.length))schedule(false,180)});
 resumeObservers();
}
function init(){
 injectCss();installObservers();schedule(true,450);
 $('teamSelect')?.addEventListener('change',()=>schedule(true,500));
 $('personSelect')?.addEventListener('change',()=>schedule(false,250));
 $('syncBtn')?.addEventListener('click',()=>schedule(true,1000));
 document.addEventListener('click',e=>{if(e.target.closest('.tab[data-view="agenda"],.tab[data-view="games"]'))schedule(false,120);if(e.target.closest('.tab[data-view="club"],[data-view="club"]'))setTimeout(cleanupClubAgenda,160)},true);
 document.addEventListener('basketball-attendance-changed',()=>schedule(false,120));
 setTimeout(cleanupClubAgenda,700);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();