// 가져오기 파일 밖에서 더하는 기록: 스크린타임 캡처에서 읽은 사용 시간, git log 의 커밋 수.
// 다시 가져오기를 해도 지워지지 않도록 일 단위 표와 따로 저장하고, 판정 직전에만 합친다.
import { getKV, setKV } from '../db';
import type { DailyMeta, DailyRow } from '../types';

export interface ScreenEntry { id: string; date: string; minutes: number; kind: 'day' | 'week_avg'; file: string }
export interface Extras { screen: ScreenEntry[]; git: { date: string; n: number }[] }
export const EMPTY_EXTRAS: Extras = { screen: [], git: [] };

export async function loadExtras(): Promise<Extras> {
  return { ...EMPTY_EXTRAS, ...((await getKV<Extras>('extras')) ?? {}) };
}
export async function saveExtras(e: Extras) {
  await setKV('extras', e);
}

const addDays = (iso: string, k: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + k);
  return d.toISOString().slice(0, 10);
};
const mondayOf = (iso: string) => addDays(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));

/** 일 단위 표와 메타에 더한다. 하루 값이 주 평균보다 우선한다. 원래 배열은 바꾸지 않는다. */
export function mergeExtras(daily: DailyRow[], meta: DailyMeta, ex: Extras): { daily: DailyRow[]; meta: DailyMeta } {
  if (!ex.screen.length && !ex.git.length) return { daily, meta };
  const rows = new Map(daily.map((r) => [r.date, { ...r }]));
  const row = (d: string) => { let r = rows.get(d); if (!r) rows.set(d, (r = { date: d })); return r; };
  const screenDay = new Map<string, number>();
  // 주 평균은 그 주(월~일) 일곱 날에 같은 값으로, 하루 값은 그날에
  for (const e of ex.screen.filter((x) => x.kind === 'week_avg')) {
    const mon = mondayOf(e.date);
    for (let k = 0; k < 7; k++) screenDay.set(addDays(mon, k), e.minutes);
  }
  for (const e of ex.screen.filter((x) => x.kind === 'day')) screenDay.set(e.date, e.minutes);
  for (const [d, v] of screenDay) row(d).screen_min = v;
  for (const g of ex.git) row(g.date).git_commits = (row(g.date).git_commits ?? 0) + g.n;
  const channels = { ...meta.channels };
  const span = (ds: string[]) => { const s = [...ds].sort(); return { first: s[0], last: s[s.length - 1] }; };
  if (screenDay.size) channels.screen = { ...span([...screenDay.keys()]), sources: ['screenshot-ocr'], records: ex.screen.length };
  if (ex.git.length) channels.git = { ...span(ex.git.map((g) => g.date)), sources: ['git-log'], records: ex.git.reduce((a, g) => a + g.n, 0) };
  return { daily: [...rows.values()].sort((a, b) => a.date.localeCompare(b.date)), meta: { ...meta, channels } };
}
