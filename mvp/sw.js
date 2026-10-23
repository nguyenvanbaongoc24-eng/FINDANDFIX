const CACHE='garage-atlas-mvp-v4';
const ASSETS=['./','./index.html','./styles.css','./acquisition.css','./app.js','./acquisition-admin.js','./supabase-config.js','./data/source-registry.json','./data/ewd-library.json','./manifest.webmanifest','./ewd/','./ewd/ewd.css','./ewd/ewd.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method==='GET'&&new URL(event.request.url).origin===location.origin)event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));});
