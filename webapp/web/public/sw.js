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
  // 안드로이드 공유(Web Share Target): 갤러리에서 「공유 → Mine D」로 넘긴 사진을 이 기기 캐시에 잠깐 두고 앱을 연다.
  // 사진은 서버로 가지 않는다(이 POST 는 서비스 워커가 받아 끝낸다). 앱이 읽은 뒤 지운다.
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      const form = await req.formData();
      const files = form.getAll('photos').filter((f) => typeof f !== 'string');
      const c = await caches.open('mined-share');
      for (const k of await c.keys()) await c.delete(k);
      let i = 0;
      for (const f of files) {
        await c.put(new Request(`./__share/${i++}`), new Response(f, { headers: { 'x-name': encodeURIComponent(f.name), 'content-type': f.type, 'x-modified': String(f.lastModified || Date.now()) } }));
      }
      return Response.redirect(`./?shared=${files.length}`, 303);
    })());
    return;
  }
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
