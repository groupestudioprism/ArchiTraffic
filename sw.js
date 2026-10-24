/* ARCHITRAFIC · fonctionnement hors ligne
   - page de l'app : réseau d'abord (toujours la dernière version), copie de secours si pas de réseau ;
   - moteur 3D, Firebase, polices, panneaux et images : gardés après le premier chargement ;
   - données cartographiques et Firestore : jamais ici (l'app et Firestore les gardent déjà sur l'appareil). */
const V = 'at-v1', SHELL = ['./', 'index.html'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const STATIC = /^https:\/\/(cdn\.jsdelivr\.net\/npm\/three@|www\.gstatic\.com\/firebasejs\/|fonts\.(googleapis|gstatic)\.com\/)/;
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url), same = u.origin === location.origin;
  if (same && (r.mode === 'navigate' || u.pathname.endsWith('/index.html'))){
    e.respondWith(fetch(r).then(res => { if (res.ok){ const cp = res.clone(); caches.open(V).then(c => c.put('index.html', cp)); } return res; }).catch(() => caches.match('index.html').then(m => m || caches.match('./'))));
    return; }
  if ((same && u.pathname.includes('/assets/')) || STATIC.test(r.url)){
    // copie gardée servie tout de suite, mise à jour en arrière-plan (les panneaux modifiés arrivent au chargement suivant)
    e.respondWith(caches.match(r).then(m => { const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque'){ const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => m); return m || net; }));
  }
});
