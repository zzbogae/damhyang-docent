// 11/27 보별: 「이번주 기록 어때? 안정적이야? 요즘 기운이 없는데…」 → 선택지로 되묻지 않고 그 주 기록으로 먼저 답한다
import { describe, expect, it } from 'vitest';
import { axisNowAnswer, overviewAnswer } from '../src/mindi/answers';
import { feelingQuote, feelingWrap } from '../src/mindi/smalltalk';
import type { WeekRecord } from '../src/types';

const wk = (axes: Partial<Record<'move' | 'rest' | 'lang' | 'talk', number | null>>, candidate = false) => ({
  week: '2025-W52', date_start: '2025-12-22', date_end: '2025-12-28', candidate, badges: candidate ? [{}, {}] : [],
  axes: Object.fromEntries((['move', 'rest', 'lang', 'talk'] as const).map((k) => [k, axes[k] == null ? null : { pr: axes[k], n_base: 52 }])),
}) as unknown as WeekRecord;

const FORBIDDEN = [/우울|불안|진단|치료|증상|위험/, /슬프|외로|행복|지쳤/, /좋아질|나아질|괜찮아질|하세요|해 보세요/, /모릅니다|몰라요|모르겠/, /안정적|불안정/];

describe('그 주 전체 답', () => {
  it('평소 범위·벗어난 축을 함께 말하고, 좋다·나쁘다는 말하지 않는다', () => {
    const t = overviewAnswer(wk({ rest: 0.05, move: 0.5, lang: 0.8, talk: 0.4 })).text;
    expect(overviewAnswer(wk({ rest: 0.05, move: 0.08 })).text).toContain('잠·걸음은 평소보다 크게 적었습니다.');
    expect(t).toContain('잠은 평소보다 크게 적었고');
    expect(t).toContain('글은 평소보다 조금 많은 편이었고');
    expect(t).toContain('걸음·연락은 평소 범위였습니다.');
    expect(t).toContain('평소 흐름 안에 있던 주입니다.');
    for (const re of FORBIDDEN) expect(t).not.toMatch(re);
  });
  it('광석이 나온 주는 그렇게 말한다', () => {
    expect(overviewAnswer(wk({ rest: 0.95, move: 0.02 }, true)).text).toMatch(/지표가 2개 있어서 광석이 나온 주입니다\.$/);
  });
  it('기록이 없으면 지어내지 않는다', () => {
    expect(overviewAnswer(wk({})).text).toContain('견줄 기록이 아직 모자랍니다');
  });
  it('축 하나는 그 주 값부터', () => {
    expect(axisNowAnswer('rest', wk({ rest: 0.5 })).text).toBe('2025년 12월 22일 ~ 28일의 잠은 직전 1년의 내 기록과 견줘 평소 범위였습니다.');
    expect(axisNowAnswer('move', wk({ move: 0.2 })).text).toContain('걸음은 직전 1년의 내 기록과 견줘 평소보다 조금 적은 편이었습니다.');
  });
});

describe('기록을 물으며 꺼낸 마음', () => {
  it('어절 끝까지 되돌린다', () => {
    expect(feelingQuote('이번주 나의 기록은 어때? 요즘 기운이 없는데...')).toBe('기운이 없는데');
    expect(feelingQuote('이번 주 기록 어때?')).toBeNull();
  });
  it('네 말투 모두 되돌림 + 평가 아님 한 줄, 금지어 없음', () => {
    for (const v of ['quiet', 'warm', 'plain', 'dry'] as const) {
      const r = feelingWrap('요즘 기운이 없는데 이번 주 기록 어때?', v)!;
      expect(r.pre).toContain('「기운이 없는데」');
      expect(r.post).toContain('평가');
      for (const re of FORBIDDEN) { expect(r.pre).not.toMatch(re); expect(r.post).not.toMatch(re); }
    }
  });
});
