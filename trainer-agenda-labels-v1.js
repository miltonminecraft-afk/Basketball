(()=>{
'use strict';
const SUPABASE_URL='https://elpnfmlrkoemjrnzaeok.supabase.co';
const SUPABASE_KEY='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
const STORE='basketballApp.selection.v3';
const CACHE_PREFIX='basketballApp.matches.v3.';
const $=id=>document.getElementById(id);
let sb=null,ctx=null,ctxAt=0,busy=false,timer=null;
function selection(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}}
function teamGuid(match,side){return String(match?.[`${side}TeamGuid`]||match?.[`${side}Team`]?.guid||'')}
function isAllGuid(guid){return String(guid||'').startsWith('all-')}
function isAllTeam(team){return isAllGuid(team?.foy_team_guid)||String(team?.team_name||'').trim().toLowerCase()==='alle teams'}
async function client(){
 if(sb)return sb;
 const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
 sb=mod.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});
 sb.auth.onAuthStateChange(()=>{ctx=null;ctxAt=0;schedule(true,80)});
 return sb;
}
async function context(force=false){
 if(!force&&ctx&&Date.now()-ctxAt<30000)return ctx;
 const s=await client(),{data:{session}}=await s.auth.getSession();
 if(!session){ctx={trainerTeams:[],slots:[]};ctxAt=Date.now();return ctx}
 const{data:member}=await s.rpc('sync_current_member');
 if(!member?.active){ctx={trainerTeams:[],slots:[]};ctxAt=Date.now();return ctx}
 const[trainerRows,slotRows]=await Promise.all([
  s.from('member_trainer_teams').select('team_id,teams(id,team_name,foy_team_guid)').eq('member_id',member.id),
  s.from('training_slots').select('id,team_id').eq('active',true)
 ]);
 ctx={
  trainerTeams:(trainerRows.data||[]).map(x=>x.teams?{...x.teams,id:x.team_id}:null).filter(Boolean),
  slots:slotRows.data||[]
 };
 ctxAt=Date.now();
 return ctx;
}
function matchMap(){
 const map=new Map();
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);
  if(!key?.startsWith(CACHE_PREFIX))continue;
  try{for(const m of JSON.parse(localStorage.getItem(key)||'{}')?.matches||[])map.set(String(m.id),m)}catch{}
 }
 return map;
}
function injectCss(){
 if($('trainerAgendaLabelsCss'))return;
 const style=document.createElement('style');
 style.id='trainerAgendaLabelsCss';
 style.textContent=`
#agendaList article.event.trainer-role-card{position:relative}
#agendaList article.event.trainer-role-card .event-main{padding-right:66px}
#agendaList .trainer-role-label{position:absolute;top:13px;right:14px;z-index:2;display:inline-flex;align-items:center;justify-content:center;min-height:24px;padding:4px 9px;border-radius:999px;background:#eef1ff;color:#050638;font-size:11px;font-weight:800;line-height:1;white-space:nowrap;box-sizing:border-box}
@media(max-width:420px){#agendaList article.event.trainer-role-card .event-main{padding-right:58px}#agendaList .trainer-role-label{right:10px;padding:4px 7px;font-size:10px}}
`;
 document.head.appendChild(style);
}
function clearLabels(){
 document.querySelectorAll('#agendaList .trainer-role-label').forEach(x=>x.remove());
 document.querySelectorAll('#agendaList article.trainer-role-card').forEach(x=>x.classList.remove('trainer-role-card'));
}
function addLabel(card,text){
 if(!card)return;
 card.querySelector('.trainer-role-label')?.remove();
 card.classList.add('trainer-role-card');
 const badge=document.createElement('span');
 badge.className='trainer-role-label';
 badge.textContent=text;
 badge.setAttribute('aria-label',text);
 card.appendChild(badge);
}
async function apply(force=false){
 if(busy)return;
 busy=true;
 try{
  injectCss();clearLabels();
  const c=await context(force),sel=selection();
  if(!sel?.teamGuid||!c.trainerTeams.length)return;
  const allSelected=isAllGuid(sel.teamGuid);
  const trainerAll=c.trainerTeams.some(isAllTeam);
  const trainerGuids=new Set(c.trainerTeams.map(x=>String(x.foy_team_guid||'')).filter(g=>g&&!isAllGuid(g)));
  const trainerIds=new Set(c.trainerTeams.map(x=>String(x.id||'')).filter(Boolean));
  const selectedIsTrainer=trainerAll||trainerGuids.has(String(sel.teamGuid));
  const map=matchMap();
  for(const card of document.querySelectorAll('#agendaList article.event[data-match-id]')){
   const match=map.get(String(card.dataset.matchId));
   let coached=false;
   if(allSelected){
    coached=trainerAll||!!(match&&(trainerGuids.has(teamGuid(match,'home'))||trainerGuids.has(teamGuid(match,'away'))));
   }else{
    coached=selectedIsTrainer;
   }
   if(coached)addLabel(card,'Coach');
  }
  const slotMap=new Map(c.slots.map(x=>[String(x.id),String(x.team_id||'')]));
  for(const card of document.querySelectorAll('#agendaList article.agenda-training[data-training-slot]')){
   const slotTeamId=slotMap.get(String(card.dataset.trainingSlot))||'';
   const trained=allSelected?(trainerAll||trainerIds.has(slotTeamId)):selectedIsTrainer;
   if(trained)addLabel(card,'Trainer');
  }
 }catch(e){console.warn('Trainerlabels konden niet worden bijgewerkt',e)}finally{busy=false}
}
function schedule(force=false,delay=80){clearTimeout(timer);timer=setTimeout(()=>apply(force),delay)}
function init(){
 injectCss();
 document.addEventListener('basketball-agenda-polished',()=>schedule(false,20));
 document.addEventListener('basketball-team-data-rendered',()=>schedule(false,40));
 document.addEventListener('basketball-team-selection-changing',clearLabels);
 document.addEventListener('training-data-changed',()=>{ctx=null;ctxAt=0;schedule(true,80)});
 $('personSelect')?.addEventListener('change',()=>schedule(false,80));
 schedule(true,700);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
