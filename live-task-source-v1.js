(()=>{
'use strict';
const U='https://elpnfmlrkoemjrnzaeok.supabase.co';
const K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
const nativeFetch=window.fetch.bind(window);
let sb=null,cache=null,cacheAt=0;
const tm=v=>String(v||'').slice(0,5);
async function client(){
 if(sb)return sb;
 const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
 sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});
 sb.auth.onAuthStateChange(()=>{cache=null;cacheAt=0});
 return sb;
}
function changeSummary(changes){
 const out=[];
 const names={event_date:'Datum',arrival_time:'Aanwezig',start_time:'Start',location:'Sporthal',field:'Veld',referees:'Scheidsrechter',table:'Tafel'};
 for(const [k,v] of Object.entries(changes||{})){
  const from=Array.isArray(v?.from)?v.from.join(', '):String(v?.from??'');
  const to=Array.isArray(v?.to)?v.to.join(', '):String(v?.to??'');
  out.push({field:names[k]||k,from,to});
 }
 return out;
}
async function getLive(){
 if(cache&&Date.now()-cacheAt<5000)return cache;
 const s=await client(),{data:{session}}=await s.auth.getSession();
 if(!session)return null;
 const [evr,impr]=await Promise.all([
  s.from('task_events').select('*,task_assignments(*)').eq('active',true).order('event_date').order('start_time'),
  s.from('task_schedule_imports').select('id,source_name,created_at').order('created_at',{ascending:false}).limit(1).maybeSingle()
 ]);
 if(evr.error)throw evr.error;
 let changeMap=new Map();
 if(impr.data?.id){
  const {data:ch,error}=await s.from('task_schedule_changes').select('task_event_id,change_type,changes').eq('import_id',impr.data.id);
  if(!error)changeMap=new Map((ch||[]).filter(x=>x.task_event_id).map(x=>[String(x.task_event_id),x]));
 }
 const tasks=(evr.data||[]).map(e=>{
  const as=(e.task_assignments||[]).slice().sort((a,b)=>(a.role||'').localeCompare(b.role||'')||a.slot-b.slot);
  const ch=changeMap.get(String(e.id));
  return{
   id:e.legacy_id||`event-${e.id}`,
   taskEventId:e.id,
   foyMatchId:e.foy_match_id||null,
   date:String(e.event_date||'').slice(0,10),
   arrivalTime:tm(e.arrival_time),
   startTime:tm(e.start_time),
   home:e.home||'',
   away:e.away||'',
   field:e.field||'',
   location:e.location||'',
   referees:as.filter(a=>a.role==='referee').map(a=>a.assigned_name).filter(Boolean),
   table:as.filter(a=>a.role==='table').map(a=>a.assigned_name).filter(Boolean),
   changed:!!ch,
   changeType:ch?.change_type||'',
   changes:changeSummary(ch?.changes||{})
  };
 });
 cache={version:2,source:impr.data?.source_name||'Live takenschema',updatedAt:impr.data?.created_at||null,tasks};cacheAt=Date.now();
 return cache;
}
function isTasksRequest(input){
 try{
  const raw=typeof input==='string'?input:input?.url;
  if(!raw)return false;
  const u=new URL(raw,location.href);
  return u.origin===location.origin&&/\/data\/tasks\.json$/.test(u.pathname);
 }catch{return false}
}
window.fetch=async function(input,init){
 if(!isTasksRequest(input))return nativeFetch(input,init);
 try{
  const live=await getLive();
  if(live)return new Response(JSON.stringify(live),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 }catch(e){console.warn('Live takenschema niet beschikbaar, statische fallback wordt gebruikt.',e)}
 return nativeFetch(input,{...init,cache:'no-store'});
};
document.addEventListener('task-schedule-imported',()=>{cache=null;cacheAt=0});
})();