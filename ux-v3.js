(()=>{
'use strict';
const U='https://elpnfmlrkoemjrnzaeok.supabase.co';
const K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
const F='52cfa65e-9782-4a81-ab35-e2f981fcb7a9';
const API='https://api.foys.io/competition/public-api/v1';
const STORE='basketballApp.selection.v3';
const CACHE='basketballApp.matches.v3.';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const d=v=>String(v||'').slice(0,10),t=v=>String(v||'').slice(0,5);
const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
let sb=null,ctx=null,ctxAt=0,running=false,queued=false;
const matchCache=new Map(),logoCache=new Map(),orgTeamCache=new Map();
const MONTHS={januari:1,februari:2,maart:3,april:4,mei:5,juni:6,juli:7,augustus:8,september:9,oktober:10,november:11,december:12};
function season(){const n=new Date(),y=n.getMonth()>=6?n.getFullYear():n.getFullYear()-1;return{start:`${y}-07-01`,end:`${y+1}-06-30`}}
function selection(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}}
function guid(m,side){return String(m?.[`${side}TeamGuid`]||m?.[`${side}Team`]?.guid||'')}
function teamName(m,side){return [m?.[`${side}TeamSponsorClubName`]||m?.[`${side}Organisation`]?.name,m?.[`${side}TeamName`]||m?.[`${side}Team`]?.name].filter(Boolean).join(' ').trim()||'Onbekend team'}
function scored(m){return m?.homeScore!==null&&m?.homeScore!==undefined&&m?.awayScore!==null&&m?.awayScore!==undefined}
function dayLabel(date){return new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(new Date(`${date}T12:00:00`)).toUpperCase()}
function parseDayHead(txt){const p=String(txt||'').trim().toLowerCase().split(/\s+/);if(p.length<4)return'';const year=Number(p.at(-1)),month=MONTHS[p.at(-2)],day=Number(p.at(-3));return year&&month&&day?`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`:''}
async function client(){if(sb)return sb;const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});sb.auth.onAuthStateChange(()=>{ctx=null;ctxAt=0;matchCache.clear();schedule(true)});return sb}
async function context(force=false){if(!force&&ctx&&Date.now()-ctxAt<15000)return ctx;const s=await client();const [teams,slots,sessionResult]=await Promise.all([
  s.from('teams').select('id,team_name,foy_team_guid').eq('active',true).order('team_name'),
  s.from('training_slots').select('*,teams(id,team_name,foy_team_guid)').eq('active',true).order('weekday').order('start_time'),
  s.auth.getSession()
]);
 let member=null,memberTeams=[],trainerTeams=[];const session=sessionResult.data?.session||null;
 if(session){const r=await s.rpc('sync_current_member');if(!r.error&&r.data?.active){member=r.data;const [pt,tt]=await Promise.all([
   s.from('member_teams').select('team_id,teams(id,team_name,foy_team_guid)').eq('member_id',member.id),
   s.from('member_trainer_teams').select('team_id,teams(id,team_name,foy_team_guid)').eq('member_id',member.id)
 ]);const map=x=>(x.data||[]).map(v=>v.teams?{...v.teams,id:v.team_id}:null).filter(Boolean);memberTeams=map(pt);trainerTeams=map(tt)}}
 ctx={session,member,teams:teams.data||[],slots:slots.data||[],memberTeams,trainerTeams};ctxAt=Date.now();return ctx}
async function fetchJson(url){const r=await fetch(url,{headers:{Accept:'application/json','X-FederationID':F},cache:'no-store'});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return r.json()}
async function teamMatches(g){if(!g)return[];if(matchCache.has(g))return matchCache.get(g);const q=season(),out=[];let skip=0,total=Infinity;while(skip<total){const p=new URLSearchParams({startDate:q.start,endDate:q.end,teamGuid:g,skipCount:String(skip),maxResultCount:'100',sorting:'date asc, startTime asc'}),j=await fetchJson(`${API}/matches?${p}`),rows=Array.isArray(j?.items)?j.items:[];out.push(...rows);total=Number(j?.totalCount)||rows.length;skip+=rows.length;if(!rows.length||rows.length<100)break}matchCache.set(g,out);return out}
function storedMatches(){const out=new Map();for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(CACHE))continue;try{for(const m of JSON.parse(localStorage.getItem(key)||'{}')?.matches||[])out.set(String(m.id),m)}catch{}}for(const rows of matchCache.values())for(const m of rows)out.set(String(m.id),m);return out}
function directLogo(m,side){return m?.[`${side}TeamLogoUrl`]||m?.[`${side}Team`]?.logoUrl||m?.[`${side}Organisation`]?.logoUrl||m?.[`${side}TeamSponsorClubLogoUrl`]||m?.[`${side}ClubLogoUrl`]||m?.[`${side}LogoUrl`]||''}
function orgId(m,side){return String(m?.[`${side}Organisation`]?.id||m?.[`${side}OrganisationId`]||m?.[`${side}ClubId`]||'')}
async function orgTeams(id){if(!id)return[];if(orgTeamCache.has(id))return orgTeamCache.get(id);try{const rows=await fetchJson(`${API}/organisations/${encodeURIComponent(id)}/teams`),list=Array.isArray(rows)?rows:[];orgTeamCache.set(id,list);return list}catch{orgTeamCache.set(id,[]);return[]}}
async function logo(m,side){const g=guid(m,side);if(logoCache.has(g))return logoCache.get(g);const direct=directLogo(m,side);if(direct){logoCache.set(g,direct);return direct}const oid=orgId(m,side);if(oid){const tm=(await orgTeams(oid)).find(x=>String(x.guid)===g);if(tm?.logoUrl){logoCache.set(g,tm.logoUrl);return tm.logoUrl}}logoCache.set(g,'');return''}
function css(){if($('uxV3Style'))return;const s=document.createElement('style');s.id='uxV3Style';s.textContent=`
.uxv3-team-title{display:flex!important;align-items:center;gap:5px;flex-wrap:wrap;line-height:1.3}
.uxv3-team{display:inline-flex;align-items:center;gap:5px;min-width:0}
.uxv3-team img{width:19px;height:19px;object-fit:contain;border-radius:4px;background:#fff;flex:0 0 19px}
.uxv3-dash{color:var(--text);font-weight:900}
.uxv3-training .event-status{color:var(--navy)}
.uxv3-training .badge-training{background:#eef1ff;color:var(--navy)}
.feed-event .event-row{display:block!important}
.feed-event .time-col{display:flex!important;align-items:center!important;gap:7px!important;width:auto!important;margin:0 0 8px!important}
.feed-event .time-col .event-time.score{display:none!important}
.feed-event .time-col .event-status{display:none!important}
.feed-event .feed-start{margin:0!important;font-size:9px!important}
.feed-event .event-main{width:100%!important}
.feed-event .feed-matchup{display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;gap:9px!important;align-items:center!important;margin:8px 0 7px!important}
.feed-event .feed-versus{display:block!important;font-weight:900;color:var(--muted);text-align:center}
.feed-event .feed-team-row{display:flex!important;align-items:center!important;gap:5px!important;min-width:0}
.feed-event .feed-team-row:nth-child(3){justify-content:flex-end!important;text-align:right}
.feed-event .feed-team-name{font-size:10px!important;line-height:1.2!important;overflow-wrap:anywhere}
.feed-event .feed-team-logo{width:22px!important;height:22px!important;flex:0 0 22px!important}
.feed-score-below{text-align:center;font-size:20px;font-weight:950;color:var(--navy);line-height:1;margin:5px 0 8px}
#clubTabs [data-clubview="clubagenda"],#club-sub-clubagenda{display:none!important}
#adminTabs [data-adminview="agenda"]{display:inline-flex!important}
@media(max-width:420px){.feed-event .feed-team-name{font-size:9px!important}.feed-score-below{font-size:18px}.uxv3-team img{width:17px;height:17px;flex-basis:17px}}
`;document.head.appendChild(s)}
function selectedTeam(c){const s=selection();if(!s?.teamGuid||String(s.teamGuid).startsWith('all-'))return null;return c.teams.find(x=>String(x.foy_team_guid)===String(s.teamGuid))||null}
function visibleTeamIds(c){const s=selection(),all=String(s?.teamGuid||'').startsWith('all-'),ids=new Set();if(all){for(const x of c.teams)ids.add(x.id)}else{const tm=selectedTeam(c);if(tm)ids.add(tm.id);for(const x of c.memberTeams)ids.add(x.id);for(const x of c.trainerTeams)ids.add(x.id)}for(const x of c.teams)if(norm(x.team_name)==='alleteams')ids.add(x.id);return ids}
function occurrences(slots,start,end){const a=new Date(`${start}T12:00:00`),b=new Date(`${end}T12:00:00`),out=[];for(let cur=new Date(a);cur<=b;cur.setDate(cur.getDate()+1)){const wd=cur.getDay()||7,date=cur.toISOString().slice(0,10);for(const s of slots)if(Number(s.weekday)===wd)out.push({date,slot:s})}return out}
function ensureDay(root,date){let day=[...root.querySelectorAll('.day')].find(x=>(x.dataset.uxv3Date||parseDayHead(x.querySelector('.day-head')?.textContent))===date);if(day){day.dataset.uxv3Date=date;return day}day=document.createElement('section');day.className='day';day.dataset.uxv3Date=date;day.innerHTML=`<div class="day-head">${esc(dayLabel(date))}</div>`;root.appendChild(day);return day}
function trainingCard(o){const s=o.slot,name=s.teams?.team_name||'Training';return `<article class="event uxv3-training" data-uxv3-training="${esc(s.id)}:${esc(o.date)}" data-uxv3-time="${esc(t(s.start_time))}"><div class="event-row"><div class="time-col"><div class="event-time">${esc(t(s.start_time))}</div><span class="event-status">Training</span></div><div class="event-main"><span class="badge badge-training">Training</span><div class="match-title">SV Argon ${esc(name)}</div><div class="meta">${esc(t(s.start_time))} - ${esc(t(s.end_time))}${s.location?` · ${esc(s.location)}`:''}</div></div></div></article>`}
function extraMatchCard(m){const score=scored(m)?`${m.homeScore} – ${m.awayScore}`:'',loc=[m.accommodationName,m.fieldName].filter(Boolean).join(' · ');return `<article class="event uxv3-extra-match" data-match-id="${esc(m.id)}" data-uxv3-time="${esc(t(m.startTime))}"><div class="event-row"><div class="time-col"><div class="event-time">${esc(t(m.startTime))}</div><span class="event-status">${scored(m)?'Eindstand':'Gepland'}</span></div><div class="event-main"><span class="badge ${scored(m)?'badge-final':'badge-game'}">${scored(m)?'Uitslag':'Wedstrijd'}</span><div class="match-title">${esc(teamName(m,'home'))} — ${esc(teamName(m,'away'))}</div>${score?`<div class="score-line">${esc(score)}</div>`:''}<div class="meta">${esc(loc||'Locatie niet bekend')}</div><div class="competition">${esc(m.competition?.name||'')} · wedstrijd-ID ${esc(m.id)}</div></div></div></article>`}
async function injectAgenda(c){const root=$('agendaList');if(!root)return;root.querySelectorAll('.uxv3-training,.rework-training,.polish-training,.uxv3-extra-match').forEach(x=>x.remove());for(const day of root.querySelectorAll('.day')){const date=parseDayHead(day.querySelector('.day-head')?.textContent);if(date)day.dataset.uxv3Date=date}
 const s=selection(),all=String(s?.teamGuid||'').startsWith('all-');const guids=new Set();if(c.member)for(const x of [...c.memberTeams,...c.trainerTeams])if(x.foy_team_guid)guids.add(String(x.foy_team_guid));if(!all&&s?.teamGuid)guids.add(String(s.teamGuid));const existing=new Set([...root.querySelectorAll('article[data-match-id]')].map(x=>String(x.dataset.matchId)));
 for(const g of guids){for(const m of await teamMatches(g)){if(existing.has(String(m.id)))continue;existing.add(String(m.id));const wrap=document.createElement('div');wrap.innerHTML=extraMatchCard(m);ensureDay(root,d(m.date)).appendChild(wrap.firstElementChild)}}
 const ids=visibleTeamIds(c),today=new Date().toISOString().slice(0,10),q=season(),slots=c.slots.filter(x=>ids.has(x.team_id)||norm(x.teams?.team_name)==='alleteams');for(const o of occurrences(slots,today,q.end)){const wrap=document.createElement('div');wrap.innerHTML=trainingCard(o);ensureDay(root,o.date).appendChild(wrap.firstElementChild)}
 sortAgenda(root)}
function sortAgenda(root){for(const day of root.querySelectorAll('.day')){const cards=[...day.querySelectorAll(':scope > article.event')];cards.sort((a,b)=>cardTime(a).localeCompare(cardTime(b))).forEach(x=>day.appendChild(x))}const days=[...root.querySelectorAll('.day')];days.sort((a,b)=>(a.dataset.uxv3Date||parseDayHead(a.querySelector('.day-head')?.textContent)||'9999').localeCompare(b.dataset.uxv3Date||parseDayHead(b.querySelector('.day-head')?.textContent)||'9999')).forEach(x=>root.appendChild(x))}
function cardTime(card){if(card.dataset.uxv3Time)return card.dataset.uxv3Time;const v=card.querySelector('.event-time')?.textContent?.trim()||'';const m=v.match(/\b(\d{1,2}:\d{2})\b/);return m?m[1].padStart(5,'0'):'99:99'}
async function enhanceCards(){const mm=storedMatches(),cards=[...document.querySelectorAll('#agendaList article.event[data-match-id],#gamesList article.event[data-match-id]')];await Promise.all(cards.map(async card=>{const m=mm.get(String(card.dataset.matchId));if(!m)return;if(scored(m)){const timeEl=card.querySelector('.time-col .event-time');if(timeEl)timeEl.textContent=t(m.startTime);card.querySelectorAll('.final-start,.final-start-compact').forEach(x=>x.remove())}const title=card.querySelector('.match-title');if(!title||title.dataset.uxv3Logos==='1')return;const [hl,al]=await Promise.all([logo(m,'home'),logo(m,'away')]);title.dataset.uxv3Logos='1';title.classList.add('uxv3-team-title');title.innerHTML=`<span class="uxv3-team">${hl?`<img src="${esc(hl)}" alt="">`:''}<span>${esc(teamName(m,'home'))}</span></span><span class="uxv3-dash">—</span><span class="uxv3-team">${al?`<img src="${esc(al)}" alt="">`:''}<span>${esc(teamName(m,'away'))}</span></span>`}))}
function fixFeed(){for(const card of document.querySelectorAll('#feedRoot .feed-event')){const score=card.querySelector('.time-col .event-time.score')?.textContent?.trim();const matchup=card.querySelector('.feed-matchup');if(score&&matchup&&!card.querySelector('.feed-score-below')){const el=document.createElement('div');el.className='feed-score-below';el.textContent=score;matchup.insertAdjacentElement('afterend',el)}}}
function restoreClubAdmin(){const tabs=$('clubTabs'),agenda=tabs?.querySelector('[data-clubview="clubagenda"]');if(agenda){if(agenda.classList.contains('active')){const fallback=tabs.querySelector('[data-clubview="admin"]')||tabs.querySelector('[data-clubview="presence"]');fallback?.click()}agenda.remove()}const sub=$('club-sub-clubagenda');if(sub)sub.classList.remove('active');const admin=$('club-sub-admin'),adminTabs=$('adminTabs'),adminAgenda=$('admin-agenda'),members=$('admin-members'),btn=adminTabs?.querySelector('[data-adminview="agenda"]');if(btn)btn.style.display='';if(admin&&adminAgenda){const panel=admin.querySelector('.club-card-panel')||admin;if(adminAgenda.parentElement!==panel){adminAgenda.classList.remove('in-club-agenda');members?.insertAdjacentElement('afterend',adminAgenda)}adminAgenda.classList.remove('in-club-agenda');panel.querySelectorAll('.club-admin-agenda-note').forEach(x=>x.remove())}if(btn&&!btn.dataset.uxv3Bound){btn.dataset.uxv3Bound='1';btn.addEventListener('click',()=>{if(members)members.hidden=true;if(adminAgenda)adminAgenda.hidden=false})}}
async function run(force=false){if(running){queued=true;return}running=true;try{css();restoreClubAdmin();fixFeed();const c=await context(force);if($('view-agenda')?.classList.contains('active'))await injectAgenda(c);await enhanceCards();fixFeed();restoreClubAdmin()}catch(e){console.warn('UX v3',e)}finally{running=false;if(queued){queued=false;setTimeout(()=>run(false),100)}}}
function schedule(force=false){clearTimeout(schedule.id);schedule.id=setTimeout(()=>run(force),160)}
document.addEventListener('DOMContentLoaded',()=>{css();schedule(true);$('teamSelect')?.addEventListener('change',()=>{matchCache.clear();setTimeout(()=>schedule(true),450)});new MutationObserver(()=>schedule(false)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});setInterval(()=>{if($('view-agenda')?.classList.contains('active')||$('view-games')?.classList.contains('active')||$('view-feed')?.classList.contains('active')||$('view-club')?.classList.contains('active'))schedule(false)},1800)});
})();