const CACHE='basketball-agenda-v28';
const SHELL=['./','./index.html','./styles.css?v=3','./club.css?v=2','./all-teams.js?v=5','./app.js?v=3','./club.js?v=3','./admin-agenda-v2.js?v=1','./club-members-admin.js?v=6','./feed.js?v=6','./argon-ui.js?v=5','./final-fixes.js?v=2','./agenda-polish.js?v=3','./ux-v3.js?v=2','./manifest.webmanifest','./data/tasks.json'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    return response;
  }).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
});