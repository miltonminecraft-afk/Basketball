(()=>{
'use strict';

const U='https://elpnfmlrkoemjrnzaeok.supabase.co';
const K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
const FED='52cfa65e-9782-4a81-ab35-e2f981fcb7a9';
const ARGON='a4a2e2fa-0635-46a5-8969-1d0fef40444f';
const API='https://api.foys.io/competition/public-api/v1';
const STORE='basketballApp.selection.v3';

let sb=null,ctxCache=null,ctxAt=0,presenceBusy=false,presenceTimer=0,countBusy=false,countTimer=0,headerBusy=false;
const matchCache=new Map();
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const cssq=v=>String(v??'').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
const norm=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const d=v=>String(v||'').slice(0,10),t=v=>String(v||'').slice(0,5);

function season(){const n=new Date(),y=n.getMonth()>=6?n.getFullYear():n.getFullYear()-1;return{start:`${y}-07-01`,end:`${y+1}-06-30`}}
function selection(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}}
function label(m,side){return [m?.[`${side}TeamSponsorClubName`]||m?.[`${side}Organisation`]?.name,m?.[`${side}TeamName`]||m?.[`${side}Team`]?.name].filter(Boolean).join(' ').trim()||'Onbekend team'}
function guid(m,side){return String(m?.[`${side}TeamGuid`]||m?.[`${side}Team`]?.guid||'')}
function shortDate(v){try{return new Intl.DateTimeFormat('nl-NL',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${d(v)}T12:00:00`))}catch{return d(v)}}
function toast(msg){const el=$('toast');if(!el)return alert(msg);el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2400)}

async function client(){
  if(sb)return sb;
  const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});
  sb.auth.onAuthStateChange(()=>{ctxCache=null;ctxAt=0;matchCache.clear();schedulePresence(true);scheduleCounts(120)});
  return sb;
}
async function context(force=false){
  if(!force&&ctxCache&&Date.now()-ctxAt<10000)return ctxCache;
  const s=await client(),{data:{session}}=await s.auth.getSession();
  if(!session){ctxCache=null;ctxAt=Date.now();return null}
  const {data:member,error}=await s.rpc('sync_current_member');
  if(error||!member?.active){ctxCache=null;ctxAt=Date.now();return null}
  const [players,trainers,all]=await Promise.all([
    s.from('member_teams').select('team_id,teams(id,team_name,foy_team_guid)').eq('member_id',member.id),
    s.from('member_trainer_teams').select('team_id,teams(id,team_name,foy_team_guid)').eq('member_id',member.id),
    s.from('teams').select('id,team_name,foy_team_guid').eq('active',true).order('team_name')
  ]);
  if(players.error||trainers.error||all.error)throw players.error||trainers.error||all.error;
  const mapRows=r=>(r.data||[]).map(x=>x.teams?{...x.teams,id:x.team_id}:null).filter(Boolean);
  const playerTeams=mapRows(players),rawTrainerTeams=mapRows(trainers),allTeams=(all.data||[]).filter(x=>x.foy_team_guid&&norm(x.team_name)!=='alleteams');
  const trainerAll=rawTrainerTeams.some(x=>norm(x.team_name)==='alleteams');
  const trainerTeams=trainerAll?allTeams:rawTrainerTeams.filter(x=>x.foy_team_guid);
  ctxCache={member,playerTeams,trainerTeams,trainerAll,allTeams};ctxAt=Date.now();return ctxCache;
}
async function teamMatches(teamGuid){
  if(!teamGuid||matchCache.has(teamGuid))return matchCache.get(teamGuid)||[];
  const q=season(),all=[];let skip=0,total=Infinity;
  while(skip<total){
    const p=new URLSearchParams({startDate:q.start,endDate:q.end,teamGuid,skipCount:String(skip),maxResultCount:'100',sorting:'date asc, startTime asc'});
    const r=await fetch(`${API}/matches?${p}`,{headers:{Accept:'application/json','X-FederationID':FED},cache:'no-store'});if(!r.ok)break;
    const j=await r.json(),rows=Array.isArray(j?.items)?j.items:[];all.push(...rows);total=Number(j?.totalCount)||rows.length;skip+=rows.length;if(!rows.length||rows.length<100)break;
  }
  matchCache.set(teamGuid,all);return all;
}
function isAwayForTeam(m,team){const tg=String(team.foy_team_guid||'');if(tg&&guid(m,'away'))return guid(m,'away')===tg;return norm(label(m,'away')).includes(norm(team.team_name))}
async function matchCounts(ids){
  if(!ids.length)return new Map();
  const s=await client(),{data,error}=await s.rpc('get_match_presence_counts',{p_match_ids:ids.map(Number)});if(error)throw error;
  return new Map((data||[]).map(x=>[String(x.foy_match_id),{players:Number(x.player_count)||0,cars:Number(x.car_count)||0}]));
}

function injectCss(){
  if($('presenceUiV5Css'))return;
  const s=document.createElement('style');s.id='presenceUiV5Css';s.textContent=`
    .brand-mark.has-team-logo{background:#fff!important;padding:3px!important;overflow:hidden}
    .brand-mark.has-team-logo img{display:block;width:100%;height:100%;object-fit:contain;border-radius:7px}
    .player-count{display:none!important}
    .personal-presence-card .attendance-choice{margin-top:8px;display:flex;gap:6px;flex-wrap:wrap}
    .personal-presence-card .mini-button.selected{box-shadow:0 0 0 2px var(--navy) inset}
    .personal-presence-card .drive-button.selected{background:var(--orange);color:#fff}
    .presence-counts{font-weight:850!important;color:var(--navy)!important}
    #agendaList article.event[data-match-id] .meta::after,#gamesList article.event[data-match-id] .meta::after{content:" · Spelers: … · Auto's: …";font-weight:850;color:var(--navy)}
  `;document.head.appendChild(s);
  const r=document.createElement('style');r.id='matchPresenceCountRules';document.head.appendChild(r);
}
async function refreshCountRules(){
  if(countBusy)return;
  const cards=[...document.querySelectorAll('#agendaList article.event[data-match-id],#gamesList article.event[data-match-id]')];
  const ids=[...new Set(cards.map(c=>Number(c.dataset.matchId)).filter(Number.isFinite))];
  if(!ids.length)return;
  countBusy=true;
  try{
    const counts=await matchCounts(ids),rules=[];
    for(const id of ids){
      const c=counts.get(String(id))||{players:0,cars:0},text=` · Spelers: ${c.players} · Auto's: ${c.cars}`.replace(/\\/g,'\\\\').replace(/"/g,'\\"');
      rules.push(`#agendaList article.event[data-match-id="${cssq(id)}"] .meta::after,#gamesList article.event[data-match-id="${cssq(id)}"] .meta::after{content:"${text}"}`);
    }
    const style=$('matchPresenceCountRules');if(style)style.textContent=rules.join('\n');
  }catch(e){console.warn('Speler/autotelling kon niet worden geladen',e)}finally{countBusy=false}
}
function scheduleCounts(delay=60){clearTimeout(countTimer);countTimer=setTimeout(refreshCountRules,delay)}

async function applyHeaderLogo(){
  if(headerBusy)return;const mark=document.querySelector('.brand-mark');if(!mark)return;headerBusy=true;
  try{
    let src='';const sel=selection();if(sel&&!String(sel.teamGuid||'').startsWith('all-'))src=sel.teamLogo||'';if(!src)src=sel?.clubLogo||'';
    try{const r=await fetch(`${API}/organisations/${ARGON}/teams`,{headers:{Accept:'application/json','X-FederationID':FED},cache:'no-store'});if(r.ok){const rows=(await r.json())||[],real=(Array.isArray(rows)?rows:[]).filter(x=>x?.guid&&!String(x.guid).startsWith('all-'));if(sel&&!String(sel.teamGuid||'').startsWith('all-'))src=real.find(x=>String(x.guid)===String(sel.teamGuid))?.logoUrl||src;else src=real.find(x=>x.logoUrl)?.logoUrl||src}}catch{}
    if(src){const current=mark.querySelector('img')?.getAttribute('src')||'';if(current!==src){mark.classList.add('has-team-logo');mark.innerHTML=`<img src="${esc(src)}" alt="SV Argon">`}}else if(mark.classList.contains('has-team-logo')){mark.classList.remove('has-team-logo');mark.textContent='●'}
  }finally{headerBusy=false}
}

async function renderPresence(force=false){
  const target=$('club-sub-presence');if(!target)return;if(!target.classList.contains('active')&&!force)return;if(presenceBusy)return;presenceBusy=true;
  try{
    const c=await context(force);if(!c){target.innerHTML='';return}
    const byId=new Map(),today=new Date().toISOString().slice(0,10),playerIds=new Set(c.playerTeams.map(x=>String(x.id))),trainerIds=new Set(c.trainerTeams.map(x=>String(x.id))),union=new Map();
    for(const tm of [...c.playerTeams,...c.trainerTeams])if(tm?.foy_team_guid&&!union.has(String(tm.id)))union.set(String(tm.id),tm);
    for(const tm of union.values())for(const m of await teamMatches(tm.foy_team_guid)){
      if(d(m.date)<today)continue;const h=guid(m,'home'),a=guid(m,'away'),tg=String(tm.foy_team_guid||'');if(tg&&h!==tg&&a!==tg)continue;
      const key=String(m.id),prev=byId.get(key),entry=prev||{m,team:tm,isPlayer:false,isTrainer:false};entry.isPlayer=entry.isPlayer||playerIds.has(String(tm.id));entry.isTrainer=entry.isTrainer||trainerIds.has(String(tm.id));if(!prev||entry.isPlayer)entry.team=tm;byId.set(key,entry);
    }
    const rows=[...byId.values()].sort((a,b)=>`${d(a.m.date)}T${t(a.m.startTime)}`.localeCompare(`${d(b.m.date)}T${t(b.m.startTime)}`)),s=await client();
    const [{data:attendance,error:ae},counts]=await Promise.all([s.from('attendance').select('foy_match_id,attending,driving,team_id').eq('member_id',c.member.id),matchCounts(rows.map(x=>Number(x.m.id)))]);if(ae)throw ae;
    const am=new Map((attendance||[]).map(x=>[String(x.foy_match_id),x]));
    target.innerHTML=`<div class="club-card-panel personal-presence-card"><h2>Aanwezigheid</h2><p>Ja/Nee geldt voor jouw speler- en trainerteams. Bij uitwedstrijden is Ik rijd dezelfde registratie als in de Agenda.</p><div class="club-list">${rows.length?rows.map(({m,team,isPlayer,isTrainer})=>{
      const v=am.get(String(m.id)),away=isAwayForTeam(m,team),cnt=counts.get(String(m.id))||{players:0,cars:0};
      const yesNo=(isPlayer||isTrainer)?`<button class="mini-button yes ${v?.attending===true?'selected':''}" data-presence-att="yes" data-match="${esc(m.id)}" data-team="${esc(team.id)}">Ja</button><button class="mini-button no ${v?.attending===false?'selected':''}" data-presence-att="no" data-match="${esc(m.id)}" data-team="${esc(team.id)}">Nee</button>`:'';
      const drive=away&&(isPlayer||isTrainer)?`<button class="mini-button drive-button ${v?.driving===true?'selected':''}" data-presence-drive data-match="${esc(m.id)}" data-team="${esc(team.id)}">${v?.driving===true?'Ik rijd ✓':'Ik rijd'}</button>`:'';
      return `<div class="club-row"><strong>${esc(label(m,'home'))} — ${esc(label(m,'away'))}</strong><small>${esc(shortDate(m.date))} · ${esc(t(m.startTime))} · ${esc(m.accommodationName||'')}</small><small class="presence-counts">Spelers: ${cnt.players} · Auto's: ${cnt.cars}</small><div class="attendance-choice">${yesNo}${drive}</div></div>`;
    }).join(''):'<div class="club-empty">Geen komende wedstrijden voor jouw speler- of trainerteam(s).</div>'}</div></div>`;
    target.querySelectorAll('[data-presence-att]').forEach(b=>b.onclick=async()=>{
      const yes=b.dataset.presenceAtt==='yes',old=am.get(String(b.dataset.match));const {error}=await s.rpc('set_match_attendance',{p_match_id:Number(b.dataset.match),p_team_id:b.dataset.team,p_attending:yes,p_driving:yes&&old?.driving===true});if(error)return toast(error.message);
      toast(yes?'Aanwezig: Ja':'Aanwezig: Nee');document.dispatchEvent(new CustomEvent('basketball-attendance-changed',{detail:{matchId:Number(b.dataset.match)}}));await renderPresence(true);scheduleCounts(20);
    });
    target.querySelectorAll('[data-presence-drive]').forEach(b=>b.onclick=async()=>{
      const old=am.get(String(b.dataset.match)),next=old?.driving!==true,attending=next?true:old?.attending===true;
      const {error}=await s.rpc('set_match_attendance',{p_match_id:Number(b.dataset.match),p_team_id:b.dataset.team,p_attending:attending,p_driving:next});if(error)return toast(error.message);
      toast(next?'Ik rijd':'Rijden uitgeschakeld');document.dispatchEvent(new CustomEvent('basketball-attendance-changed',{detail:{matchId:Number(b.dataset.match)}}));await renderPresence(true);scheduleCounts(20);
    });
  }catch(e){console.warn('Aanwezigheid kon niet worden geladen',e);target.innerHTML='<div class="club-card-panel personal-presence-card"><h2>Aanwezigheid</h2><div class="club-empty">Aanwezigheid kon niet worden geladen.</div></div>'}finally{presenceBusy=false}
}
function schedulePresence(force=false){clearTimeout(presenceTimer);presenceTimer=setTimeout(()=>renderPresence(force),60)}

function init(){
  injectCss();applyHeaderLogo();scheduleCounts(350);schedulePresence(false);
  document.addEventListener('basketball-club-rendered',()=>schedulePresence(false));
  document.addEventListener('basketball-club-view-changed',e=>{if(e.detail?.view==='presence')schedulePresence(true)});
  document.addEventListener('basketball-attendance-changed',()=>{schedulePresence(true);scheduleCounts(20)});
  document.addEventListener('basketball-agenda-polished',()=>scheduleCounts(20));
  $('teamSelect')?.addEventListener('change',()=>{ctxCache=null;ctxAt=0;matchCache.clear();setTimeout(applyHeaderLogo,120);scheduleCounts(900)});
  $('syncBtn')?.addEventListener('click',()=>scheduleCounts(1200));
  document.addEventListener('click',e=>{if(e.target.closest?.('.tab[data-view="agenda"],.tab[data-view="games"]'))scheduleCounts(60)},true);
  setTimeout(scheduleCounts,1400);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();