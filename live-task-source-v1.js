(()=>{
'use strict';
const U='https://elpnfmlrkoemjrnzaeok.supabase.co';
const K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg';
const nativeFetch=window.fetch.bind(window);
let sb=null,cache=null,cacheAt=0;
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
 const s=await client(),{data,error}=await s.rpc('get_current_task_schedule');
 if(error)throw error;
 const live=data&&typeof data==='object'?data:null;
 if(!live)return null;
 live.tasks=(Array.isArray(live.tasks)?live.tasks:[]).map(task=>({...task,changes:changeSummary(task.rawChanges||{})}));
 cache=live;cacheAt=Date.now();return cache;
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