import { describe, expect, it } from 'vitest';
import { checkTone, facts } from '../src/mindi/tone';
import { sameDirectionText } from '../src/mindi/templates';

const T = '2019년 3월 4일부터의 한 주가 이번 주와 가장 닮았습니다. 두 주 모두 걸음수·수면 시간은 평소보다 적은 편이었습니다. 그 주에 쓴 글이 3개 남아 있습니다. 그때는 약 5주 뒤부터 평소의 흐름이 이어졌습니다.';

describe('민디 말투 검사', () => {
  it('숫자·날짜·순위를 그대로 둔 문장은 통과', () => {
    const out = '2019년 3월 4일부터의 한 주가 이번 주와 가장 닮아 있어요. 두 주 모두 걸음수와 수면 시간이 평소보다 적은 편이었어요. 그 주에 쓴 글이 3개 남아 있습니다. 그때는 약 5주 뒤부터 평소의 흐름이 이어졌습니다.';
    expect(checkTone(T, out).ok).toBe(true);
  });
  it('숫자를 바꾸면 거절', () => {
    const out = T.replace('5주', '4주');
    expect(checkTone(T, out).ok).toBe(false);
  });
  it('감정 판정·예측·조언은 거절', () => {
    expect(checkTone(T, T + ' 그때 많이 힘드셨죠.').ok).toBe(false);
    expect(checkTone(T, T.replace('이어졌습니다.', '이어졌으니 이번에도 곧 좋아질 거예요.')).ok).toBe(false);
    expect(checkTone(T, T + ' 산책을 해 보세요.').ok).toBe(false);
  });
  it('사실 추출', () => {
    expect(facts(T)).toContain('5주');
    expect(facts(T)).toContain('가장');
  });
  it('같은 방향 문장', () => {
    expect(sameDirectionText(['steps:down', 'yt_watch:up'])).toBe('두 주 모두 걸음수는 평소보다 적은 편이었고, 유튜브 시청 수는 평소보다 많은 편이었습니다.');
  });
});
