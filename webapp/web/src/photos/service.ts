// 주 하나의 사진을 기기 안에서 거르고 미리보기를 돌려주는 서비스(연결 지점).
// 사진 바이트는 import/photoRegistry, 거르기는 filter/photoFilter 를 쓴다. 둘이 없으면 '확인할 수 없음'으로 닫힌 쪽 실패.
import type { PhotoRecord } from '../types';

export interface ShownPhoto { id: string; url: string; blurred: boolean; date: string; hour: number; minute?: number; dh?: string }
export interface WeekPhotoResult {
  status: 'done' | 'unavailable';
  shown: ShownPhoto[];
  faces: ShownPhoto[]; // 얼굴이 있어 숨긴 사진(얼굴을 흐린 미리보기). 사용자가 열 때만 보여 준다
  hidden: { face: number; text: number; screenshot: number; error: number; missing: number };
  /** 아직 확인하지 않은 사진 수(limit 을 넘은 만큼). "더 확인하기"로 이어서 거른다 */
  remaining: number;
  ms: number;
}

export interface CheckOptions { limit?: number }
export type PhotoService = (photos: PhotoRecord[], onProgress?: (done: number, total: number) => void, opts?: CheckOptions) => Promise<WeekPhotoResult>;

let impl: PhotoService = async (photos) => ({
  status: 'unavailable', shown: [], faces: [],
  hidden: { face: 0, text: 0, screenshot: 0, error: 0, missing: photos.length }, remaining: 0, ms: 0,
});

export function setPhotoService(s: PhotoService) { impl = s; }
export function checkWeekPhotos(photos: PhotoRecord[], onProgress?: (d: number, t: number) => void, opts?: CheckOptions) { return impl(photos, onProgress, opts); }

/** 한 주의 사진을 확인할 순서: 판정 지표와 이어진 사진(새벽 사진 배지면 새벽 사진) 먼저, 나머지는 날짜를 고르게 돌아가며. */
export function orderPhotos(photos: PhotoRecord[], nightFirst: boolean): PhotoRecord[] {
  const byDay = new Map<string, PhotoRecord[]>();
  for (const p of [...photos].sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour || a.path.localeCompare(b.path))) {
    const a = byDay.get(p.date) ?? [];
    a.push(p);
    byDay.set(p.date, a);
  }
  const out: PhotoRecord[] = [];
  if (nightFirst) for (const a of byDay.values()) for (const p of a) if (p.hour < 5) out.push(p);
  const seen = new Set(out.map((p) => p.id));
  const lanes = [...byDay.values()].map((a) => a.filter((p) => !seen.has(p.id)));
  for (let i = 0; lanes.some((l) => i < l.length); i++) for (const l of lanes) if (i < l.length) out.push(l[i]);
  return out;
}
