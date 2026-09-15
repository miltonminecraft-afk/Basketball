(()=>{
'use strict';
const U='https://elpnfmlrkoemjrnzaeok.supabase.co',K='sb_publishable_GPzLwaKeevg3e8CNjw9oAQ_50NW2xlg',FED='52cfa65e-9782-4a81-ab35-e2f981fcb7a9',ARGON='a4a2e2fa-0635-46a5-8969-1d0fef40444f',API='https://api.foys.io/competition/public-api/v1';
const d=v=>String(v||'').slice(0,10),t=v=>String(v||'').slice(0,5);
const norm=v=>window.BasketballTaskImportParsers?.norm?.(v)||String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const externalName=v=>/^(ouders?|inhuur|jury|nnb|ntb|vacature)\b/i.test(String(v||'').trim());
let sb=null;
const state={file:null,rows:[],matches:[],teams:[],members:[],events:[],resolved:[],missing:[],removed:[],busy:false};
async function client(){if(sb)return sb;const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');sb=mod.createClient(U,K,{auth:{persistSession:true,detectSessionInUrl:true,autoRefreshToken:true}});return sb}
function season(){const n=new Date(),y=n.getMonth()>=6?n.getFullYear():n.getFullYear()-1;return{start:`${y}-07-01`,end:`${y+1}-06-30`}}
function label(m,s){return [m?.[`${s}TeamSponsorClubName`]||m?.[`${s}Organisation`]?.name,m?.[`${s}TeamName`]||m?.[`${s}Team`]?.name].filter(Boolean).join(' ').trim()}
function teamGuid(m,s){return String(m?.[`${s}TeamGuid`]||m?.[`${s}Team`]?.guid||'')}
function side(home,away){if(norm(home).startsWith('svargon'))return'home';if(norm(away).startsWith('svargon'))return'away';return''}
function pairKey(h,a){return`${norm(h)}|${norm(a)}`}
function sameName(a,b){return norm(a)===norm(b)}
function memberForName(name){
 const raw=String(name||'').trim();let hit=state.members.find(m=>sameName(m.full_name,raw));if(hit)return hit;
 if(/\/[a-z]\d+$/i.test(raw)){const base=raw.replace(/\/[a-z]\d+$/i,'').trim();hit=state.members.find(m=>sameName(m.full_name,base))}
 return hit||null;
}
function canonicalName(name){return memberForName(name)?.full_name||String(name||'').trim()}
function softScore(row,m){
 let s=0;if(d(row.date)===d(m.date))s+=4;if(t(row.startTime)===t(m.startTime))s+=2;
 const rl=norm(row.location),ml=norm(m.accommodationName);if(rl&&ml&&(rl===ml||rl.includes(ml)||ml.includes(rl)))s++;
 const rf=norm(row.field),mf=norm(m.fieldName);if(rf&&mf&&rf===mf)s++;return s;
}
function teamForRow(row,match){
 const sd=side(row.home,row.away),guid=match?teamGuid(match,sd):'',byGuid=state.teams.find(x=>String(x.foy_team_guid||'')===guid);if(byGuid)return byGuid;
 const arg=sd==='home'?row.home:row.away,stripped=norm(arg).replace(/^svargon/,'');return state.teams.find(x=>norm(x.team_name)===stripped)||null;
}
function assignments(event,role){return(event?.task_assignments||[]).filter(a=>a.role===role).sort((a,b)=>a.slot-b.slot).map(a=>a.assigned_name)}
function compare(row,event){
 if(!event)return{new:true};const c={},chk=(k,a,b)=>{if(String(a??'')!==String(b??''))c[k]={from:a??'',to:b??''}};
 chk('event_date',d(event.event_date),d(row.date));chk('arrival_time',t(event.arrival_time),t(row.arrivalTime));chk('start_time',t(event.start_time),t(row.startTime));chk('location',event.location||'',row.location||'');chk('field',event.field||'',row.field||'');
 const oldR=assignments(event,'referee').map(canonicalName),newR=row.referees.map(canonicalName),oldT=assignments(event,'table').map(canonicalName),newT=row.table.map(canonicalName);
 if(JSON.stringify(oldR.map(norm))!==JSON.stringify(newR.map(norm)))c.referees={from:oldR,to:newR};
 if(JSON.stringify(oldT.map(norm))!==JSON.stringify(newT.map(norm)))c.table={from:oldT,to:newT};
 return c;
}
function resolveRow(row,index){
 const sd=side(row.home,row.away),candidates=state.matches.filter(m=>sd&&norm(label(m,'home'))===norm(row.home)&&norm(label(m,'away'))===norm(row.away));
 let match=null,ambiguous=[];
 if(candidates.length===1)match=candidates[0];
 else if(candidates.length>1){const scored=candidates.map(m=>({m,s:softScore(row,m)})).sort((a,b)=>b.s-a.s);if(scored.length===1||scored[0].s>scored[1].s)match=scored[0].m;else ambiguous=scored.map(x=>x.m)}
 let event=match?state.events.find(e=>String(e.foy_match_id||'')===String(match.id))||null:null;
 if(!event){const byPair=state.events.filter(e=>pairKey(e.home,e.away)===pairKey(row.home,row.away));if(byPair.length===1)event=byPair[0];else if(byPair.length>1){const scored=byPair.map(e=>({e,s:(d(e.event_date)===d(row.date)?4:0)+(t(e.start_time)===t(row.startTime)?2:0)+(norm(e.location)===norm(row.location)?1:0)})).sort((a,b)=>b.s-a.s);if(scored.length===1||scored[0].s>scored[1].s)event=scored[0].e}}
 const team=teamForRow(row,match);return{index,row,match,ambiguous,event,team,changes:compare(row,event)};
}
function recompute(){
 state.resolved=state.rows.map(resolveRow);
 const names=[...new Set(state.rows.flatMap(r=>[...r.referees,...r.table]).map(x=>String(x||'').trim()).filter(Boolean))];
 state.missing=names.filter(n=>!externalName(n)&&!memberForName(n));
 const imported=new Set(state.resolved.map(x=>x.event?.id).filter(Boolean)),teams=new Set(state.resolved.map(x=>x.team?.id).filter(Boolean)),dates=state.rows.map(r=>d(r.date)).filter(Boolean).sort(),min=dates[0]||'',max=dates.at(-1)||'';
 state.removed=state.events.filter(e=>e.active!==false&&teams.has(e.team_id)&&!imported.has(e.id)&&(!min||d(e.event_date)>=min)&&(!max||d(e.event_date)<=max));
 return state;
}
async function loadData(){
 const s=await client(),{data:{session}}=await s.auth.getSession();if(!session)throw Error('Niet ingelogd.');
 const {data:me,error:meErr}=await s.rpc('sync_current_member');if(meErr)throw meErr;if(me?.role!=='admin')throw Error('Alleen admins mogen importeren.');
 const [tr,mr,er]=await Promise.all([s.from('teams').select('*').eq('active',true),s.from('members').select('id,full_name,email,active').eq('active',true),s.from('task_events').select('*,task_assignments(*)').eq('active',true)]);
 for(const r of [tr,mr,er])if(r.error)throw r.error;state.teams=tr.data||[];state.members=mr.data||[];state.events=er.data||[];
 const q=season(),all=[];let skip=0,total=Infinity;
 while(skip<total){const p=new URLSearchParams({startDate:q.start,endDate:q.end,teamGuid:`all-${ARGON}`,skipCount:String(skip),maxResultCount:'100',sorting:'date asc, startTime asc'}),r=await fetch(`${API}/matches?${p}`,{headers:{Accept:'application/json','X-FederationID':FED},cache:'no-store'});if(!r.ok)throw Error('Basketball.nl-wedstrijden konden niet worden opgehaald.');const j=await r.json(),part=Array.isArray(j?.items)?j.items:[];all.push(...part);total=Number(j?.totalCount)||part.length;skip+=part.length;if(!part.length||part.length<100)break}
 state.matches=all;return state;
}
function chooseMatch(index,id){const row=state.resolved[index];if(!row)return;row.match=state.matches.find(x=>String(x.id)===String(id))||null;row.ambiguous=row.match?[]:row.ambiguous;return recompute()}
async function apply(createMembers){
 if(state.busy)return;state.busy=true;
 try{
  if(state.resolved.some(x=>x.ambiguous.length&&!x.match))throw Error('Kies eerst de onduidelijke wedstrijden.');
  const rows=state.resolved.map(x=>({event_id:x.event?.id||null,team_id:x.team?.id||null,foy_match_id:x.match?.id||x.event?.foy_match_id||null,event_date:x.row.date,arrival_time:x.row.arrivalTime,start_time:x.row.startTime,home:x.row.home,away:x.row.away,location:x.row.location,field:x.row.field,referees:x.row.referees.map(canonicalName),table:x.row.table.map(canonicalName),changes:x.changes}));
  const s=await client(),{data,error}=await s.rpc('apply_task_schedule_import',{p_source_name:state.file?.name||'Takenschema',p_source_type:state.file?.name?.split('.').pop()?.toLowerCase()||'',p_rows:rows,p_create_members:createMembers||[],p_removed_event_ids:state.removed.map(x=>x.id)});
  if(error)throw error;return data;
 }finally{state.busy=false}
}
window.BasketballTaskImportEngine={state,loadData,recompute,chooseMatch,apply,canonicalName,formatMatch:m=>`${d(m.date)} ${t(m.startTime)} · ${label(m,'home')} — ${label(m,'away')}`};
})();