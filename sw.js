/* STENOGRAMA service worker: aplicația (shell) funcționează offline; biblioteca de pe jsDelivr se păstrează după prima folosire.
   Modelele Whisper (Hugging Face) le păstrează transformers.js în Cache API; nu le interceptăm aici. */
const V='stenograma-v1';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./icon-maskable-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('stenograma-')&&k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 const r=e.request;
 if(r.method!=='GET')return;
 const u=new URL(r.url);
 if(u.origin===location.origin){
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(h=>h||fetch(r).then(n=>{if(n.ok){const c=n.clone();caches.open(V).then(x=>x.put(r,c))}return n}).catch(()=>r.mode==='navigate'?caches.match('./index.html'):Response.error())));
  /* actualizare în fundal pentru shell */
  if(r.mode==='navigate')e.waitUntil(fetch(r).then(n=>n.ok&&caches.open(V).then(x=>x.put(r,n))).catch(()=>{}));
 }else if(u.hostname==='cdn.jsdelivr.net'){
  e.respondWith(caches.open('stenograma-lib').then(c=>c.match(r).then(h=>h||fetch(r).then(n=>{if(n.ok||n.type==='opaque')c.put(r,n.clone());return n}))));
 }
});
