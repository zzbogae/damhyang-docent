// 실제 기록 평가(참가자 쪽). 사건 적기·봉인, 가린 주 기억해 보기, 숫자만 담은 보고서 만들기.
// 사건 날짜와 메모, 가린 주의 날짜는 이 브라우저에만 남는다. 보고서에는 숫자와 봉인 해시만 들어간다.
import type { WeekRecord } from '../types';

export type EventKind = 'hard' | 'good' | 'change';
export const KIND_LABEL: Record<EventKind, string> = {
  hard: '힘들었던 일',
  good: '좋았거나 특별했던 일',
  change: '계속되는 변화(이사·이직·입학 등)',
};
export const KIND_SHORT: Record<EventKind, string> = { hard: '힘들었던 일', good: '좋았던 일', change: '계속되는 변화' };

export interface EvalEvent { id: string; start: string; end?: string; kind: EventKind; note?: string }
export type Answer = 'yes' | 'no' | 'unsure';
export interface RatingItem { week: string; group: 'c' | 'n'; answer?: Answer }

export interface EvalState {
  participant: string;
  events: EvalEvent[];
  sealedAt?: string;
  sealedHash?: string;
  /** 봉인할 때 이 브라우저에 판정 결과가 없었는지 */
  sealedBeforeResult?: boolean;
  /** 봉인한 횟수. 풀었다가 다시 봉인하면 늘어난다 */
  seals: number;
  ratings?: RatingItem[];
  /** 가린 주를 뽑은 판정 결과를 알아보는 열쇠(다시 가져오면 바뀐다) */
  ratingKey?: string;
}

export const EMPTY_STATE: EvalState = { participant: '', events: [], seals: 0 };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 사건 하나를 검사한다. 문제가 없으면 null. today 는 YYYY-MM-DD. */
export function checkEvent(e: Pick<EvalEvent, 'start' | 'end' | 'kind'>, today: string): string | null {
  if (!DATE_RE.test(e.start)) return '시작한 날을 골라 주세요.';
  if (e.start > today) return '오늘보다 뒤의 날짜는 적을 수 없습니다.';
  if (e.end) {
    if (!DATE_RE.test(e.end)) return '끝난 날의 형식이 맞지 않습니다.';
    if (e.end < e.start) return '끝난 날이 시작한 날보다 앞섭니다.';
    if (e.kind === 'change') return '계속되는 변화는 시작한 날만 적어 주세요.';
    const days = (Date.parse(e.end) - Date.parse(e.start)) / 86400000 + 1;
    if (days > 120) return '넉 달이 넘는 일은 "계속되는 변화"로 적거나 나눠 적어 주세요.';
  }
  return null;
}

/** 봉인에 쓰는 정규화: 메모는 빼고 날짜·종류만, 날짜 순서로 한 줄씩 */
export function canonicalEvents(events: EvalEvent[]): string {
  return events
    .map((e) => `${e.start}|${e.kind === 'change' ? '' : e.end ?? ''}|${e.kind}`)
    .sort()
    .join('\n');
}

export async function hashEvents(events: EvalEvent[]): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalEvents(events)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- 가린 주 기억해 보기 ----------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(a: T[], rnd: () => number): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function resultKey(weeks: WeekRecord[]): string {
  const n = weeks.filter((w) => w.candidate).length;
  return `${weeks[0]?.week ?? ''}|${weeks.length}|${n}`;
}

/**
 * 판정된 주와 평범한 주를 같은 수만큼 뽑아 섞는다. 평범한 주는 판정할 수 있었던 주 가운데
 * 앞뒤 2주 안에 판정된 주가 없는 주에서 고른다(이어진 변화의 가장자리를 피하려고).
 */
export function sampleForRating(weeks: WeekRecord[], seed: number, nEach = 10): RatingItem[] {
  const rnd = mulberry32(seed);
  const cand = weeks.map((w, i) => (w.candidate ? i : -1)).filter((i) => i >= 0);
  const judged = (w: WeekRecord) => Object.values(w.ind).some((v) => v && v.pr !== null);
  const near = new Set<number>();
  for (const i of cand) for (let k = i - 2; k <= i + 2; k++) near.add(k);
  const ctrl = weeks.map((w, i) => (!w.candidate && judged(w) && !near.has(i) ? i : -1)).filter((i) => i >= 0);
  const n = Math.min(nEach, cand.length, ctrl.length);
  const c = shuffle(cand, rnd).slice(0, n).map((i) => ({ week: weeks[i].week, group: 'c' as const }));
  const k = shuffle(ctrl, rnd).slice(0, n).map((i) => ({ week: weeks[i].week, group: 'n' as const }));
  return shuffle([...c, ...k], rnd);
}

function logFact(n: number): number {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  return s;
}
function logChoose(n: number, k: number): number {
  return k < 0 || k > n ? -Infinity : logFact(n) - logFact(k) - logFact(n - k);
}

/** 피셔 정확 검정(한쪽): 판정된 주가 평범한 주보다 "기억에 남는" 비율이 높다는 쪽 */
export function fisherGreater(yesC: number, noC: number, yesN: number, noN: number): number {
  const n = yesC + noC;
  const K = yesC + yesN;
  const N = n + yesN + noN;
  if (N === 0) return 1;
  const denom = logChoose(N, n);
  let p = 0;
  for (let x = yesC; x <= Math.min(n, K); x++) p += Math.exp(logChoose(K, x) + logChoose(N - K, n - x) - denom);
  return Math.min(1, p);
}

export interface RatingStats {
  n_candidates: number; n_controls: number;
  yes_candidates: number; yes_controls: number;
  unsure_candidates: number; unsure_controls: number;
  rate_candidates: number | null; rate_controls: number | null;
  lift: number | null; p_one_sided: number | null;
}

export function ratingStats(items: RatingItem[]): RatingStats {
  const g = (grp: 'c' | 'n', a: Answer) => items.filter((x) => x.group === grp && x.answer === a).length;
  const yc = g('c', 'yes'), nc = g('c', 'no'), uc = g('c', 'unsure');
  const yn = g('n', 'yes'), nn = g('n', 'no'), un = g('n', 'unsure');
  const rc = yc + nc ? yc / (yc + nc) : null;
  const rn = yn + nn ? yn / (yn + nn) : null;
  const r3 = (x: number | null) => (x === null ? null : Math.round(x * 1000) / 1000);
  return {
    n_candidates: yc + nc + uc, n_controls: yn + nn + un,
    yes_candidates: yc, yes_controls: yn, unsure_candidates: uc, unsure_controls: un,
    rate_candidates: r3(rc), rate_controls: r3(rn),
    lift: rc !== null && rn ? r3(rc / rn) : null,
    p_one_sided: yc + nc && yn + nn ? r3(fisherGreater(yc, nc, yn, nn)) : null,
  };
}

// ---------- 보고서 ----------

const LEAK_RE = /\d{4}-\d{2}-\d{2}|\d{4}-W\d{2}/;

/** 날짜처럼 보이는 값(키 포함)의 위치를 모두 찾는다. 보고서를 내려받기 전에 한 번 더 확인한다. */
export function findDates(obj: unknown, path = ''): string[] {
  if (Array.isArray(obj)) return obj.flatMap((v, i) => findDates(v, `${path}[${i}]`));
  if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => [
      ...(LEAK_RE.test(k) ? [`${path}/${k}(key)`] : []),
      ...findDates(v, `${path}/${k}`),
    ]);
  }
  return typeof obj === 'string' && LEAK_RE.test(obj) ? [path] : [];
}

/** 참가 코드: 영문·숫자·_·- 16자 이내. 이름이 들어가지 않도록 한글을 받지 않고, 연도처럼 보이는 네 자리 숫자도 받지 않는다. */
export function participantOk(code: string): boolean {
  return /^[A-Za-z0-9_-]{1,16}$/.test(code) && !/\d{4}/.test(code);
}

/** 판정 코어가 만든 숫자 보고서에 참가자 코드·봉인 정보·가린 평가 결과를 더한다. */
export function buildReport(core: Record<string, unknown>, st: EvalState, now = new Date()): Record<string, unknown> {
  const rep: Record<string, unknown> = {
    ...core,
    participant: st.participant,
    created_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    seal: {
      sealed: !!st.sealedHash,
      before_result: !!st.sealedBeforeResult,
      seals: st.seals,
      events_sha256: st.sealedHash ?? null,
    },
    ratings: st.ratings?.some((r) => r.answer) ? ratingStats(st.ratings) : null,
    privacy: '날짜, 사건 메모, 기록 원문은 들어 있지 않습니다.',
  };
  const leaks = findDates(rep);
  if (leaks.length) throw new Error(`보고서에 날짜가 섞여 있어 만들지 않았습니다 (${leaks.slice(0, 3).join(', ')})`);
  return rep;
}
