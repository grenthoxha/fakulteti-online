/* Keep live schedules and account data on the network; never serve cached HTML. */
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request, { cache: 'no-cache' }).catch(() => new Response(`<!doctype html>
<html lang="sq"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fakulteti Online</title><style>body{margin:0;background:#f6f7fb;color:#142238;font:16px/1.6 system-ui,sans-serif;min-height:100dvh;display:grid;place-items:center}main{max-width:360px;padding:28px}h1{font-size:24px;line-height:1.25}p{color:#64748b}button{border:0;border-radius:12px;background:#1557b0;color:white;font:600 16px system-ui;padding:14px 24px;cursor:pointer}</style>
<main><h1>Lidhu me internetin</h1><p>Orari dhe sallat e lira kërkojnë lidhje me internetin që të shfaqen të dhënat aktuale.</p><button onclick="location.reload()">Provo sërish</button></main></html>`, {
    status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  })));
});
