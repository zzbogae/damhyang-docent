// 안드로이드 공유로 받은 사진(서비스 워커가 'mined-share' 캐시에 둔 것)을 꺼낸다. 꺼낸 뒤에는 캐시를 지운다.
export async function takeSharedPhotos(): Promise<File[]> {
  if (typeof caches === 'undefined' || !new URLSearchParams(location.search).has('shared')) return [];
  const c = await caches.open('mined-share');
  const out: File[] = [];
  for (const req of await c.keys()) {
    const res = await c.match(req);
    if (!res) continue;
    const name = decodeURIComponent(res.headers.get('x-name') ?? 'shared.jpg');
    out.push(new File([await res.blob()], name, { type: res.headers.get('content-type') ?? 'image/jpeg', lastModified: Number(res.headers.get('x-modified')) || Date.now() }));
  }
  await caches.delete('mined-share');
  history.replaceState(null, '', location.pathname);
  return out;
}
