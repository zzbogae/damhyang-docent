// 기간 비교(원페이지 03절 "구조 계층": 기간 질의와 집계). 주 레코드의 원래 값(ind[..].v)만 쓰고 LLM 은 쓰지 않는다.
// 기간 단위: 연도, 계절(연도별), 시기(판정 코어가 나눈 era), 붙인 이름(방). 값은 관측된 주의 중앙값.
import type { MinedResult, WeekRecord } from '../types';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type PeriodSpec =
  | { kind: 'year'; year: number }
  | { kind: 'season'; year: number; season: Season }
  | { kind: 'era'; id: string }
  | { kind: 'label'; name: string };

export const SEASON_LABEL: Record<Season, string> = { spring: '봄(3~5월)', summer: '여름(6~8월)', autumn: '가을(9~11월)', winter: '겨울(12~2월)' };
export const METRICS = ['steps', 'sleep', 'memo_n', 'photo_n', 'yt_watch', 'yt_search', 'cal_n', 'memo_night', 'yt_night'] as const;

/** 주의 가운데 날(목요일) 기준 연·월 */
function mid(w: WeekRecord): { y: number; m: number } {
  const [y, m, d] = w.date_start.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 3));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 };
}

export function seasonOf(w: WeekRecord): { year: number; season: Season } {
  const { y, m } = mid(w);
  if (m >= 3 && m <= 5) return { year: y, season: 'spring' };
  if (m >= 6 && m <= 8) return { year: y, season: 'summer' };
  if (m >= 9 && m <= 11) return { year: y, season: 'autumn' };
  return { year: m === 12 ? y : y - 1, season: 'winter' }; // 겨울 Y = Y년 12월 ~ Y+1년 2월
}

export function weeksIn(spec: PeriodSpec, result: MinedResult, labels: { week: string; name: string }[]): WeekRecord[] {
  const ws = result.weeks;
  switch (spec.kind) {
    case 'year': return ws.filter((w) => mid(w).y === spec.year);
    case 'season': return ws.filter((w) => { const s = seasonOf(w); return s.year === spec.year && s.season === spec.season; });
    case 'era': { const e = result.eras.find((x) => x.id === spec.id); return e ? ws.slice(e.start_index, e.end_index) : []; }
    case 'label': { const set = new Set(labels.filter((l) => l.name === spec.name).map((l) => l.week)); return ws.filter((w) => set.has(w.week)); }
  }
}

export function periodName(spec: PeriodSpec, result: MinedResult): string {
  switch (spec.kind) {
    case 'year': return `${spec.year}년`;
    case 'season': return `${spec.year}년 ${SEASON_LABEL[spec.season]}`;
    case 'era': {
      const e = result.eras.find((x) => x.id === spec.id);
      return e ? `시기 ${e.start.replaceAll('-', '.')} ~ ${e.end.replaceAll('-', '.')}` : '시기';
    }
    case 'label': return `이름 "${spec.name}"을 붙인 주`;
  }
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

export interface MetricRow { metric: string; a: { value: number | null; n: number }; b: { value: number | null; n: number }; ratio: number | null }
export interface Comparison { a: { name: string; weeks: number; candidates: WeekRecord[] }; b: { name: string; weeks: number; candidates: WeekRecord[] }; rows: MetricRow[] }

function stat(ws: WeekRecord[], metric: string) {
  const vals = ws.map((w) => w.ind?.[metric]?.v).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return { value: median(vals), n: vals.length };
}

/** 두 기간을 지표마다 비교한다. 관측된 주가 min_n 보다 적은 쪽은 값을 비운다(근거가 모자라서). */
export function compare(A: PeriodSpec, B: PeriodSpec, result: MinedResult, labels: { week: string; name: string }[], minN = 4): Comparison {
  const wa = weeksIn(A, result, labels);
  const wb = weeksIn(B, result, labels);
  const rows: MetricRow[] = METRICS.map((m) => {
    const a = stat(wa, m);
    const b = stat(wb, m);
    if (a.n < minN) a.value = null;
    if (b.n < minN) b.value = null;
    const floor = m.endsWith('_night') ? 0.05 : 1;
    const ratio = a.value !== null && b.value !== null && Math.abs(a.value) >= floor ? (b.value - a.value) / Math.abs(a.value) : null;
    return { metric: m, a, b, ratio };
  });
  return {
    a: { name: periodName(A, result), weeks: wa.length, candidates: wa.filter((w) => w.candidate) },
    b: { name: periodName(B, result), weeks: wb.length, candidates: wb.filter((w) => w.candidate) },
    rows,
  };
}

/** 고를 수 있는 기간 목록 */
export function periodOptions(result: MinedResult, labels: { week: string; name: string }[]): { key: string; spec: PeriodSpec; name: string }[] {
  const out: { key: string; spec: PeriodSpec; name: string }[] = [];
  const years = [...new Set(result.weeks.map((w) => mid(w).y))].sort();
  for (const y of years) out.push({ key: `y:${y}`, spec: { kind: 'year', year: y }, name: `${y}년` });
  const seasons = new Map<string, { year: number; season: Season }>();
  for (const w of result.weeks) { const s = seasonOf(w); seasons.set(`${s.year}:${s.season}`, s); }
  for (const s of [...seasons.values()].sort((a, b) => a.year - b.year || Object.keys(SEASON_LABEL).indexOf(a.season) - Object.keys(SEASON_LABEL).indexOf(b.season))) {
    out.push({ key: `s:${s.year}:${s.season}`, spec: { kind: 'season', ...s }, name: `${s.year}년 ${SEASON_LABEL[s.season]}` });
  }
  for (const e of result.eras) out.push({ key: `e:${e.id}`, spec: { kind: 'era', id: e.id }, name: periodName({ kind: 'era', id: e.id }, result) });
  for (const n of [...new Set(labels.map((l) => l.name))].sort((a, b) => a.localeCompare(b, 'ko'))) out.push({ key: `l:${n}`, spec: { kind: 'label', name: n }, name: `이름 "${n}"을 붙인 주` });
  return out;
}
