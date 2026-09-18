const CACHE='basketball-agenda-v99';
const DATA_CACHE='basketball-foys-data-v1';
const SHELL=['./','./index.html','./styles.css?v=3','./club.css?v=2','./all-teams.js?v=5','./live-task-source-v1.js?v=1','./app.js?v=4','./ui-state-v2.js?v=5','./match-rules-v1.js?v=2','./admin-email-guard-v1.js?v=1','./club-v6.js?v=2','./admin-agenda-v4.js?v=1','./staff-task-edit-v1.js?v=2','./task-import-parsers-v1.js?v=4','./task-import-engine-v1.js?v=4','./task-import-ui-v2.js?v=3','./club-members-admin.js?v=9','./one-time-member-audit-v1.js?v=5','./foys-member-review-v2.js?v=6','./member-onboarding-v1.js?v=3','./feed.js?v=6','./feed-team-players-v1.js?v=9','./feed-points-display-v1.js?v=1','./played-match-report-v1.js?v=8','./argon-ui.js?v=7','./presence-ui-v5.js?v=5','./training-manager-v7.js?v=2','./trainer-driving-v1.js?v=3','./agenda-polish-v4.js?v=3','./trainer-agenda-labels-v1.js?v=1','./training-attendance-v1.js?v=1','./member-change-notifications-v1.js?v=2','./task-detail-v1.js?v=1','./task-change-labels-v1.js?v=2','./manifest.webmanifest','./data/tasks.json'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&key!==DATA_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.hostname==='api.foys.io'){
  if(url.searchParams.get('_notification')==='1'){
   event.respondWith(fetch(event.request,{cache:'no-store'}));return;
  }
  event.respondWith((async()=>{
   const cache=await caches.open(DATA_CACHE),cached=await cache.match(event.request),network=fetch(event.request).then(response=>{if(response.ok)cache.put(event.request,response.clone()).catch(()=>{});return response});
   if(cached){event.waitUntil(network.catch(()=>{}));return cached}
   try{return await network}catch(error){const fallback=await cache.match(event.request);if(fallback)return fallback;throw error}
  })());return;
 }
 if(url.origin!==location.origin)return;
 event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
});