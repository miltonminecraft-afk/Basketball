(()=>{
'use strict';

const U='https://elpnfmlrkoemjrnzaeok.supabase.co';
const K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
const FED='52cfa65e-9782-4a81-ab35-e2f981fcb7a9';
const ARGON='a4a2e2fa-0635-46a5-8969-1d0fef40444f';
const API='https://api.foys.io/competition/public-api/v1';
const REPORT_API='https://elpnfmlrkoemjrnzaeok.supabase.co/functions/v1/foys-match-detail';
const STORE='basketballApp.selection.v3';

let sb=null,ctxCache=null,ctxAt=0,presenceBusy=false,presenceTimer=0,countBusy=false,countQueued=false,countTimer=0,headerBusy=false;
const matchCache=new Map(),countCache=new Map(),playedCountCache=new Map();
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const norm=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const d=v=>String(v||'').slice(0,10),t=v=>String(v||'').slice(0,5);

function season(){const n=new Date(),y=n.getMonth()>=6?n.getFullYear():n.getFullYear()-1;return{start:`${y}-07-01`,end:`${y+1}-06-30`}}
function selection(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}}
function label(m,side){return [m?.[`${side}TeamSponsorClubName`]||m?.[`${side}Organisation`]?.name,m?.[`${side}TeamName`]||m?.[`${side}Team`]?.name].filter(Boolean).join(' ').trim()||'Onbekend team'}
function guid(m,side){return String(m?.[`${side}TeamGuid`]||m?.[`${side}Team`]?.guid||'')}
function shortDate(v){try{return new Intl.DateTimeFormat('nl-NL',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${d(v)}T12:00:00`))}catch{return d(v)}}
function addressText(m){
  const a=m?.address;if(!a)return'';
  const street=[a.address1,a.houseNumber,a.houseNumberExtension].filter(Boolean).join(' ');
  const city=[a.zipCode,a.city].filter(Boolean).join(' ');
  return[street,city].filter(Boolean).join(', ');
}
function mapsHref(m){
  const address=addressText(m),query=[m?.accommodationName,address].filter(Boolean).join(', ');
  return query?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`:'';
}
function toast(msg){const el=$('toast');if(!el)return alert(msg);el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2400)}

async function client(){
  if(sb)return sb;
  const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});
  sb.auth.onAuthStateChange(()=>{ctxCache=null;ctxAt=0;matchCache.clear();countCache.clear();playedCountCache.clear();schedulePresence(true);scheduleCounts(120)});
  return sb;
}
async function context(force=false){
  if(!force&&ctxCache&&Date.now()-ctxAt<10000)return ctxCache;
  const s=await client(),{data:{session}}=await s.auth.getSession();
  if(!session){ctxCache=null;ctxAt=Date.now();return null}
  const {data:member,error}=await s.rpc('sync_current_member');
  if(error||!member?.active)return null;
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
async function stableCounts(ids){
  const keys=[...new Set(ids.map(Number).filter(Number.isFinite))];
  if(!keys.length)return new Map();
  try{
    const fresh=await matchCounts(keys);
    for(const id of keys){const key=String(id);countCache.set(key,fresh.get(key)||{players:0,cars:0})}
  }catch(e){console.warn('Speler/autotelling kon niet worden geladen; laatst bekende telling blijft staan',e)}
  return new Map(keys.map(id=>[String(id),countCache.get(String(id))]).filter(([,v])=>!!v));
}
async function resolveMatch(id){
  const key=String(id||'');if(!key)return null;
  if(window.BasketballMatchRules?.matchById){
    try{const hit=await window.BasketballMatchRules.matchById(key);if(hit)return hit}catch{}
  }
  for(const rows of matchCache.values()){
    const hit=rows.find(x=>String(x?.id)===key);if(hit)return hit;
  }
  return null;
}
async function isAwayMatch(m){
  if(!m)return false;
  if(window.BasketballMatchRules?.argonSide){
    try{return (await window.BasketballMatchRules.argonSide(m))==='away'}catch{}
  }
  const home=norm(label(m,'home')),away=norm(label(m,'away'));
  if(home.startsWith('svargon'))return false;
  if(away.startsWith('svargon'))return true;
  return false;
}

function injectCss(){
  if($('presenceUiV5Css'))return;
  const s=document.createElement('style');s.id='presenceUiV5Css';s.textContent=`
    .brand-mark.has-team-logo{background:#fff!important;padding:3px!important;overflow:hidden}
    .brand-mark.has-team-logo img{display:block;width:100%;height:100%;object-fit:contain;border-radius:7px}
    .player-count{display:none!important}
    .presence-inline-count{font-weight:850;color:var(--navy)}
    .personal-presence-card .attendance-choice{margin-top:8px;display:flex;gap:6px;flex-wrap:wrap}
    .personal-presence-card .mini-button.selected{box-shadow:0 0 0 2px var(--navy) inset}
    .personal-presence-card .drive-button.selected{background:var(--orange);color:#fff}
    .presence-counts{font-weight:850!important;color:var(--navy)!important}
  `;document.head.appendChild(s);
}
function isPlayedMatch(card,m){
  if(m?.homeScore!==null&&m?.homeScore!==undefined&&m?.awayScore!==null&&m?.awayScore!==undefined)return true;
  if(String(m?.status||'').toLowerCase()==='final')return true;
  return !!card?.querySelector('.badge-final,.score-line,.final-score')||/\b(Uitslag|EINDSTAND)\b/i.test(card?.textContent||'');
}
function argonSideFromCard(card,m,away){
  if(m)return away?'away':'home';
  const sides=[...card.querySelectorAll('.agenda-team-side')];
  if(sides.length>=2){
    if(norm(sides[0].textContent).startsWith('svargon'))return'home';
    if(norm(sides[1].textContent).startsWith('svargon'))return'away';
  }
  const parts=String(card.querySelector('.match-title')?.textContent||'').split(/\s+[—–]\s+/);
  if(parts.length>=2){
    if(norm(parts[0]).startsWith('svargon'))return'home';
    if(norm(parts[1]).startsWith('svargon'))return'away';
  }
  return'';
}
async function bondPlayedCount(id,side){
  const key=`${id}|${side}`;
  if(playedCountCache.has(key))return playedCountCache.get(key);
  if(!/^\d+$/.test(String(id||''))||!side)return null;
  try{
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6200);
    const r=await fetch(`${REPORT_API}?matchId=${encodeURIComponent(id)}`,{cache:'no-store',signal:ctrl.signal});
    clearTimeout(timer);
    if(!r.ok)throw new Error('Wedstrijdspelers niet beschikbaar');
    const j=await r.json(),rows=Array.isArray(j?.players)?j.players.filter(p=>p&&p.side===side&&p.name):[];
    if(!rows.length){playedCountCache.set(key,null);return null}
    const unique=new Set(rows.map(p=>`${p.side||''}|${p.number||''}|${norm(p.name)}`));
    const count=unique.size||null;playedCountCache.set(key,count);return count;
  }catch(e){
    console.warn('Bondspelers voor gespeelde wedstrijd niet beschikbaar',e);
    return null;
  }
}
function formatCardMeta(card,m,countText,kind){
  const meta=card.querySelector('.meta');if(!meta)return;
  if(!m){
    meta.querySelector('.presence-inline-count')?.remove();
    if(countText){
      const span=document.createElement('span');span.className='presence-inline-count';span.textContent=` · ${countText}`;
      const br=meta.querySelector('br');if(br)meta.insertBefore(span,br);else meta.appendChild(span);
    }
    return;
  }
  const location=[m.accommodationName,m.fieldName].filter(Boolean).join(' · ')||'Locatie nog niet bekend';
  const address=addressText(m),href=mapsHref(m),signature=`${location}|${address}|${href}|${kind}|${countText||''}`;
  if(meta.dataset.presenceMetaSignature===signature)return;
  meta.replaceChildren(document.createTextNode(location));
  if(countText){
    const span=document.createElement('span');span.className='presence-inline-count';span.textContent=` · ${countText}`;meta.appendChild(span);
  }
  if(address){
    meta.appendChild(document.createElement('br'));
    meta.appendChild(document.createTextNode(address));
    if(href){
      meta.appendChild(document.createTextNode(' · '));
      const link=document.createElement('a');link.className='match-maps-link';link.href=href;link.target='_blank';link.rel='noopener';link.textContent='Maps';meta.appendChild(link);
    }
  }
  meta.dataset.presenceMetaSignature=signature;
}
async function refreshCountRules(){
  if(countBusy){countQueued=true;return}
  const cards=[...document.querySelectorAll('#agendaList article.event[data-match-id],#gamesList article.event[data-match-id]')];
  if(!cards.length)return;
  countBusy=true;
  try{
    const resolved=await Promise.all(cards.map(async card=>{
      const match=await resolveMatch(card.dataset.matchId),away=match?await isAwayMatch(match):false;
      return{card,match,away,played:isPlayedMatch(card,match)};
    }));
    const futureIds=[...new Set(resolved.filter(x=>!x.played).map(x=>Number(x.card.dataset.matchId)).filter(Number.isFinite))];
    const counts=await stableCounts(futureIds);
    await Promise.all(resolved.map(async({card,match,away,played})=>{
      if(played){
        const side=argonSideFromCard(card,match,away),players=await bondPlayedCount(card.dataset.matchId,side);
        formatCardMeta(card,match,players===null?'':`Spelers: ${players}`,'played');
        return;
      }
      const cnt=counts.get(String(card.dataset.matchId));
      if(!cnt){formatCardMeta(card,match,'','future');return}
      const text=away?`Spelers: ${cnt.players} · Auto's: ${cnt.cars}`:`Spelers: ${cnt.players}`;
      formatCardMeta(card,match,text,away?'future-away':'future-home');
    }));
  }finally{
    countBusy=false;
    if(countQueued){countQueued=false;scheduleCounts(20)}
  }
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
    const byId=new Map(),today=new Date().toISOString().slice(0,10);
    const playerIds=new Set(c.playerTeams.map(x=>String(x.id))),trainerIds=new Set(c.trainerTeams.map(x=>String(x.id))),union=new Map();
    for(const tm of [...c.playerTeams,...c.trainerTeams])if(tm?.foy_team_guid&&!union.has(String(tm.id)))union.set(String(tm.id),tm);
    for(const tm of union.values()){
      const isPlayer=playerIds.has(String(tm.id)),isTrainer=trainerIds.has(String(tm.id));
      for(const m of await teamMatches(tm.foy_team_guid)){
        if(d(m.date)<today)continue;
        const h=guid(m,'home'),a=guid(m,'away'),tg=String(tm.foy_team_guid||'');if(tg&&h!==tg&&a!==tg)continue;
        const away=isAwayForTeam(m,tm);
        if(!isPlayer&&(!isTrainer||!away))continue;
        const key=String(m.id),prev=byId.get(key);
        if(!prev){byId.set(key,{m,team:tm,isPlayer,isTrainer,away});continue}
        prev.isPlayer=prev.isPlayer||isPlayer;prev.isTrainer=prev.isTrainer||isTrainer;
        if(isPlayer){prev.team=tm;prev.away=away}
      }
    }
    const rows=[...byId.values()].sort((a,b)=>`${d(a.m.date)}T${t(a.m.startTime)}`.localeCompare(`${d(b.m.date)}T${t(b.m.startTime)}`)),s=await client();
    const [{data:attendance,error:ae},counts]=await Promise.all([s.from('attendance').select('foy_match_id,attending,driving,team_id').eq('member_id',c.member.id),stableCounts(rows.map(x=>Number(x.m.id)))]);if(ae)throw ae;
    const am=new Map((attendance||[]).map(x=>[String(x.foy_match_id),x]));
    target.innerHTML=`<div class="club-card-panel personal-presence-card"><h2>Aanwezigheid</h2><p>Ja/Nee geldt alleen voor jouw spelerteam(s). Bij uitwedstrijden kun je als speler of trainer aangeven dat je rijdt.</p><div class="club-list">${rows.length?rows.map(({m,team,isPlayer,isTrainer,away})=>{
      const v=am.get(String(m.id)),cnt=counts.get(String(m.id))||{players:'…',cars:'…'};
      const yesNo=isPlayer?`<button class="mini-button yes ${v?.attending===true?'selected':''}" data-presence-att="yes" data-match="${esc(m.id)}" data-team="${esc(team.id)}" data-away="${away?'1':'0'}">Ja</button><button class="mini-button no ${v?.attending===false?'selected':''}" data-presence-att="no" data-match="${esc(m.id)}" data-team="${esc(team.id)}" data-away="${away?'1':'0'}">Nee</button>`:'';
      const drive=away&&(isPlayer||isTrainer)?`<button class="mini-button drive-button ${v?.driving===true?'selected':''}" data-presence-drive data-match="${esc(m.id)}" data-team="${esc(team.id)}" data-player="${isPlayer?'1':'0'}">${v?.driving===true?'Ik rijd ✓':'Ik rijd'}</button>`:'';
      const countText=away?`Spelers: ${cnt.players} · Auto's: ${cnt.cars}`:`Spelers: ${cnt.players}`;
      return `<div class="club-row"><strong>${esc(label(m,'home'))} — ${esc(label(m,'away'))}</strong><small>${esc(shortDate(m.date))} · ${esc(t(m.startTime))} · ${esc(m.accommodationName||'')}</small><small class="presence-counts">${countText}</small><div class="attendance-choice">${yesNo}${drive}</div></div>`;
    }).join(''):'<div class="club-empty">Geen komende wedstrijden voor jouw spelerteam(s) of trainer-uitwedstrijden.</div>'}</div></div>`;
    target.querySelectorAll('[data-presence-att]').forEach(b=>b.onclick=async()=>{
      const yes=b.dataset.presenceAtt==='yes',old=am.get(String(b.dataset.match)),away=b.dataset.away==='1';
      const {error}=await s.rpc('set_match_attendance',{p_match_id:Number(b.dataset.match),p_team_id:b.dataset.team,p_attending:yes,p_driving:yes&&away&&old?.driving===true});if(error)return toast(error.message);
      toast(yes?'Aanwezig: Ja':'Aanwezig: Nee');document.dispatchEvent(new CustomEvent('basketball-attendance-changed',{detail:{matchId:Number(b.dataset.match)}}));await renderPresence(true);scheduleCounts(20);
    });
    target.querySelectorAll('[data-presence-drive]').forEach(b=>b.onclick=async()=>{
      const old=am.get(String(b.dataset.match)),next=old?.driving!==true,isPlayer=b.dataset.player==='1';
      const attending=isPlayer?(next?true:old?.attending===true):false;
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