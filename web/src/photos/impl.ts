// 사진 서비스 구현: 캐시(db.thumbs)에 있으면 그대로, 없으면 원본을 찾아 기기 안에서 거른 뒤 미리보기만 저장한다.
// 원본 바이트는 저장하지 않는다. 필터가 실패하거나 원본을 못 찾으면 보여 주지 않는다(닫힌 쪽 실패).
import { db } from '../db';
import { filterPhotos, toRecordFilter } from '../filter/photoFilter';
import type { PhotoRecord } from '../types';
import type { PhotoService, ShownPhoto, WeekPhotoResult } from './service';
import { dhashOfBlob } from './similar';

const urls = new Map<string, string>();
function urlFor(id: string, blob: Blob) {
  let u = urls.get(id);
  if (!u) { u = URL.createObjectURL(blob); urls.set(id, u); }
  return u;
}

export function createPhotoService(getBlob: (path: string) => Promise<Blob | undefined>): PhotoService {
  return async (photos: PhotoRecord[], onProgress, opts) => {
    const limit = opts?.limit ?? Infinity;
    const t0 = performance.now();
    const hidden = { face: 0, text: 0, screenshot: 0, error: 0, missing: 0 };
    const shown: ShownPhoto[] = [];
    const faces: ShownPhoto[] = [];
    const need: { rec: PhotoRecord; blob: Blob }[] = [];
    const cached = await db.thumbs.bulkGet(photos.map((p) => p.id));
    let remaining = 0;
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      const th = cached[i];
      if (p.filter && p.filter.status !== 'error' && (th || p.filter.status === 'hidden')) {
        place(p, th?.blob, th?.blurred ?? false, th?.dh);
        continue;
      }
      if (need.length >= limit) { remaining++; continue; }
      const blob = await getBlob(p.path).catch(() => undefined);
      if (!blob) { hidden.missing++; continue; }
      need.push({ rec: p, blob });
    }
    if (need.length) {
      const res = await filterPhotos(need.map((n) => ({ id: n.rec.id, blob: n.blob, name: n.rec.name })), (d, t) => onProgress?.(d, t));
      for (const { rec } of need) {
        const r = res.get(rec.id)!;
        const f = toRecordFilter(r);
        rec.filter = f;
        await db.photos.update(rec.id, { filter: f });
        let dh: string | undefined;
        if (r.thumb) {
          dh = r.thumbBlurred ? undefined : await dhashOfBlob(r.thumb);
          await db.thumbs.put({ id: rec.id, blob: r.thumb, w: r.width ?? 0, h: r.height ?? 0, blurred: !!r.thumbBlurred, ...(dh ? { dh } : {}) });
        }
        place(rec, r.thumb, !!r.thumbBlurred, dh);
      }
    }
    // 해시가 없던 예전 미리보기는 지금 만들어 저장해 둔다
    for (const sp of shown) {
      if (sp.dh) continue;
      const th = await db.thumbs.get(sp.id);
      if (!th) continue;
      sp.dh = await dhashOfBlob(th.blob);
      if (sp.dh) await db.thumbs.update(sp.id, { dh: sp.dh });
    }
    const status: WeekPhotoResult['status'] = hidden.missing === photos.length && photos.length > 0 ? 'unavailable' : 'done';
    return { status, shown, faces, hidden, remaining, ms: Math.round(performance.now() - t0) };

    function place(p: PhotoRecord, blob: Blob | undefined, blurred: boolean, dh?: string) {
      const f = p.filter!;
      if (f.status === 'error') { hidden.error++; return; }
      if (f.status === 'ok' && blob && !blurred) {
        shown.push({ id: p.id, url: urlFor(p.id, blob), blurred: false, date: p.date, hour: p.hour, ...(p.minute !== undefined ? { minute: p.minute } : {}), ...(dh ? { dh } : {}) });
        return;
      }
      const rs = f.reasons;
      if (rs.includes('screenshot')) hidden.screenshot++;
      else if (rs.includes('text')) hidden.text++;
      else if (rs.includes('face')) {
        hidden.face++;
        if (blob && blurred) faces.push({ id: p.id, url: urlFor(p.id, blob), blurred: true, date: p.date, hour: p.hour });
      } else hidden.error++;
    }
  };
}
