const CACHE='basketball-agenda-v39';
const DATA_CACHE='basketball-foys-data-v1';
const SHELL=['./','./index.html','./styles.css?v=3','./club.css?v=2','./all-teams.js?v=5','./app.js?v=3','./club.js?v=3','./admin-agenda-v2.js?v=3','./club-members-admin.js?v=6','./feed.js?v=6','./argon-ui.js?v=5','./final-fixes.js?v=4','./all-teams-v2.js?v=4','./admin-structure-fix.js?v=1','./agenda-polish.js?v=3','./ux-v3.js?v=2','./manifest.webmanifest','./data/tasks.json'];
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
 event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
});