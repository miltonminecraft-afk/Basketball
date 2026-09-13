(()=>{
'use strict';

const FED='52cfa65e-9782-4a81-ab35-e2f981fcb7a9';
const ARGON='a4a2e2fa-0635-46a5-8969-1d0fef40444f';
const API='https://api.foys.io/competition/public-api/v1';
const CLUB_API='https://api.foys.io/foys/api/v2/pub';
const STORE='basketballApp.selection.v3';

const cache=new Map(),orgTeamCache=new Map(),logoCache=new Map(),clubLogoCache=new Map();
let argonTeams=[],pools=[],loading=false,renderToken=0,filterGuid='',currentRows=[];
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const d=v=>String(v||'').slice(0,10),t=v=>String(v||'').slice(0,5);
const headers=()=>({Accept:'application/json','X-FederationID':FED});

function season(){const n=new Date(),y=n.getMonth()>=6?n.getFullYear():n.getFullYear()-1;return{start:`${y}-07-01`,end:`${y+1}-06-30`}}
function ordinal(n){return n?`${n}e`:'—'}
function selection(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}}
function teamGuid(m,side){return String(m?.[`${side}TeamGuid`]||m?.[`${side}Team`]?.guid||'')}
function clubName(m,side){return String(m?.[`${side}TeamSponsorClubName`]||m?.[`${side}Organisation`]?.name||'').trim()}
function teamName(m,side){const club=clubName(m,side),tn=m?.[`${side}TeamName`]||m?.[`${side}Team`]?.name||'';return[club,tn].filter(Boolean).join(' ').trim()||'Onbekend team'}
function competitionKey(m){const c=m?.competition||{};return String(c.guid||c.id||c.competitionGuid||c.name||'').trim()||'__none__'}
function competitionName(m){return m?.competition?.name||'Competitie'}
function hasScore(m){return m?.homeScore!==null&&m?.homeScore!==undefined&&m?.awayScore!==null&&m?.awayScore!==undefined}
function isPlayed(m){return hasScore(m)&&(m.status==='Final'||m.status==='Played'||d(m.date)<=new Date().toISOString().slice(0,10))}
function formatDay(v){return new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(new Date(`${d(v)}T12:00:00`)).toUpperCase()}
async function json(url){const r=await fetch(url,{headers:headers(),cache:'no-store'});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return r.json()}

async function loadArgonTeams(){
 if(argonTeams.length)return argonTeams;
 const rows=await json(`${API}/organisations/${ARGON}/teams`);
 argonTeams=(Array.isArray(rows)?rows:[]).filter(x=>x?.guid&&!String(x.guid).startsWith('all-'));
 for(const tm of argonTeams)if(tm.logoUrl)logoCache.set(String(tm.guid),tm.logoUrl);
 return argonTeams;
}
async function teamMatches(guid){
 if(cache.has(guid))return cache.get(guid);
 const q=season(),all=[];let skip=0,total=Infinity;
 while(skip<total){
  const p=new URLSearchParams({startDate:q.start,endDate:q.end,teamGuid:guid,skipCount:String(skip),maxResultCount:'100',sorting:'date asc, startTime asc'}),j=await json(`${API}/matches?${p}`),rows=Array.isArray(j?.items)?j.items:[];
  all.push(...rows);total=Number.isFinite(Number(j?.totalCount))?Number(j.totalCount):rows.length;skip+=rows.length;if(!rows.length||rows.length<100)break;
 }
 cache.set(guid,all);return all;
}
async function mapLimit(items,limit,fn){let i=0;const out=new Array(items.length),workers=Array.from({length:Math.min(limit,Math.max(1,items.length))},async()=>{while(i<items.length){const n=i++;out[n]=await fn(items[n],n)}});await Promise.all(workers);return out}
function primaryGroup(matches,anchor){
 const groups=new Map();
 for(const m of matches){const h=teamGuid(m,'home'),a=teamGuid(m,'away');if(h!==anchor&&a!==anchor)continue;const name=competitionName(m);if(/beker|cup/i.test(name))continue;const k=competitionKey(m);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(m)}
 if(!groups.size)for(const m of matches){const k=competitionKey(m);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(m)}
 return [...groups.entries()].sort((a,b)=>b[1].length-a[1].length)[0]||['__none__',[]];
}
function poolMembers(anchor,rows){const set=new Set([anchor]);for(const m of rows){const h=teamGuid(m,'home'),a=teamGuid(m,'away');if(h)set.add(h);if(a)set.add(a)}return set}
function labelsForPool(p){const map=new Map();for(const m of p.matches){const h=teamGuid(m,'home'),a=teamGuid(m,'away');if(h&&!map.has(h))map.set(h,teamName(m,'home'));if(a&&!map.has(a))map.set(a,teamName(m,'away'))}for(const g of p.anchorGuids){const tm=argonTeams.find(x=>String(x.guid)===String(g));if(tm&&!map.has(g))map.set(g,`SV Argon ${tm.name}`)}return map}
function standings(p){
 const stats=new Map([...p.members].map(g=>[g,{guid:g,played:0,points:0,for:0,against:0}]));
 for(const m of p.matches.filter(isPlayed)){const h=stats.get(teamGuid(m,'home')),a=stats.get(teamGuid(m,'away'));if(!h||!a)continue;const hs=Number(m.homeScore),as=Number(m.awayScore);h.played++;a.played++;h.for+=hs;h.against+=as;a.for+=as;a.against+=hs;if(hs>as)h.points+=2;else if(as>hs)a.points+=2;else{h.points++;a.points++}}
 const arr=[...stats.values()];arr.sort((x,y)=>y.points-x.points||((y.for-y.against)-(x.for-x.against))||y.for-x.for||String(x.guid).localeCompare(String(y.guid)));return arr;
}
function directLogo(m,side){return m?.[`${side}TeamLogoUrl`]||m?.[`${side}Team`]?.logoUrl||m?.[`${side}Organisation`]?.logoUrl||m?.[`${side}TeamSponsorClubLogoUrl`]||m?.[`${side}ClubLogoUrl`]||''}
function organisationId(m,side){return String(m?.[`${side}Organisation`]?.id||m?.[`${side}Organisation`]?.guid||m?.[`${side}OrganisationId`]||m?.[`${side}OrganisationGuid`]||m?.[`${side}ClubId`]||m?.[`${side}ClubGuid`]||'')}
async function organisationTeams(id){if(!id)return[];if(orgTeamCache.has(id))return orgTeamCache.get(id);try{const rows=await json(`${API}/organisations/${encodeURIComponent(id)}/teams`),list=Array.isArray(rows)?rows:[];orgTeamCache.set(id,list);return list}catch{orgTeamCache.set(id,[]);return[]}}
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
 for(const x of source){const [competition,leagueRows]=primaryGroup(x.rows,x.g),members=poolMembers(x.g,leagueRows);if(members.size<2)continue;raw.push({anchorGuids:[x.g],competition,competitionName:competitionName(leagueRows[0]),members})}
 const bySig=new Map();for(const p of raw){const sig=`${p.competition}|${[...p.members].sort().join(',')}`;if(bySig.has(sig))bySig.get(sig).anchorGuids.push(...p.anchorGuids);else bySig.set(sig,p)}
 const result=[...bySig.values()],need=[...new Set(result.flatMap(p=>[...p.members]))];await mapLimit(need,6,g=>teamMatches(g));
 for(const p of result){const byId=new Map();for(const g of p.members)for(const m of cache.get(g)||[]){if(competitionKey(m)!==p.competition)continue;const h=teamGuid(m,'home'),a=teamGuid(m,'away');if(p.members.has(h)&&p.members.has(a))byId.set(String(m.id),m)}p.matches=[...byId.values()];p.standings=standings(p);p.position=new Map(p.standings.map((x,i)=>[x.guid,i+1]));p.labelMap=labelsForPool(p);await resolvePoolLogos(p)}
 return result;
}
function poolForAnchor(guid){return pools.find(p=>p.anchorGuids.includes(guid))||null}

function inject(){
 if($('view-feed'))return;
 const sec=document.createElement('section');sec.id='view-feed';sec.className='view';sec.innerHTML='<div class="section-head"><div><h1>Feed</h1><p id="feedSubtitle">Uitslagen uit de poules waarin SV Argon speelt.</p></div></div><div id="feedSummary"></div><div id="feedFilter"></div><div id="feedRoot"><div class="empty">Feed laden…</div></div>';
 $('view-tasks')?.insertAdjacentElement('afterend',sec);
 const nav=document.querySelector('.tabs'),cal=nav?.querySelector('.tab[data-view="calendar"]');
 if(nav&&!nav.querySelector('.tab[data-view="feed"]')){const b=document.createElement('button');b.className='tab';b.type='button';b.dataset.view='feed';b.innerHTML='<span class="tab-icon">▤</span>Feed';b.onclick=async()=>{document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v===sec));document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));await render(true)};if(cal)nav.insertBefore(b,cal);else nav.appendChild(b)}
}
function logoHtml(guid,cls='feed-team-logo'){const src=logoCache.get(String(guid));return src?`<img class="${cls}" src="${esc(src)}" alt="" loading="lazy">`:`<span class="${cls} feed-logo-placeholder" aria-hidden="true"></span>`}
function summaryHtml(anchors){const rows=[];for(const g of anchors){const p=poolForAnchor(g),tm=argonTeams.find(x=>String(x.guid)===String(g)),pos=p?.position.get(g);if(tm&&p&&pos)rows.push(`<div class="feed-standing-item">${logoHtml(g,'feed-standing-logo')}<span class="feed-standing-name">SV Argon ${esc(tm.name)}</span><span class="feed-pos">${esc(ordinal(pos))}</span><span class="feed-of">van ${p.members.size}</span></div>`)}return rows.length?`<div class="feed-standing-grid">${rows.join('')}</div>`:''}
function sideHtml(guid,name,pos,side){return `<div class="feed-side ${side}"><div class="feed-side-main">${logoHtml(guid)}<div class="feed-side-text"><div class="feed-team-line"><span class="feed-team-name">${esc(name)}</span>${pos?`<span class="feed-pos">${esc(ordinal(pos))}</span>`:''}</div></div></div></div>`}
function card(m,p){
 const h=teamGuid(m,'home'),a=teamGuid(m,'away'),hp=p.position.get(h),ap=p.position.get(a),home=p.labelMap.get(h)||teamName(m,'home'),away=p.labelMap.get(a)||teamName(m,'away'),score=`${m.homeScore} – ${m.awayScore}`,loc=[m.accommodationName,m.fieldName].filter(Boolean).join(' · ');
 return `<article class="event feed-event" data-feed-match="${esc(m.id)}"><div class="feed-card-head"><span class="badge badge-final">Uitslag</span><span class="feed-start">Start ${esc(t(m.startTime))}</span></div><div class="feed-matchup-horizontal">${sideHtml(h,home,hp,'home')}${sideHtml(a,away,ap,'away')}</div><div class="feed-score">${esc(score)}</div><div class="meta feed-location">${esc(loc||'Locatie niet bekend')}</div><div class="competition">${esc(p.competitionName)} · wedstrijd-ID ${esc(m.id)}</div></article>`;
}
function renderRows(rows){if(!rows.length)return '<div class="empty">Nog geen gespeelde wedstrijden gevonden voor deze selectie.</div>';const byDate=new Map();for(const x of rows){const key=d(x.m.date);if(!byDate.has(key))byDate.set(key,[]);byDate.get(key).push(x)}return [...byDate.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([date,list])=>`<section class="day"><div class="day-head">${esc(formatDay(date))}</div>${list.sort((x,y)=>t(y.m.startTime).localeCompare(t(x.m.startTime))).map(x=>card(x.m,x.p)).join('')}</section>`).join('')}
function drawRows(){const root=$('feedRoot');if(!root)return;const rows=filterGuid?currentRows.filter(x=>teamGuid(x.m,'home')===filterGuid||teamGuid(x.m,'away')===filterGuid):currentRows;root.innerHTML=renderRows(rows)}
function renderFilter(pool){
 const host=$('feedFilter');if(!host)return;if(!pool){host.innerHTML='';filterGuid='';return}if(filterGuid&&!pool.members.has(filterGuid))filterGuid='';
 const options=[...pool.members].sort((a,b)=>(pool.position.get(a)||999)-(pool.position.get(b)||999)).map(g=>`<option value="${esc(g)}" ${filterGuid===g?'selected':''}>${esc(pool.labelMap.get(g)||g)}${pool.position.get(g)?` · ${esc(ordinal(pool.position.get(g)))}`:''}</option>`).join('');
 host.innerHTML=`<div class="feed-filter-card"><label for="feedTeamFilter">Team in deze poule</label><select id="feedTeamFilter"><option value="">Alle teams in deze poule</option>${options}</select></div>`;
 $('feedTeamFilter').onchange=e=>{filterGuid=e.target.value;drawRows()};
}
async function render(force=false){
 inject();if(loading&&!force)return;const token=++renderToken,root=$('feedRoot');if(!root)return;loading=true;root.innerHTML='<div class="empty">Poule en uitslagen laden…</div>';
 try{
  await loadArgonTeams();const s=selection(),selected=s?.teamGuid||'',anchors=String(selected).startsWith('all-')||!argonTeams.some(x=>String(x.guid)===String(selected))?argonTeams.map(x=>String(x.guid)):[String(selected)];
  pools=await buildPools(anchors);if(token!==renderToken)return;const one=anchors.length===1?poolForAnchor(anchors[0]):null,tm=anchors.length===1?argonTeams.find(x=>String(x.guid)===String(anchors[0])):null,pos=one?.position.get(anchors[0]);
  const sub=$('feedSubtitle');if(sub)sub.textContent=tm&&one&&pos?`Alle gespeelde wedstrijden uit de poule van SV Argon ${tm.name} (${ordinal(pos)} van ${one.members.size}).`:'Alle gespeelde wedstrijden uit alle poules waarin een SV Argon-team speelt.';
  const sum=$('feedSummary');if(sum)sum.innerHTML=summaryHtml(anchors);renderFilter(one);
  let rows=[];for(const p of pools)for(const m of p.matches)if(isPlayed(m))rows.push({m,p});const dedup=new Map();for(const x of rows)dedup.set(String(x.m.id),x);currentRows=[...dedup.values()].sort((x,y)=>`${d(y.m.date)}T${t(y.m.startTime)}`.localeCompare(`${d(x.m.date)}T${t(x.m.startTime)}`));drawRows();
 }catch(e){console.error(e);root.innerHTML=`<div class="empty error-box">Feed kon niet worden geladen: ${esc(e.message)}</div>`}finally{loading=false}
}
function css(){
 if($('feedStyle'))return;const s=document.createElement('style');s.id='feedStyle';s.textContent=`
 #view-feed .section-head{margin-bottom:10px}
 .feed-standing-grid{display:grid;gap:7px;margin-bottom:12px}
 .feed-standing-item{display:grid;grid-template-columns:32px minmax(0,1fr) auto auto;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px 12px}
 .feed-standing-logo{width:32px;height:32px;object-fit:contain;border-radius:7px;background:#fff}
 .feed-standing-name{font-weight:850;min-width:0}
 .feed-pos{display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:30px;padding:0 10px;border-radius:999px;background:#fff0e7;color:#ef5b00;font-weight:900;font-size:12px;white-space:nowrap}
 .feed-of{font-size:11px;color:var(--muted);white-space:nowrap}
 .feed-filter-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin:0 0 14px}
 .feed-filter-card label{display:block;font-weight:800;font-size:12px;color:var(--muted);margin-bottom:7px}
 .feed-filter-card select{width:100%;min-height:48px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--navy);padding:0 14px;font:inherit;font-weight:800}
 .feed-event{padding:16px!important}
 .feed-card-head{display:flex;align-items:center;gap:8px;margin-bottom:14px}
 .feed-start{margin-left:auto;font-size:12px;font-weight:800;color:var(--muted)}
 .feed-matchup-horizontal{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start}
 .feed-side{min-width:0}
 .feed-side.home{text-align:left}
 .feed-side.away{text-align:right}
 .feed-side-main{display:flex;align-items:center;gap:8px;min-width:0}
 .feed-side.away .feed-side-main{flex-direction:row-reverse}
 .feed-side-text{min-width:0;flex:1}
 .feed-team-line{display:flex;align-items:center;gap:7px;min-width:0}
 .feed-side.away .feed-team-line{justify-content:flex-end}
 .feed-team-name{font-weight:900;line-height:1.2;min-width:0;overflow-wrap:anywhere}
 .feed-team-logo{width:34px;height:34px;object-fit:contain;flex:0 0 34px;border-radius:7px;background:#fff}
 .feed-logo-placeholder{display:inline-block;background:#f0f1f6}
 .feed-score{text-align:center;font-size:30px;line-height:1;font-weight:950;color:var(--navy);margin:15px 0 11px}
 .feed-location{text-align:center;margin-top:0!important}
 #feedRoot .competition{text-align:center}
 @media(max-width:480px){
  .feed-event{padding:13px!important}
  .feed-matchup-horizontal{gap:8px}
  .feed-team-logo{width:28px;height:28px;flex-basis:28px}
  .feed-team-name{font-size:12px}
  .feed-pos{min-width:32px;height:26px;padding:0 7px;font-size:10px}
  .feed-score{font-size:27px}
  .feed-standing-item{grid-template-columns:28px minmax(0,1fr) auto auto;padding:9px 10px}
  .feed-standing-logo{width:28px;height:28px}
 }
 `;document.head.appendChild(s);
}

document.addEventListener('DOMContentLoaded',()=>{
 if(!document.querySelector('script[data-agenda-polish]')){const sc=document.createElement('script');sc.src='./agenda-polish.js?v=2';sc.defer=true;sc.dataset.agendaPolish='1';document.head.appendChild(sc)}
 css();inject();
 $('teamSelect')?.addEventListener('change',()=>{filterGuid='';setTimeout(()=>render(true),60)});
 setTimeout(()=>render(false),220);
});
})();
