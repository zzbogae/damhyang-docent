// 되돌려줄 원문 고르기(계획서 2-8). 판정된 주 하나에서 보여 줄 메모와 사진을 고른다.
// 원칙: 자격증명·개인정보가 걸린 메모는 절대 보여 주지 않는다. 위기 표현이 걸린 메모는 고르되 확인 후 열람으로 표시한다.
// 판정 지표와 이어진 원문을 먼저 고르고, 같은 시각에 쓴 글이나 거의 같은 글은 하나만 남긴다.
import type { MemoRecord, PhotoRecord, WeekRecord } from '../types';
import { scanMemo } from '../filter/memoFilter';

export interface RelicSelection {
  memo_ids: string[];
  photo_ids: string[];
  hidden: Partial<Record<'face' | 'text' | 'screenshot' | 'secret' | 'crisis', number>>;
  /** memo_ids 가운데 확인 후 열람이 필요한 메모(위기 표현) */
  gated_memo_ids: string[];
  /** 아직 필터를 거치지 않아 보여 줄 수 없는 사진. 호출하는 쪽이 필터를 돌린 뒤 다시 고른다 */
  pending_photo_ids: string[];
  /** 필터가 실패해 보여 주지 않은 사진 수(닫힌 쪽 실패) */
  error_photos: number;
}

export interface SelectOptions { maxMemos?: number; maxPhotos?: number; nightHours?: [number, number]; similarity?: number }

const isNight = (h: number, [a, b]: [number, number]) => (a <= b ? h >= a && h < b : h >= a || h < b);

function grams(s: string) {
  const t = s.replace(/\s+/g, ' ').trim();
  const out = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  if (!out.size && t) out.add(t);
  return out;
}

/** 글자 3-gram 자카드 유사도 */
export function jaccard3(a: string, b: string) {
  const A = grams(a), B = grams(b);
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  const uni = A.size + B.size - inter;
  return uni ? inter / uni : 0;
}

function inWeek(week: WeekRecord, r: { week?: string; date: string }) {
  return r.week === week.week || (r.date >= week.date_start && r.date <= week.date_end);
}

interface Scored<T> { item: T; score: number; tie: number }

/** 배지에 따라 메모 점수를 준다: 판정 지표와 이어진 원문일수록 높다. */
function scoreMemo(m: MemoRecord, week: WeekRecord, night: [number, number], maxChars: number): number {
  let s = 0;
  for (const b of week.badges ?? []) {
    if (b.indicator === 'memo_night') s += (b.direction === 'up') === isNight(m.hour, night) ? 3 : 0;
    else if (b.indicator === 'memo_len') s += b.direction === 'up' ? 3 * (m.chars / maxChars) : 3 * (1 - m.chars / maxChars);
    else if (b.indicator === 'memo_n') s += 0.5; // 수가 달랐던 주는 여러 날에 걸쳐 고르는 것으로 충분
    else if (b.family === 'health' && b.indicator === 'sleep' && b.direction === 'down') s += isNight(m.hour, night) ? 1 : 0;
  }
  return s;
}

function scorePhoto(p: PhotoRecord, week: WeekRecord, night: [number, number]): number {
  let s = 0;
  for (const b of week.badges ?? []) {
    if (b.indicator === 'photo_night') s += (b.direction === 'up') === isNight(p.hour, night) ? 3 : 0;
  }
  return s;
}

/** 점수 순으로 고르되, 먼저 서로 다른 날·시각에서 하나씩 고르고(겹치지 않게), 남은 자리는 점수 순으로 채운다. */
function pickSpread<T extends { id: string; date: string; hour: number }>(
  scored: Scored<T>[], max: number, accept: (it: T, picked: T[]) => boolean,
): T[] {
  scored.sort((a, b) => b.score - a.score || b.tie - a.tie || a.item.id.localeCompare(b.item.id));
  const picked: T[] = [];
  const slot = (it: T) => `${it.date}T${it.hour}`;
  const usedSlots = new Set<string>();
  const usedDays = new Map<string, number>();
  // 1차: 다른 시각, 하루 최대 2개
  for (const { item } of scored) {
    if (picked.length >= max) break;
    if (usedSlots.has(slot(item)) || (usedDays.get(item.date) ?? 0) >= 2) continue;
    if (!accept(item, picked)) continue;
    picked.push(item); usedSlots.add(slot(item)); usedDays.set(item.date, (usedDays.get(item.date) ?? 0) + 1);
  }
  // 2차: 남은 자리를 점수 순으로(비슷한 글 거르기는 유지)
  for (const { item } of scored) {
    if (picked.length >= max) break;
    if (picked.includes(item) || !accept(item, picked)) continue;
    picked.push(item);
  }
  return picked;
}

export function selectRelic(week: WeekRecord, memos: MemoRecord[], photos: PhotoRecord[], opts: SelectOptions = {}): RelicSelection {
  const maxMemos = opts.maxMemos ?? 5;
  const maxPhotos = opts.maxPhotos ?? 12;
  const night = opts.nightHours ?? [0, 5];
  const simThr = opts.similarity ?? 0.6;
  const hidden: RelicSelection['hidden'] = {};
  const bump = (k: keyof RelicSelection['hidden']) => { hidden[k] = (hidden[k] ?? 0) + 1; };

  // 메모: 필터 표시가 없으면 여기서 검사한다(검사하지 않은 메모는 보여 주지 않는다)
  const weekMemos = memos.filter((m) => inWeek(week, m));
  const eligible: MemoRecord[] = [];
  for (const m of weekMemos) {
    const f = m.flags && typeof m.flags.secret === 'boolean' ? m.flags : scanMemo(m.text);
    if (f.secret) { bump('secret'); continue; }
    eligible.push({ ...m, flags: { ...m.flags, secret: false, crisis: !!f.crisis } });
  }
  const maxChars = Math.max(1, ...eligible.map((m) => m.chars || m.text.length));
  const memoPick = pickSpread(
    eligible.map((m) => ({ item: m, score: scoreMemo(m, week, night, maxChars), tie: Math.min(m.chars || m.text.length, 400) })),
    maxMemos,
    (it, picked) => picked.every((p) => jaccard3(p.text, it.text) < simThr),
  );

  // 사진: 필터를 통과한 것(status ok)만
  const weekPhotos = photos.filter((p) => inWeek(week, p));
  const okPhotos: PhotoRecord[] = [];
  const pending: string[] = [];
  let errors = 0;
  for (const p of weekPhotos) {
    const f = p.filter;
    if (!f) { pending.push(p.id); continue; }
    if (f.status === 'ok') { okPhotos.push(p); continue; }
    if (f.status === 'error') { errors++; continue; }
    for (const r of new Set(f.reasons)) if (r === 'face' || r === 'text' || r === 'screenshot') bump(r);
  }
  const photoPick = pickSpread(
    okPhotos.map((p) => ({ item: p, score: scorePhoto(p, week, night), tie: 0 })),
    maxPhotos,
    () => true,
  );

  const memo_ids = memoPick.map((m) => m.id);
  const gated = memoPick.filter((m) => m.flags?.crisis).map((m) => m.id);
  if (gated.length) hidden.crisis = gated.length; // 고른 메모 중 확인 후 열람으로 가려 둔 수
  return {
    memo_ids,
    photo_ids: photoPick.map((p) => p.id),
    hidden,
    gated_memo_ids: gated,
    pending_photo_ids: pending,
    error_photos: errors,
  };
}
