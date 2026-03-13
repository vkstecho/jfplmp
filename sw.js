// GLS MET Power — Service Worker
// AUTO-VERSION: changes on every deploy via BUILD_TIME injected in index.html
// Strategy: Network-First for HTML (always fresh), Cache-First for assets

const SW_VERSION = 'glsmp-v5';
const INTEGRITY_CACHE = 'glsmp-integrity'; // Never deleted — holds session-integrity token

// ── Install: write integrity token to protected cache ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(INTEGRITY_CACHE)
      .then(cache => cache.put(
        '/integrity-token',
        new Response(SW_VERSION, { headers: { 'Content-Type': 'text/plain' } })
      ))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete old versioned caches, but KEEP integrity cache ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== INTEGRITY_CACHE && k !== SW_VERSION) // keep integrity + current
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: NETWORK FIRST for everything ──
// Never serve stale HTML — always fetch fresh from server
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Pass through: Firebase, Google, Anthropic, non-GET
  if (
    e.request.method !== 'GET' ||
    url.includes('firebaseio.com') ||
    url.includes('googleapis.com') ||
    url.includes('anthropic.com') ||
    url.includes('gstatic.com') ||
    url.includes('firebase') ||
    url.startsWith('chrome-extension')
  ) return;

  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })  // always ask server for fresh copy
      .then(res => {
        if (res.ok && res.status === 200) {
          const clone = res.clone();
          caches.open(SW_VERSION).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request)
          .then(r => r || new Response(
            `<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0e;color:#fff">
              <div style="font-size:48px;margin-bottom:16px">📡</div>
              <h2 style="color:#f97316">No Internet</h2>
              <p style="color:#64748b">Internet connection check करें और reload करें</p>
              <button onclick="location.reload()" style="background:#f97316;border:none;color:#fff;padding:12px 24px;border-radius:10px;font-size:16px;cursor:pointer;margin-top:16px">🔄 Reload</button>
            </body></html>`,
            { status: 503, headers: { 'Content-Type': 'text/html' } }
          ))
      )
  );
});

// ── Message: force reload all clients ──
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
