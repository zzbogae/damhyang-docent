// 브라우저 안 저장소(IndexedDB). 서버로 보내지 않는다. "내 기록 모두 지우기"는 wipeAll().
import Dexie, { type Table } from 'dexie';
import type { DailyMeta, DailyRow, MemoRecord, MinedResult, PhotoRecord } from './types';

export interface LabelRow { id?: number; week: string; name: string; createdAt: string }
export interface KV { key: string; value: unknown }
export interface ThumbRow { id: string; blob: Blob; w: number; h: number; blurred: boolean; /** 비슷한 사진 묶기용 차이 해시(16진수 16자) */ dh?: string }

export class MinedDB extends Dexie {
  daily!: Table<DailyRow, string>;
  memos!: Table<MemoRecord, string>;
  photos!: Table<PhotoRecord, string>;
  thumbs!: Table<ThumbRow, string>;
  labels!: Table<LabelRow, number>;
  kv!: Table<KV, string>;

  constructor(name = 'mined') {
    super(name);
    this.version(1).stores({
      daily: 'date',
      memos: 'id, week, date',
      photos: 'id, week, date, path',
      thumbs: 'id',
      labels: '++id, week, name',
      kv: 'key',
    });
  }
}

export const db = new MinedDB();

export async function getKV<T>(key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}
export async function setKV(key: string, value: unknown) {
  await db.kv.put({ key, value });
}

export async function saveImport(daily: DailyRow[], meta: DailyMeta, memos: MemoRecord[], photos: PhotoRecord[]) {
  await db.transaction('rw', [db.daily, db.memos, db.photos, db.kv], async () => {
    await db.daily.clear();
    await db.memos.clear();
    await db.photos.clear();
    await db.daily.bulkPut(daily);
    await db.memos.bulkPut(memos);
    await db.photos.bulkPut(photos);
    await db.kv.put({ key: 'meta', value: meta });
  });
}

export async function saveResult(result: MinedResult) {
  await setKV('result', result);
}

export async function loadResult(): Promise<MinedResult | undefined> {
  return getKV<MinedResult>('result');
}

/** 내 기록 모두 지우기: 이 브라우저에 남은 Mine D 데이터를 전부 지운다. */
export async function wipeAll() {
  db.close();
  await Dexie.delete(db.name);
  await db.open();
  try { localStorage.removeItem('mined:greeted'); } catch { /* 무시 */ }
}
