(()=>{
'use strict';

const FED='52cfa65e-9782-4a81-ab35-e2f981fcb7a9';
const ARGON='a4a2e2fa-0635-46a5-8969-1d0fef40444f';
const API='https://api.foys.io/competition/public-api/v1';
const CLUB_API='https://api.foys.io/foys/api/v2/pub';
const STORE='basketballApp.selection.v3';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const d=v=>String(v||'').slice(0,10);
const t=v=>String(v||'').slice(0,5);
const headers=()=>({Accept:'application/json','X-FederationID':FED});

const matchCache=new Map(),logoCache=new Map(),clubLogoCache=new Map(),orgTeamsCache=new Map();
let argonTeams=[],pools=[],filterGuid='',currentRows=[],renderToken=0,loading=false;

function selection(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}}
function season(){const n=new Date(),y=n.getMonth()>=6?n.getFullYear():n.getFullYear()-1;return{start:`${y}-07-01`,end:`${y+1}-06-30`}}
function ordinal(n){return n?`${n}e`:'—'}
function teamGuid(m,side){return String(m?.[`${side}TeamGuid`]||m?.[`${side}Team`]?.guid||'')}
function clubName(m,side){return String(m?.[`${side}TeamSponsorClubName`]||m?.[`${side}Organisation`]?.name||'').trim()}
function teamName(m,side){return [clubName(m,side),m?.[`${side}TeamName`]||m?.[`${side}Team`]?.name||''].filter(Boolean).join(' ').trim()||'Onbekend team'}
function competitionKey(m){const c=m?.competition||{};return String(c.guid||c.id||c.competitionGuid||c.name||'').trim()||'__none__'}
function competitionName(m){return m?.competition?.name||'Competitie'}
function hasScore(m){return m?.homeScore!==null&&m?.homeScore!==undefined&&m?.awayScore!==null&&m?.awayScore!==undefined}
function isPlayed(m){return hasScore(m)&&(m.status==='Final'||m.status==='Played'||d(m.date)<=new Date().toISOString().slice(0,10))}
function formatDay(v){return new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(new Date(`${d(v)}T12:00:00`)).toUpperCase()}
async function json(url,opts={}){const r=await fetch(url,{cache:'no-store',headers:headers(),...opts});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return r.json()}

function injectCss(){
 if($('feedV5Css'))return;
 const s=document.createElement('style');s.id='feedV5Css';s.textContent=`
 #view-feed .section-head{margin-bottom:10px}
 .feed-standing-grid{display:grid;gap:5px;margin:0 0 10px}
 .feed-standing-item{display:flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:6px 8px;min-height:38px}
 .feed-standing-logo{width:24px;height:24px;object-fit:contain;flex:0 0 24px;border-radius:6px;background:#fff}
 .feed-standing-name{font-size:11px;font-weight:850;line-height:1.15;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .feed-pos{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:20px;padding:0 6px;border-radius:999px;background:#fff0e8;color:#ef6500;font-size:9px;font-weight:900;line-height:1;white-space:nowrap;flex:0 0 auto}
 .feed-of{color:var(--muted);font-size:9px;line-height:1;white-space:nowrap;flex:0 0 auto}
 .feed-filter-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:9px 10px;margin:0 0 12px}
 .feed-filter-card label{display:block;font-size:10px;font-weight:800;margin-bottom:6px}
 .feed-filter-card select{width:100%}
 .feed-event{padding:14px 14px 13px}
 .feed-card-head{display:flex;align-items:center;justify-content:flex-start;margin-bottom:10px}
 .feed-matchup-horizontal{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start}
 .feed-side{min-width:0}
 .feed-side-main{display:flex;align-items:center;gap:8px;min-width:0}
 .feed-side.away .feed-side-main{justify-content:flex-end}
 .feed-team-logo{width:38px;height:38px;object-fit:contain;flex:0 0 38px;border-radius:8px;background:#fff}
 .feed-logo-placeholder{display:inline-block;background:#eef0f5}
 .feed-team-line{display:flex;align-items:center;gap:6px;min-width:0}
 .feed-side.away .feed-team-line{justify-content:flex-end}
 .feed-team-name{font-weight:900;line-height:1.15;min-width:0;overflow-wrap:anywhere}
 .feed-side-text{min-width:0;flex:1}
 .feed-score{text-align:center;font-weight:950;font-size:36px;line-height:1;margin:16px 0 12px;color:var(--navy)}
 .feed-location{text-align:center;margin-top:0}
 .feed-event .competition{text-align:center}
 @media(max-width:480px){
  .feed-standing-item{gap:5px;padding:5px 7px;min-height:34px}
  .feed-standing-logo{width:22px;height:22px;flex-basis:22px}
  .feed-standing-name{font-size:10px}
  .feed-pos{min-width:22px;height:18px;padding:0 5px;font-size:8px}
  .feed-of{font-size:8px}
  .feed-event{padding:12px}
  .feed-matchup-horizontal{gap:8px}
  .feed-team-logo{width:32px;height:32px;flex-basis:32px}
  .feed-team-name{font-size:14px}
  .feed-score{font-size:34px;margin-top:14px}
 }
 `;document.head.appendChild(s);
}

async function loadArgonTeams(){
 if(argonTeams.length)return argonTeams;
 const rows=await json(`${API}/organisations/${ARGON}/teams`);
 argonTeams=(Array.isArray(rows)?rows:[]).filter(x=>x?.guid&&!String(x.guid).startsWith('all-'));
 for(const tm of argonTeams)if(tm.logoUrl)logoCache.set(String(tm.guid),tm.logoUrl);
 return argonTeams;
}
async function teamMatches(guid){
 if(matchCache.has(guid))return matchCache.get(guid);
 const q=season(),all=[];let skip=0,total=Infinity;
 while(skip<total){
  const p=new URLSearchParams({startDate:q.start,endDate:q.end,teamGuid:guid,skipCount:String(skip),maxResultCount:'100',sorting:'date asc, startTime asc'});
  const j=await json(`${API}/matches?${p}`),rows=Array.isArray(j?.items)?j.items:[];
  all.push(...rows);total=Number.isFinite(Number(j?.totalCount))?Number(j.totalCount):rows.length;skip+=rows.length;
  if(!rows.length||rows.length<100)break;
 }
 matchCache.set(guid,all);return all;
}
async function mapLimit(items,limit,fn){let i=0;const out=new Array(items.length);await Promise.all(Array.from({length:Math.min(limit,Math.max(1,items.length))},async()=>{while(i<items.length){const n=i++;out[n]=await fn(items[n],n)}}));return out}
function primaryGroup(matches,anchor){
 const groups=new Map();
 for(const m of matches){const h=teamGuid(m,'home'),a=teamGuid(m,'away');if(h!==anchor&&a!==anchor)continue;if(/beker|cup/i.test(competitionName(m)))continue;const k=competitionKey(m);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(m)}
 if(!groups.size)for(const m of matches){const k=competitionKey(m);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(m)}
 return [...groups.entries()].sort((a,b)=>b[1].length-a[1].length)[0]||['__none__',[]];
}
function poolMembers(anchor,rows){const s=new Set([anchor]);for(const m of rows){const h=teamGuid(m,'home'),a=teamGuid(m,'away');if(h)s.add(h);if(a)s.add(a)}return s}
function labelsForPool(p){const map=new Map();for(const m of p.matches){const h=teamGuid(m,'home'),a=teamGuid(m,'away');if(h&&!map.has(h))map.set(h,teamName(m,'home'));if(a&&!map.has(a))map.set(a,teamName(m,'away'))}for(const g of p.anchorGuids){const tm=argonTeams.find(x=>String(x.guid)===String(g));if(tm&&!map.has(g))map.set(g,`SV Argon ${tm.name}`)}return map}
function standings(p){
 const stats=new Map([...p.members].map(g=>[g,{guid:g,played:0,points:0,for:0,against:0}]));
 for(const m of p.matches.filter(isPlayed)){const h=stats.get(teamGuid(m,'home')),a=stats.get(teamGuid(m,'away'));if(!h||!a)continue;const hs=Number(m.homeScore),as=Number(m.awayScore);h.played++;a.played++;h.for+=hs;h.against+=as;a.for+=as;a.against+=hs;if(hs>as)h.points+=2;else if(as>hs)a.points+=2;else{h.points++;a.points++}}
 return [...stats.values()].sort((x,y)=>y.points-x.points||((y.for-y.against)-(x.for-x.against))||y.for-x.for||String(x.guid).localeCompare(String(y.guid)));
}
function directLogo(m,side){return m?.[`${side}TeamLogoUrl`]||m?.[`${side}Team`]?.logoUrl||m?.[`${side}Organisation`]?.logoUrl||m?.[`${side}TeamSponsorClubLogoUrl`]||m?.[`${side}ClubLogoUrl`]||''}
function organisationId(m,side){return String(m?.[`${side}Organisation`]?.id||m?.[`${side}Organisation`]?.guid||m?.[`${side}OrganisationId`]||m?.[`${side}OrganisationGuid`]||m?.[`${side}ClubId`]||m?.[`${side}ClubGuid`]||'')}
async function organisationTeams(id){if(!id)return[];if(orgTeamsCache.has(id))return orgTeamsCache.get(id);try{const rows=await json(`${API}/organisations/${encodeURIComponent(id)}/teams`),list=Array.isArray(rows)?rows:[];orgTeamsCache.set(id,list);return list}catch{orgTeamsCache.set(id,[]);return[]}}
async function clubLogo(name){
 const key=norm(name);if(!key)return'';if(clubLogoCache.has(key))return clubLogoCache.get(key);
 try{const p=new URLSearchParams({quickSearch:name,maxResultCount:'20',skipCount:'0'}),r=await fetch(`${CLUB_API}/organisations/${FED}/clubs?${p}`,{cache:'no-store'});if(!r.ok)throw 0;const j=await r.json(),rows=Array.isArray(j)?j:(j?.items||[]),hit=rows.find(x=>norm(x.name)===key)||rows[0],src=hit?.logoUrl||hit?.logo||'';clubLogoCache.set(key,src);return src}catch{clubLogoCache.set(key,'');return''}
}
async function resolvePoolLogos(p){
 const reps=new Map();for(const m of p.matches)for(const side of ['home','away']){const g=teamGuid(m,side);if(g&&!reps.has(g))reps.set(g,{m,side})}
 await mapLimit([...p.members],5,async g=>{if(logoCache.has(g))return;const rep=reps.get(g);if(!rep)return;let src=directLogo(rep.m,rep.side);if(!src){const oid=organisationId(rep.m,rep.side);if(oid){const list=await organisationTeams(oid),tm=list.find(x=>String(x.guid)===String(g));src=tm?.logoUrl||''}}if(!src)src=await clubLogo(clubName(rep.m,rep.side));logoCache.set(g,src||'')});
}
async function buildPools(anchorGuids){
 const source=await mapLimit(anchorGuids,5,async g=>({g,rows:await teamMatches(g)})),raw=[];
 for(const x of source){const [competition,leagueRows]=primaryGroup(x.rows,x.g),members=poolMembers(x.g,leagueRows);if(members.size>1)raw.push({anchorGuids:[x.g],competition,competitionName:competitionName(leagueRows[0]),members})}
 const bySig=new Map();for(const p of raw){const sig=`${p.competition}|${[...p.members].sort().join(',')}`;if(bySig.has(sig))bySig.get(sig).anchorGuids.push(...p.anchorGuids);else bySig.set(sig,p)}
 const result=[...bySig.values()],need=[...new Set(result.flatMap(p=>[...p.members]))];await mapLimit(need,6,g=>teamMatches(g));
 for(const p of result){const byId=new Map();for(const g of p.members)for(const m of matchCache.get(g)||[]){if(competitionKey(m)!==p.competition)continue;const h=teamGuid(m,'home'),a=teamGuid(m,'away');if(p.members.has(h)&&p.members.has(a))byId.set(String(m.id),m)}p.matches=[...byId.values()];p.standings=standings(p);p.position=new Map(p.standings.map((x,i)=>[x.guid,i+1]));p.labelMap=labelsForPool(p);await resolvePoolLogos(p)}
 return result;
}
function poolForAnchor(g){return pools.find(p=>p.anchorGuids.includes(g))||null}

function inject(){
 injectCss();
 if($('view-feed'))return;
 const sec=document.createElement('section');sec.id='view-feed';sec.className='view';sec.innerHTML='<div class="section-head"><div><h1>Feed</h1><p id="feedSubtitle">Uitslagen uit de poules waarin SV Argon speelt.</p></div></div><div id="feedSummary"></div><div id="feedFilter"></div><div id="feedRoot"><div class="empty">Feed laden…</div></div>';
 $('view-tasks')?.insertAdjacentElement('afterend',sec);
 const nav=document.querySelector('.tabs'),cal=nav?.querySelector('.tab[data-view="calendar"]');
 if(nav&&!nav.querySelector('.tab[data-view="feed"]')){const b=document.createElement('button');b.className='tab';b.type='button';b.dataset.view='feed';b.innerHTML='<span class="tab-icon">▤</span>Feed';b.onclick=async()=>{document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v===sec));document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));await render(true)};if(cal)nav.insertBefore(b,cal);else nav.appendChild(b)}
}
function logoHtml(guid,cls='feed-team-logo'){const src=logoCache.get(String(guid));return src?`<img class="${cls}" src="${esc(src)}" alt="" loading="lazy">`:`<span class="${cls} feed-logo-placeholder" aria-hidden="true"></span>`}
function summaryHtml(anchors){const rows=[];for(const g of anchors){const p=poolForAnchor(g),tm=argonTeams.find(x=>String(x.guid)===String(g)),pos=p?.position.get(g);if(tm&&p&&pos)rows.push(`<div class="feed-standing-item">${logoHtml(g,'feed-standing-logo')}<span class="feed-standing-name">SV Argon ${esc(tm.name)}</span><span class="feed-pos">${esc(ordinal(pos))}</span><span class="feed-of">van ${p.members.size}</span></div>`)}return rows.length?`<div class="feed-standing-grid">${rows.join('')}</div>`:''}
function sideHtml(guid,name,pos,side){
 const badge=pos?`<span class="feed-pos">${esc(ordinal(pos))}</span>`:'';
 if(side==='away')return `<div class="feed-side away"><div class="feed-side-main"><div class="feed-side-text"><div class="feed-team-line"><span class="feed-team-name">${esc(name)}</span>${badge}</div></div>${logoHtml(guid)}</div></div>`;
 return `<div class="feed-side home"><div class="feed-side-main">${logoHtml(guid)}<div class="feed-side-text"><div class="feed-team-line"><span class="feed-team-name">${esc(name)}</span>${badge}</div></div></div></div>`;
}
function card(m,p){
 const h=teamGuid(m,'home'),a=teamGuid(m,'away'),hp=p.position.get(h),ap=p.position.get(a),home=p.labelMap.get(h)||teamName(m,'home'),away=p.labelMap.get(a)||teamName(m,'away'),score=`${m.homeScore} – ${m.awayScore}`,loc=[m.accommodationName,m.fieldName].filter(Boolean).join(' · ');
 return `<article class="event feed-event" data-feed-match="${esc(m.id)}"><div class="feed-card-head"><span class="badge badge-final">Uitslag</span></div><div class="feed-matchup-horizontal">${sideHtml(h,home,hp,'home')}${sideHtml(a,away,ap,'away')}</div><div class="feed-score">${esc(score)}</div><div class="meta feed-location">${esc(loc||'Locatie niet bekend')}</div><div class="competition">${esc(p.competitionName)} · wedstrijd-ID ${esc(m.id)}</div></article>`;
}
function renderRows(rows){
 if(!rows.length)return '<div class="empty">Nog geen gespeelde wedstrijden gevonden voor deze selectie.</div>';
 const byDate=new Map();for(const x of rows){const key=d(x.m.date);if(!byDate.has(key))byDate.set(key,[]);byDate.get(key).push(x)}
 return [...byDate.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([date,list])=>`<section class="day"><div class="day-head">${esc(formatDay(date))}</div>${list.sort((x,y)=>t(y.m.startTime).localeCompare(t(x.m.startTime))).map(x=>card(x.m,x.p)).join('')}</section>`).join('');
}
function drawRows(){const root=$('feedRoot');if(!root)return;const rows=filterGuid?currentRows.filter(x=>teamGuid(x.m,'home')===filterGuid||teamGuid(x.m,'away')===filterGuid):currentRows;root.innerHTML=renderRows(rows)}
function renderFilter(pool){
 const host=$('feedFilter');if(!host)return;
 if(!pool){host.innerHTML='';filterGuid='';return}
 if(filterGuid&&!pool.members.has(filterGuid))filterGuid='';
 const options=[...pool.members].sort((a,b)=>(pool.position.get(a)||999)-(pool.position.get(b)||999)).map(g=>`<option value="${esc(g)}" ${filterGuid===g?'selected':''}>${esc(pool.labelMap.get(g)||g)}${pool.position.get(g)?` · ${esc(ordinal(pool.position.get(g)))}`:''}</option>`).join('');
 host.innerHTML=`<div class="feed-filter-card"><label for="feedTeamFilter">Team in deze poule</label><select id="feedTeamFilter"><option value="">Alle teams in deze poule</option>${options}</select></div>`;
 $('feedTeamFilter').onchange=e=>{filterGuid=e.target.value;drawRows()};
}
async function render(force=false){
 inject();if(loading&&!force)return;const token=++renderToken,root=$('feedRoot');if(!root)return;loading=true;root.innerHTML='<div class="empty">Poule en uitslagen laden…</div>';
 try{
  await loadArgonTeams();const s=selection(),selected=String(s?.teamGuid||''),all=selected.startsWith('all-');
  const anchors=all?argonTeams.map(x=>String(x.guid)):[selected].filter(Boolean);
  pools=await buildPools(anchors);if(token!==renderToken)return;
  $('feedSubtitle').textContent=all?'Alle gespeelde wedstrijden uit alle poules waarin een SV Argon-team speelt.':`Alle gespeelde wedstrijden uit de poule van SV Argon ${s?.teamName||''}.`;
  $('feedSummary').innerHTML=summaryHtml(anchors);
  const selectedPool=all?null:poolForAnchor(selected);renderFilter(selectedPool);
  const seen=new Set(),rows=[];
  for(const p of pools)for(const m of p.matches.filter(isPlayed)){if(seen.has(String(m.id)))continue;seen.add(String(m.id));rows.push({m,p})}
  currentRows=rows.sort((x,y)=>`${d(y.m.date)}T${t(y.m.startTime)}`.localeCompare(`${d(x.m.date)}T${t(x.m.startTime)}`));drawRows();
 }catch(e){console.error('Feed laden mislukt',e);root.innerHTML='<div class="empty error-box">Feed kon niet worden geladen.</div>'}
 finally{loading=false}
}

function init(){inject();$('teamSelect')?.addEventListener('change',()=>{filterGuid='';matchCache.clear();setTimeout(()=>render(true),350)});$('syncBtn')?.addEventListener('click',()=>setTimeout(()=>render(true),900));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();