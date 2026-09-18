(()=>{
'use strict';

const FED='52cfa65e-9782-4a81-ab35-e2f981fcb7a9';
const ARGON='a4a2e2fa-0635-46a5-8969-1d0fef40444f';
const API='https://api.foys.io/competition/public-api/v1';
const STATS_API='https://elpnfmlrkoemjrnzaeok.supabase.co/functions/v1/foys-team-stats';
const SB_URL='https://elpnfmlrkoemjrnzaeok.supabase.co';
const SB_KEY='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
const ALL_SYNC_KEY='basketball.foysAllTeamStatsSync.v2';

const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const teamStatsCache=new Map();
let teamsPromise=null,summaryObserver=null,visibilityClient=null,allSyncPromise=null,currentOpenTeam=null;

function injectCss(){
 if(document.getElementById('feedTeamPlayersCssV1'))return;
 const s=document.createElement('style');s.id='feedTeamPlayersCssV1';s.textContent=`
 .feed-standing-item.feed-standing-clickable{cursor:pointer;transition:background .12s ease,border-color .12s ease}
 .feed-standing-item.feed-standing-clickable:focus-visible{outline:2px solid var(--orange);outline-offset:2px}
 @media(hover:hover) and (pointer:fine){.feed-standing-item.feed-standing-clickable:hover{background:#f8f8fb}}
 .feed-team-players-overlay[hidden]{display:none!important}
 .feed-team-players-overlay{position:fixed;inset:0;z-index:1600;background:rgba(5,6,56,.48);display:flex;align-items:flex-end;justify-content:center;padding:20px 0 0}
 .feed-team-players-sheet{width:min(100%,680px);max-height:min(82vh,760px);overflow:auto;background:var(--card);border-radius:28px 28px 0 0;padding:20px 22px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(5,6,56,.16)}
 .feed-team-players-head{display:flex;align-items:center;gap:10px;margin-bottom:15px}
 .feed-team-players-logo{width:38px;height:38px;object-fit:contain;flex:0 0 38px;border-radius:8px;background:#fff}
 .feed-team-players-titlewrap{min-width:0;flex:1}
 .feed-team-players-title{margin:0;color:var(--navy);font-size:18px;font-weight:950;line-height:1.1}
 .feed-team-players-sub{display:block;margin-top:3px;color:var(--muted);font-size:10px;font-weight:750}
 .feed-team-players-close{width:44px;height:44px;border:0;border-radius:50%;background:#f1f2f6;color:var(--navy);font-size:28px;line-height:1;display:grid;place-items:center;flex:0 0 44px}
 .feed-team-players-list{border-top:1px solid var(--line)}
 .feed-team-player-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:7px;align-items:center;min-height:42px;padding:7px 1px;border-bottom:1px solid var(--line)}
 .feed-team-player-number{color:var(--muted);font-size:10px;font-weight:900;white-space:nowrap}
 .feed-team-player-name{min-width:0;color:var(--navy);font-size:11px;font-weight:850;line-height:1.18;overflow-wrap:anywhere}
 .feed-team-player-points{color:var(--navy);font-size:10.5px;font-weight:950;white-space:nowrap;text-align:right}
 .feed-team-player-up{display:inline-block;margin-left:5px;padding:2px 5px;border-radius:999px;background:#f2f3f7;color:var(--muted);font-size:7.5px;font-weight:900;vertical-align:1px;white-space:nowrap}
 .feed-team-players-note{margin:10px 0 0;color:var(--muted);font-size:9px;line-height:1.35}
 .feed-team-players-loading,.feed-team-players-error{padding:22px 0;color:var(--muted);font-size:11px;text-align:center}
 body.feed-team-players-open{overflow:hidden}
 @media(min-width:700px){.feed-team-players-overlay{align-items:center;padding:20px}.feed-team-players-sheet{border-radius:24px;max-height:min(80vh,760px)}}
 `;document.head.appendChild(s);
}

async function loadTeams(){
 if(teamsPromise)return teamsPromise;
 teamsPromise=(async()=>{
  const r=await fetch(`${API}/organisations/${ARGON}/teams`,{cache:'no-store',headers:{Accept:'application/json','X-FederationID':FED}});
  if(!r.ok)throw new Error('Teams konden niet worden geladen.');
  const rows=await r.json();
  return (Array.isArray(rows)?rows:[]).filter(x=>x?.guid&&!String(x.guid).startsWith('all-'));
 })();
 try{return await teamsPromise}catch(e){teamsPromise=null;throw e}
}

function ensureOverlay(){
 let overlay=document.getElementById('feedTeamPlayersOverlay');
 if(overlay)return overlay;
 overlay=document.createElement('div');overlay.id='feedTeamPlayersOverlay';overlay.className='feed-team-players-overlay';overlay.hidden=true;
 overlay.innerHTML=`<div class="feed-team-players-sheet" role="dialog" aria-modal="true" aria-labelledby="feedTeamPlayersTitle"><div id="feedTeamPlayersContent"></div></div>`;
 document.body.appendChild(overlay);
 overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('[data-feed-team-close]'))closeOverlay()});
 return overlay;
}
function closeOverlay(){const overlay=document.getElementById('feedTeamPlayersOverlay');if(overlay)overlay.hidden=true;currentOpenTeam=null;document.body.classList.remove('feed-team-players-open')}
function teamHeader(team,data,players){
 const logo=data?.team?.logoUrl||team?.logoUrl||'';
 const registered=(players||[]).filter(p=>p?.registered!==false).length;
 const guests=(players||[]).filter(p=>p?.registered===false&&p?.playedForTeam).length;
 const countText=guests?registered+' spelers · '+guests+' meegespeeld':registered+' spelers';
 return `<div class="feed-team-players-head">${logo?`<img class="feed-team-players-logo" src="${esc(logo)}" alt="">`:''}<div class="feed-team-players-titlewrap"><h2 class="feed-team-players-title" id="feedTeamPlayersTitle">SV Argon ${esc(data?.team?.name||team?.name||'Team')}</h2><span class="feed-team-players-sub">Seizoen ${esc(data?.seasonLabel||'')} · ${esc(countText)}</span></div><button class="feed-team-players-close" type="button" data-feed-team-close aria-label="Sluiten">×</button></div>`;
}
function pointsLabel(p){
 const points=Number(p?.points)||0;
 if(p?.pointsComplete===false)return points>0?`≥ ${points} pnt`:'-';
 return `${points} pnt`;
}

async function withVisiblePrivateNames(data){
 const ids=[...(data?.players||[]),...(data?.staff||[])].filter(x=>String(x?.name||x?.displayName||'').trim().toLowerCase()==='private').map(x=>String(x?.personId||'')).filter(Boolean);
 if(!ids.length)return data;
 try{
  if(!visibilityClient){
   const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
   visibilityClient=mod.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});
  }
  const session=await visibilityClient.auth.getSession();if(!session.data.session)return data;
  const r=await visibilityClient.rpc('get_visible_foys_member_names',{p_person_ids:ids});if(r.error||!r.data)return data;
  const map=r.data||{};
  return{
   ...data,
   players:(data?.players||[]).map(p=>String(p?.name||'').trim().toLowerCase()==='private'&&map[p.personId]?{...p,name:map[p.personId]}:p),
   staff:(data?.staff||[]).map(s=>String(s?.displayName||'').trim().toLowerCase()==='private'&&map[s.personId]?{...s,displayName:map[s.personId]}:s)
  };
 }catch{return data}
}
async function syncAllTeamStats(force=false){
 if(allSyncPromise)return allSyncPromise;
 if(!force){
  const last=Number(localStorage.getItem(ALL_SYNC_KEY)||0);
  if(last&&Date.now()-last<6*60*60*1000)return null;
 }
 allSyncPromise=(async()=>{
  try{
   const r=await fetch(STATS_API+'?teamGuid=all&refresh=1',{cache:'no-store'}),data=await r.json();
   if(!r.ok||data?.error)throw new Error(data?.error||'Teamgegevens synchroniseren mislukt.');
   localStorage.setItem(ALL_SYNC_KEY,String(Date.now()));
   teamStatsCache.clear();
   document.dispatchEvent(new CustomEvent('basketball-team-stats-synced',{detail:data}));
   return data;
  }catch(e){console.warn('Alle teamstatistieken synchroniseren',e);return null}
  finally{allSyncPromise=null}
 })();
 return allSyncPromise;
}

function renderTeam(team,data){
 const host=document.getElementById('feedTeamPlayersContent');if(!host)return;
 const staff=Array.isArray(data?.staff)?data.staff:[],pureStaffIds=new Set(staff.filter(s=>!s?.playingCoach).map(s=>String(s?.personId||''))),playingCoachIds=new Set(staff.filter(s=>s?.playingCoach).map(s=>String(s?.personId||''))),players=(Array.isArray(data?.players)?data.players:[]).filter(p=>!pureStaffIds.has(String(p?.personId||'')));
 const staffRows=staff.map(s=>{const p=s?.playingCoach?players.find(x=>String(x?.personId||'')===String(s?.personId||'')):null;return `<div class="feed-team-player-row"><span class="feed-team-player-number">${s?.playingCoach?'Coach/speler':'Coach'}</span><span class="feed-team-player-name">${esc(s?.displayName||s?.name||'private')}</span><span class="feed-team-player-points">${p?esc(pointsLabel(p)):''}</span></div>`}).join('');
 const playerRows=players.filter(p=>!playingCoachIds.has(String(p?.personId||''))).map(p=>`<div class="feed-team-player-row"><span class="feed-team-player-number">${p?.number?`#${esc(p.number)}`:''}</span><span class="feed-team-player-name">${esc(p?.name||'private')}${p?.registered===false&&p?.playedForTeam?'<span class="feed-team-player-up">meegespeeld</span>':''}</span><span class="feed-team-player-points">${esc(pointsLabel(p))}</span></div>`).join('');
 const rows=staffRows+playerRows;
 const incomplete=Number(data?.playedMatches||0)>Number(data?.matchesWithCompletePoints||0);
 host.innerHTML=`${teamHeader(team,data,players)}${(staff.length||players.length)?`<div class="feed-team-players-list">${rows}</div>`:'<div class="feed-team-players-loading">Geen spelers gevonden.</div>'}${incomplete?'<p class="feed-team-players-note">≥ = minimaal bekend totaal · - = punten onbekend.</p>':''}`;
}
async function openTeam(team){
 const overlay=ensureOverlay(),host=document.getElementById('feedTeamPlayersContent');if(!host)return;
 currentOpenTeam=team;overlay.hidden=false;document.body.classList.add('feed-team-players-open');
 const fallback=teamStatsCache.get(String(team.guid))||null;
 host.innerHTML=`<div class="feed-team-players-head">${team.logoUrl?`<img class="feed-team-players-logo" src="${esc(team.logoUrl)}" alt="">`:''}<div class="feed-team-players-titlewrap"><h2 class="feed-team-players-title" id="feedTeamPlayersTitle">SV Argon ${esc(team.name)}</h2><span class="feed-team-players-sub">Actuele spelers en punten laden…</span></div><button class="feed-team-players-close" type="button" data-feed-team-close aria-label="Sluiten">×</button></div><div class="feed-team-players-loading">Teamgegevens uit database laden…</div>`;
 try{
  const r=await fetch(`${STATS_API}?teamGuid=${encodeURIComponent(team.guid)}&_=${Date.now()}`,{cache:'no-store'});
  const raw=await r.json();
  if(!r.ok||raw?.error)throw new Error(raw?.error||'Teamstatistieken konden niet worden geladen.');
  const data=await withVisiblePrivateNames(raw);
  teamStatsCache.set(String(team.guid),data);
  if(!overlay.hidden&&String(currentOpenTeam?.guid||'')===String(team.guid))renderTeam(team,data);
 }catch(e){
  if(fallback&&String(currentOpenTeam?.guid||'')===String(team.guid)){
   const data=await withVisiblePrivateNames(fallback);
   if(!overlay.hidden)renderTeam(team,data);
   return;
  }
  if(!overlay.hidden&&String(currentOpenTeam?.guid||'')===String(team.guid))host.innerHTML=`<div class="feed-team-players-head"><div class="feed-team-players-titlewrap"><h2 class="feed-team-players-title" id="feedTeamPlayersTitle">SV Argon ${esc(team.name)}</h2></div><button class="feed-team-players-close" type="button" data-feed-team-close aria-label="Sluiten">×</button></div><div class="feed-team-players-error">${esc(e?.message||'Teamstatistieken konden niet worden geladen.')}</div>`;
 }
}

async function wireRows(){
 const host=document.getElementById('feedSummary');if(!host)return;
 let teams=[];try{teams=await loadTeams()}catch{return}
 for(const row of host.querySelectorAll('.feed-standing-item')){
  if(row.dataset.feedTeamStatsWired==='1')continue;
  const label=String(row.querySelector('.feed-standing-name')?.textContent||'').trim();
  const team=teams.find(t=>norm(`SV Argon ${t.name}`)===norm(label));if(!team)continue;
  row.dataset.feedTeamStatsWired='1';row.dataset.feedTeamGuid=team.guid;row.classList.add('feed-standing-clickable');row.setAttribute('role','button');row.setAttribute('tabindex','0');row.setAttribute('aria-label',`Spelers van SV Argon ${team.name} bekijken`);
  row.addEventListener('click',()=>openTeam(team));
  row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openTeam(team)}});
 }
}
function observeSummary(){
 const host=document.getElementById('feedSummary');if(!host)return;
 summaryObserver?.disconnect();summaryObserver=new MutationObserver(()=>wireRows());summaryObserver.observe(host,{childList:true,subtree:true});wireRows();
}
function markUnknownMatchPoints(){
 for(const row of document.querySelectorAll('#matchDetailOverlay .played-players .played-player-row')){
  if(row.querySelector('.played-player-points'))continue;
  const span=document.createElement('span');span.className='played-player-points';span.textContent='—';span.title='Individuele punten zijn voor deze wedstrijd niet volledig openbaar.';row.appendChild(span);
 }
}
function observeMatchPoints(){const observer=new MutationObserver(markUnknownMatchPoints);observer.observe(document.body,{childList:true,subtree:true});markUnknownMatchPoints()}
function init(){
 injectCss();ensureOverlay();observeSummary();observeMatchPoints();
 document.getElementById('syncBtn')?.addEventListener('click',()=>{teamStatsCache.clear();syncAllTeamStats(true)});
 document.addEventListener('basketball-team-stats-synced',()=>{const t=currentOpenTeam;if(!t)return;teamStatsCache.delete(String(t.guid));openTeam(t)});
 setTimeout(()=>syncAllTeamStats(false),2400);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('feedTeamPlayersOverlay')?.hidden)closeOverlay()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
