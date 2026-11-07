// 시연 빌드 전용(VITE_DEMO_SNAPSHOT=1): 「가짜 샘플 기록으로 먼저 보기」를 누르면 Pyodide 판정을 돌리는 대신,
// 같은 가짜 샘플을 미리 판정해 둔 스냅숏(public 이 아닌 빌드 산출물 demo/snapshot.json)을 이 브라우저 저장소에 넣는다.
// 압축 파일과 Python 런타임을 올릴 수 없는 곳(아티팩트 미리보기 등)에서 화면 흐름만 보여 주기 위한 것. 실제 기록은 쓰지 않는다.
import { db } from '../db';
import type { MinedResult } from '../types';

export const DEMO_SNAPSHOT = import.meta.env.VITE_DEMO_SNAPSHOT === '1';

type Snap = { db: Record<string, unknown[]> };

export async function loadDemoSnapshot(): Promise<MinedResult> {
  const r = await fetch(import.meta.env.BASE_URL + 'demo/snapshot.json');
  if (!r.ok) throw new Error('시연용 샘플을 불러오지 못했습니다');
  const snap = (await r.json()) as Snap;
  const tables = [db.daily, db.memos, db.photos, db.labels, db.kv];
  await db.transaction('rw', tables, async () => {
    for (const t of tables) {
      await t.clear();
      const rows = snap.db[t.name];
      if (rows?.length) await (t as unknown as { bulkPut(r: unknown[]): Promise<unknown> }).bulkPut(rows);
    }
  });
  await loadDemoPhotos();
  const res = (await db.kv.get('result'))?.value as MinedResult | undefined;
  if (!res) throw new Error('시연용 샘플에 판정 결과가 없습니다');
  return res;
}

/**
 * 11/06 전시: 합성 인물의 예시 사진. demo/photos/index.json = [{ id, file, w, h }] (id 는 photos 표의 사진 id).
 * 사람이 없는 풍경·음식 사진만 골라 줄이고 촬영 위치·정보를 지운 것이라, 얼굴·글자 거르기는 미리 통과로 적어 두고
 * 미리보기(thumbs)에 바로 넣는다. 파일이 없으면 조용히 건너뛴다.
 */
async function loadDemoPhotos() {
  try {
    const base = import.meta.env.BASE_URL + 'demo/photos/';
    const r = await fetch(base + 'index.json');
    if (!r.ok) return;
    const list = (await r.json()) as { id: string; file: string; w: number; h: number }[];
    const rows = await Promise.all(list.map(async (x) => {
      const b = await fetch(base + x.file).then((q) => (q.ok ? q.blob() : undefined)).catch(() => undefined);
      return b ? { id: x.id, blob: b, w: x.w, h: x.h, blurred: false } : undefined;
    }));
    const ok = rows.filter((x): x is NonNullable<typeof x> => !!x);
    const checkedAt = new Date().toISOString();
    await db.transaction('rw', [db.thumbs, db.photos], async () => {
      await db.thumbs.bulkPut(ok);
      for (const t of ok) await db.photos.update(t.id, { filter: { status: 'ok', reasons: [], faces: 0, checkedAt } });
    });
  } catch { /* 예시 사진이 없어도 시연은 그대로 */ }
}
