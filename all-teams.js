(()=>{
'use strict';
const FED='52cfa65e-9782-4a81-ab35-e2f981fcb7a9';
const API='https://api.foys.io/competition/public-api/v1';
const originalFetch=window.fetch.bind(window);
const teamCache=new Map();
let freshUntil=0;
const allId=id=>`all-${id}`;
const clubFromAll=v=>String(v||'').startsWith('all-')?String(v).slice(4):'';
function saved(guid){try{const r=JSON.parse(localStorage.getItem(`basketballApp.matches.v3.${guid}`)||'null');return Array.isArray(r?.matches)?r.matches:null}catch{return null}}
function save(guid,rows){try{localStorage.setItem(`basketballApp.matches.v3.${guid}`,JSON.stringify({updatedAt:Date.now(),matches:rows}))}catch{}}
function response(data,source){const h=new Headers(source?.headers||{});h.set('Content-Type','application/json; charset=utf-8');return new Response(JSON.stringify(data),{status:200,headers:h})}
async function teams(clubId){if(teamCache.has(clubId))return teamCache.get(clubId);const r=await originalFetch(`${API}/organisations/${encodeURIComponent(clubId)}/teams`,{headers:{Accept:'application/json','X-FederationID':FED},cache:'no-store'});if(!r.ok)throw new Error('Teams ophalen mislukt');const rows=(await r.json()).filter(x=>x?.guid);teamCache.set(clubId,rows);return rows}
async function teamMatches(guid,base,init){const rows=[];let skip=0,total=Infinity;while(skip<total){const u=new URL(base.href);u.searchParams.set('teamGuid',guid);u.searchParams.set('skipCount',String(skip));u.searchParams.set('maxResultCount','100');const r=await originalFetch(u.href,{...init,cache:'no-store'});if(!r.ok)break;const j=await r.json(),part=j.items||[];rows.push(...part);total=Number(j.totalCount)||part.length;skip+=part.length;if(!part.length||part.length<100)break}return rows}
async function clubMatches(clubId,base,init){const ts=await teams(clubId),byId=new Map();await Promise.all(ts.map(async t=>(await teamMatches(t.guid,base,init)).forEach(m=>byId.set(String(m.id),m))));const items=[...byId.values()].sort((a,b)=>`${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));return{items,totalCount:items.length}}
window.fetch=async(input,init={})=>{
 const req=input instanceof Request?input:null,raw=req?req.url:String(input);let u;try{u=new URL(raw,location.href)}catch{return originalFetch(input,init)}
 if(u.hostname!=='api.foys.io')return originalFetch(input,init);
 const path=u.pathname,teamMatch=path.match(/\/competition\/public-api\/v1\/organisations\/([^/]+)\/teams$/);
 if(teamMatch){const r=await originalFetch(input,init);if(!r.ok)return r;const real=(await r.clone().json()).filter(x=>x?.guid&&!String(x.guid).startsWith('all-'));const clubId=decodeURIComponent(teamMatch[1]);teamCache.set(clubId,real);const first=real[0]||{};return response([{id:null,guid:allId(clubId),name:'Alle teams',organisationName:first.organisationName||first.organisation?.name||'Vereniging',logoUrl:first.logoUrl||''},...real],r)}
 if(path.endsWith('/competition/public-api/v1/matches')){const guid=u.searchParams.get('teamGuid')||'',skip=Number(u.searchParams.get('skipCount')||0),cache=skip===0&&Date.now()>freshUntil?saved(guid):null;if(cache){const club=clubFromAll(guid);if(club)clubMatches(club,u,init).then(x=>save(guid,x.items)).catch(()=>{});else originalFetch(input,init).then(r=>r.ok?r.clone().json():null).then(j=>{if(Array.isArray(j?.items))save(guid,j.items)}).catch(()=>{});return response({items:cache,totalCount:cache.length})}const club=clubFromAll(guid);if(club){const data=await clubMatches(club,u,init);save(guid,data.items);return response(data)}const r=await originalFetch(input,init);if(r.ok&&skip===0)r.clone().json().then(j=>{if(Array.isArray(j?.items))save(guid,j.items)}).catch(()=>{});return r}
 return originalFetch(input,init);
};
document.addEventListener('click',e=>{if(e.target?.closest?.('#syncBtn'))freshUntil=Date.now()+15000},true);
})();