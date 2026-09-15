// 오프라인 캐시: 한 번 연 뒤에는 인터넷 없이도 앱·Python 런타임·사진 필터 모델·가짜 샘플이 열리게 한다.
// 같은 출처의 GET 요청만 다룬다. 기록(사용자 파일)은 여기에 들어오지 않는다(IndexedDB 에만 있음). /api/ 는 캐시하지 않는다.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `mined-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('mined-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  // 화면(index.html)은 인터넷이 되면 새 판을, 안 되면 캐시를
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        (await caches.open(CACHE)).put('./index.html', res.clone());
        return res;
      } catch {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }
  // 나머지(번들·Pyodide·모델·샘플)는 캐시 먼저, 없으면 받아서 캐시
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') (await caches.open(CACHE)).put(req, res.clone());
    return res;
  })());
});
