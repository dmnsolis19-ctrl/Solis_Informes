const CACHE='solis-field-pro-58c4cdb1596d';
const ASSETS=["/icon-192.png","/icon-512.png","/icon.svg","/index.html","/js/accounts-ui.js","/js/app.js","/js/catalogs.js","/js/designer.js","/js/domain.js","/js/drafts.js","/js/enterprise-ui.js","/js/field-tools.js","/js/operations.js","/js/recovery-ui.js","/js/recovery.js","/js/render.js","/js/specialties.js","/js/store.js","/js/sync.js","/js/vendor/jsqr.js","/js/vendor/qrcodegen.js","/js/workflow-ui.js","/js/workspace-ui.js","/manifest.webmanifest","/print.css","/solis-logo.png","/styles.css","/"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('solis-field')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/s/'))return;
if(event.request.mode==='navigate'){event.respondWith((async()=>{try{const response=await fetch(event.request,{signal:AbortSignal.timeout(4000)});if(response.ok)return response;throw new Error('Navigation unavailable');}catch{return (await caches.match('/'))||(await caches.match('/index.html'));}})());return;}
if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(event.request))||fetch(event.request)));
});
