import { describe, expect, it } from 'vitest';
import { compare, median, periodOptions, seasonOf } from '../src/query/periods';

function wk(date_start: string, steps: number | null, cand = false) {
  return { week: date_start, date_start, date_end: date_start, candidate: cand, ind: { steps: { v: steps } } } as any;
}

describe('기간 비교', () => {
  it('계절: 겨울은 12월~이듬해 2월을 한 겨울로 본다', () => {
    expect(seasonOf(wk('2019-12-09', 1))).toEqual({ year: 2019, season: 'winter' });
    expect(seasonOf(wk('2020-02-10', 1))).toEqual({ year: 2019, season: 'winter' });
    expect(seasonOf(wk('2020-06-01', 1))).toEqual({ year: 2020, season: 'summer' });
  });
  it('중앙값과 변화율, 관측 주가 적으면 비움', () => {
    const weeks = [
      ...['2019-06-03', '2019-06-10', '2019-06-17', '2019-06-24', '2019-07-01'].map((d, i) => wk(d, 6000 + i * 100, i === 2)),
      ...['2023-06-05', '2023-06-12', '2023-06-19', '2023-06-26'].map((d) => wk(d, 4800)),
      wk('2024-06-03', 5000),
    ];
    const result = { weeks, eras: [] } as any;
    const c = compare({ kind: 'season', year: 2019, season: 'summer' }, { kind: 'season', year: 2023, season: 'summer' }, result, []);
    const steps = c.rows.find((r) => r.metric === 'steps')!;
    expect(steps.a).toEqual({ value: 6200, n: 5 });
    expect(steps.b).toEqual({ value: 4800, n: 4 });
    expect(steps.ratio).toBeCloseTo(-0.2258, 3);
    expect(c.a.candidates).toHaveLength(1);
    const c2 = compare({ kind: 'year', year: 2019 }, { kind: 'year', year: 2024 }, result, []);
    expect(c2.rows.find((r) => r.metric === 'steps')!.b.value).toBeNull(); // 2024년은 1주뿐
    expect(median([3, 1, 2, 4])).toBe(2.5);
    expect(periodOptions(result, [{ week: '2019-06-03', name: '여름 산책' }]).some((o) => o.name.includes('여름 산책'))).toBe(true);
  });
});
