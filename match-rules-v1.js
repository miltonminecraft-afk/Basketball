(()=>{
'use strict';

const FED='52cfa65e-9782-4a81-ab35-e2f981fcb7a9';
const ARGON='a4a2e2fa-0635-46a5-8969-1d0fef40444f';
const API='https://api.foys.io/competition/public-api/v1';
const CACHE_PREFIX='basketballApp.matches.v3.';
const STORE='basketballApp.selection.v3';

const memory=new Map();
let argonGuids=null,argonGuidsPromise=null,activeToken=0;

const d=v=>String(v||'').slice(0,10);
const norm=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const guid=(m,side)=>String(m?.[`${side}TeamGuid`]||m?.[`${side}Team`]?.guid||'');
const clubName=(m,side)=>String(m?.[`${side}TeamSponsorClubName`]||m?.[`${side}Organisation`]?.name||m?.[`${side}ClubName`]||'').trim();

function season(){
  const n=new Date(),y=n.getMonth()>=6?n.getFullYear():n.getFullYear()-1;
  return{start:`${y}-07-01`,end:`${y+1}-06-30`};
}
function hasResult(m){
  if(!m)return false;
  const status=norm(m.status);
  if(['final','played','finished','completed','eindstand','gespeeld'].includes(status))return true;
  return m.homeScore!==null&&m.homeScore!==undefined&&m.awayScore!==null&&m.awayScore!==undefined;
}
function isPlayed(m){return hasResult(m)}

function cachedMatch(id){
  const key=String(id);
  if(memory.has(key))return memory.get(key);
  for(let i=0;i<localStorage.length;i++){
    const storageKey=localStorage.key(i);
    if(!storageKey?.startsWith(CACHE_PREFIX))continue;
    try{
      const rows=JSON.parse(localStorage.getItem(storageKey)||'{}')?.matches||[];
      const hit=rows.find(x=>String(x?.id)===key);
      if(hit){memory.set(key,hit);return hit}
    }catch{}
  }
  return null;
}
function selectedGuid(){
  try{
    const row=JSON.parse(localStorage.getItem(STORE)||'null');
    return String(row?.teamGuid||'');
  }catch{return''}
}
async function fetchMatches(teamGuid){
  if(!teamGuid)return[];
  const q=season(),out=[];let skip=0,total=Infinity;
  while(skip<total){
    const p=new URLSearchParams({startDate:q.start,endDate:q.end,teamGuid,skipCount:String(skip),maxResultCount:'100',sorting:'date asc, startTime asc'});
    const r=await fetch(`${API}/matches?${p}`,{headers:{Accept:'application/json','X-FederationID':FED},cache:'no-store'});
    if(!r.ok)break;
    const j=await r.json(),rows=Array.isArray(j?.items)?j.items:[];
    rows.forEach(m=>memory.set(String(m.id),m));
    out.push(...rows);total=Number(j?.totalCount)||rows.length;skip+=rows.length;
    if(!rows.length||rows.length<100)break;
  }
  return out;
}
async function matchById(id){
  const key=String(id||'');if(!key)return null;
  let hit=cachedMatch(key);if(hit)return hit;
  const selected=selectedGuid();
  if(selected){hit=(await fetchMatches(selected)).find(x=>String(x.id)===key);if(hit)return hit}
  hit=(await fetchMatches(`all-${ARGON}`)).find(x=>String(x.id)===key);
  return hit||cachedMatch(key);
}
async function loadArgonGuids(){
  if(argonGuids)return argonGuids;
  if(argonGuidsPromise)return argonGuidsPromise;
  argonGuidsPromise=(async()=>{
    const set=new Set();
    try{
      const r=await fetch(`${API}/organisations/${ARGON}/teams`,{headers:{Accept:'application/json','X-FederationID':FED},cache:'no-store'});
      if(r.ok){
        const rows=await r.json();
        for(const team of Array.isArray(rows)?rows:[])if(team?.guid&&!String(team.guid).startsWith('all-'))set.add(String(team.guid));
      }
    }catch{}
    argonGuids=set;return set;
  })();
  return argonGuidsPromise;
}
async function argonSide(m){
  if(!m)return'';
  const guids=await loadArgonGuids(),homeGuid=guid(m,'home'),awayGuid=guid(m,'away');
  if(homeGuid&&guids.has(homeGuid))return'home';
  if(awayGuid&&guids.has(awayGuid))return'away';
  const home=norm(clubName(m,'home')),away=norm(clubName(m,'away'));
  if(home==='svargon'||home.startsWith('svargon'))return'home';
  if(away==='svargon'||away.startsWith('svargon'))return'away';
  return'';
}
async function classify(m){
  const side=await argonSide(m);
  return{played:isPlayed(m),side,away:side==='away',home:side==='home'};
}

function injectCss(){
  if(document.getElementById('centralMatchRulesCss'))return;
  const style=document.createElement('style');style.id='centralMatchRulesCss';
  style.textContent=`#matchDetailOverlay .drive-toggle{display:none!important}#matchDetailOverlay.match-drive-allowed .drive-toggle{display:flex!important}#matchDetailOverlay.match-presence-closed #matchDetailBody .match-detail-section:has(.presence-segment),#matchDetailOverlay.match-presence-closed #matchDetailBody .attendees-section,#matchDetailOverlay.match-presence-closed #matchDetailBody .drivers-list{display:none!important}`;
  document.head.appendChild(style);
}
function presenceSection(){
  const body=document.getElementById('matchDetailBody');if(!body)return null;
  return [...body.querySelectorAll('.match-detail-section')].find(section=>norm(section.querySelector('h3')?.textContent)==='mijnwedstrijd')||null;
}
async function enforceDetail(matchId,token){
  const match=await matchById(matchId);if(token!==activeToken||!match)return;
  const state=await classify(match);if(token!==activeToken)return;
  const apply=()=>{
    if(token!==activeToken)return false;
    const overlay=document.getElementById('matchDetailOverlay');
    if(!overlay||overlay.hidden)return false;
    overlay.classList.toggle('match-drive-allowed',!state.played&&state.away);
    overlay.classList.toggle('match-presence-closed',state.played);
    if(state.played){
      presenceSection()?.remove();
      document.querySelector('#matchDetailBody .attendees-section')?.remove();
      document.querySelector('#matchDetailBody .drivers-list')?.remove();
    }else if(!state.away){
      document.querySelector('#matchDetailBody .drivers-list')?.remove();
    }
    return true;
  };
  let tries=0;
  const run=()=>{if(token!==activeToken)return;apply();if(++tries<24)setTimeout(run,50)};
  run();
}

async function enforceClubPresence(){
  const rows=[...document.querySelectorAll('.personal-presence-card .club-row')];
  for(const row of rows){
    const source=row.querySelector('[data-match]');
    const id=row.dataset.matchRuleId||source?.dataset.match||'';
    if(!id)continue;
    row.dataset.matchRuleId=id;
    const match=await matchById(id);if(!match)continue;
    const state=await classify(match);
    const actions=row.querySelector('.attendance-choice');
    if(state.played){actions?.remove();continue}
    if(!state.away)row.querySelector('[data-presence-drive]')?.remove();
  }
}
function scheduleClubEnforcement(){
  [80,240,650].forEach(delay=>setTimeout(()=>enforceClubPresence().catch(console.warn),delay));
}

function init(){
  injectCss();
  document.addEventListener('click',event=>{
    const card=event.target.closest?.('article.event[data-match-id]');
    if(!card)return;
    const id=Number(card.dataset.matchId);if(!Number.isFinite(id))return;
    const token=++activeToken;
    const overlay=document.getElementById('matchDetailOverlay');if(overlay){overlay.classList.remove('match-drive-allowed');overlay.classList.remove('match-presence-closed')}
    enforceDetail(id,token).catch(console.warn);
  },true);
  document.addEventListener('basketball-club-rendered',scheduleClubEnforcement);
  document.addEventListener('basketball-club-view-changed',event=>{if(event.detail?.view==='presence')scheduleClubEnforcement()});
  document.addEventListener('basketball-attendance-changed',scheduleClubEnforcement);
}

window.BasketballMatchRules={hasResult,isPlayed,matchById,argonSide,classify};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
