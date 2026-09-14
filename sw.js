const CACHE='basketball-agenda-v67';
const DATA_CACHE='basketball-foys-data-v1';
const SHELL=['./','./index.html','./styles.css?v=3','./club.css?v=2','./all-teams.js?v=5','./app.js?v=3','./ui-state-v2.js?v=5','./match-rules-v1.js?v=2','./admin-email-guard-v1.js?v=1','./club-v6.js?v=1','./admin-agenda-v4.js?v=1','./club-members-admin.js?v=8','./feed.js?v=6','./played-match-report-v1.js?v=4','./argon-ui.js?v=7','./presence-ui-v5.js?v=5','./training-manager-v7.js?v=1','./trainer-driving-v1.js?v=3','./agenda-polish-v4.js?v=1','./manifest.webmanifest','./data/tasks.json'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&key!==DATA_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.hostname==='api.foys.io'){
  event.respondWith((async()=>{
   const cache=await caches.open(DATA_CACHE),cached=await cache.match(event.request),network=fetch(event.request).then(response=>{if(response.ok)cache.put(event.request,response.clone()).catch(()=>{});return response});
   if(cached){event.waitUntil(network.catch(()=>{}));return cached}
   try{return await network}catch(error){const fallback=await cache.match(event.request);if(fallback)return fallback;throw error}
  })());return;
 }
 if(url.origin!==location.origin)return;
 event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
});