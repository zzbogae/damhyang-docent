// 실제 기록 평가(참가자 쪽): 사건 검사·봉인 해시, 가린 주 뽑기, 피셔 검정, 보고서 날짜 차단.
import { describe, expect, it } from 'vitest';
import {
  buildReport, canonicalEvents, checkEvent, EMPTY_STATE, type EvalEvent, findDates, fisherGreater, hashEvents,
  participantOk, ratingStats, sampleForRating,
} from '../src/eval/field';
import type { WeekRecord } from '../src/types';

function weeks(n: number, cand: number[], unjudged: number[] = []): WeekRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    week: `W${i}`, candidate: cand.includes(i),
    ind: { steps: { v: 1, pr: unjudged.includes(i) ? null : 0.5, n_base: 52, rank_low: 1, rank_high: 1 } },
  }) as unknown as WeekRecord);
}

describe('사건 적기와 봉인', () => {
  it('날짜 순서·미래·기간·계속되는 변화의 끝난 날을 검사한다', () => {
    const t = '2026-09-12';
    expect(checkEvent({ start: '', kind: 'hard' }, t)).toMatch('시작한 날');
    expect(checkEvent({ start: '2026-10-01', kind: 'hard' }, t)).toMatch('오늘보다');
    expect(checkEvent({ start: '2024-03-10', end: '2024-03-01', kind: 'good' }, t)).toMatch('앞섭니다');
    expect(checkEvent({ start: '2024-01-01', end: '2024-06-30', kind: 'hard' }, t)).toMatch('넉 달');
    expect(checkEvent({ start: '2024-01-01', end: '2024-01-05', kind: 'change' }, t)).toMatch('시작한 날만');
    expect(checkEvent({ start: '2024-03-01', end: '2024-03-10', kind: 'hard' }, t)).toBeNull();
  });

  it('봉인 해시는 메모와 적은 순서에 흔들리지 않는다', async () => {
    const a: EvalEvent[] = [
      { id: '1', start: '2024-03-01', end: '2024-03-10', kind: 'hard', note: '독감' },
      { id: '2', start: '2022-02-01', kind: 'change' },
    ];
    const b: EvalEvent[] = [{ ...a[1], note: '이사' }, { ...a[0], note: undefined, id: 'x' }];
    expect(canonicalEvents(a)).toBe('2022-02-01||change\n2024-03-01|2024-03-10|hard');
    expect(await hashEvents(a)).toBe(await hashEvents(b));
    expect(await hashEvents(a)).not.toBe(await hashEvents([a[0]]));
    expect(await hashEvents(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('가린 주 기억해 보기', () => {
  it('판정된 주와 평범한 주를 같은 수만큼 뽑고, 평범한 주는 판정된 주 앞뒤 2주를 피한다', () => {
    const ws = weeks(120, [10, 11, 30, 50, 70, 90, 100], [0, 1, 2]);
    const s = sampleForRating(ws, 42, 5);
    expect(s.filter((x) => x.group === 'c')).toHaveLength(5);
    expect(s.filter((x) => x.group === 'n')).toHaveLength(5);
    const idx = (w: string) => Number(w.slice(1));
    for (const x of s.filter((y) => y.group === 'n')) {
      expect([10, 11, 30, 50, 70, 90, 100].every((c) => Math.abs(idx(x.week) - c) > 2)).toBe(true);
      expect([0, 1, 2]).not.toContain(idx(x.week));
    }
    expect(new Set(s.map((x) => x.week)).size).toBe(10);
    expect(sampleForRating(ws, 42, 5)).toEqual(s); // 같은 씨앗이면 같은 표본
    expect(sampleForRating(weeks(40, [3, 4]), 1, 10)).toHaveLength(4); // 판정된 주가 적으면 그 수에 맞춘다
  });

  it('피셔 정확 검정(한쪽)', () => {
    expect(fisherGreater(8, 2, 2, 8)).toBeCloseTo(2126 / 184756, 6);
    expect(fisherGreater(0, 5, 5, 0)).toBeCloseTo(1, 9);
    expect(fisherGreater(0, 0, 0, 0)).toBe(1);
  });

  it('모르겠다는 답은 비율 계산에서 뺀다', () => {
    const r = ratingStats([
      { week: 'a', group: 'c', answer: 'yes' }, { week: 'b', group: 'c', answer: 'yes' }, { week: 'c', group: 'c', answer: 'unsure' },
      { week: 'd', group: 'n', answer: 'no' }, { week: 'e', group: 'n', answer: 'yes' }, { week: 'f', group: 'n' },
    ]);
    expect(r).toMatchObject({ n_candidates: 3, n_controls: 2, yes_candidates: 2, unsure_candidates: 1, rate_candidates: 1, rate_controls: 0.5, lift: 2 });
  });
});

describe('보고서', () => {
  it('날짜가 섞이면 만들지 않고, 봉인·가린 평가를 붙인다', () => {
    expect(findDates({ a: ['2024-03-01'], b: { '2021-W07': 1 }, c: '2026-09' })).toEqual(['/a[0]', '/b/2021-W07(key)']);
    const st = { ...EMPTY_STATE, participant: 'P1', sealedHash: 'ab', sealedBeforeResult: true, seals: 1,
      ratings: [{ week: 'x', group: 'c' as const, answer: 'yes' as const }] };
    const rep = buildReport({ schema: 'mined.fieldeval/1', result: { n_candidates: 3 } }, st, new Date(2026, 8, 12));
    expect(rep).toMatchObject({ participant: 'P1', created_month: '2026-09', seal: { sealed: true, before_result: true, seals: 1 } });
    expect((rep.ratings as any).yes_candidates).toBe(1);
    expect(() => buildReport({ channels: { memo: { sources: ['keep-2024-01-02'] } } }, st)).toThrow('날짜');
  });

  it('참가 코드는 짧은 영문·숫자만, 한글 이름과 연도처럼 보이는 숫자는 받지 않는다', () => {
    expect(participantOk('P1')).toBe(true);
    expect(participantOk('team-a_2')).toBe(true);
    expect(participantOk('참가자3')).toBe(false);
    expect(participantOk('')).toBe(false);
    expect(participantOk('kim1987')).toBe(false);
    expect(participantOk('a b')).toBe(false);
  });
});
