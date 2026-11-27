// 민디 자유 질문: 기기 안 규칙으로 정해진 질문에 잇고, 마음을 묻는 말은 판정하지 않는다
import { describe, expect, it } from 'vitest';
import { parseIntent } from '../src/mindi/intent';

describe('민디 자유 질문', () => {
  const cases: [string, unknown][] = [
    ['잠을 못 잔 주는 언제였어?', { kind: 'axis', axis: 'rest', dir: 'down' }],
    ['푹 잔 주 알려줘', { kind: 'axis', axis: 'rest', dir: 'up' }],
    ['많이 걸었던 때는?', { kind: 'axis', axis: 'move', dir: 'up' }],
    ['산책을 안 걸은 주', { kind: 'axis', axis: 'move', dir: 'down' }],
    ['연락 많이 주고받은 주', { kind: 'axis', axis: 'talk', dir: 'up' }],
    // 10/22 지표 넷: 유튜브는 근거 전용이라 축 질문으로 받지 않는다
    ['유튜브 많이 본 주', { kind: 'unknown' }],
    ['카톡을 적게 보낸 주는?', { kind: 'axis', axis: 'talk', dir: 'down' }],
    ['메모 남긴 주', { kind: 'axis_unclear', axis: 'lang' }],
    ['이 주랑 비슷한 주 있어?', { kind: 'question', id: 'similar' }],
    ['왜 이 주가 골라졌어', { kind: 'question', id: 'why' }],
    ['그 뒤엔 어떻게 됐어', { kind: 'question', id: 'after' }],
    ['그때 나 많이 힘들었지?', { kind: 'feeling' }],
    ['오늘 날씨 어때', { kind: 'unknown' }],
    // 11/27 보별: 그 주 전체를 묻는 말은 되묻지 않고 바로 답한다(「기록」만으로는 글 축이 아니다)
    ['이번주 나의 기록은 니가 보기에 어때? 안정적이야? 요즘 기운이 없는데...', { kind: 'overview' }],
    ['요즘 내 기록 평소 같아?', { kind: 'overview' }],
    ['요즘 잠은 어때?', { kind: 'axis_unclear', axis: 'rest' }],
  ];
  for (const [q, want] of cases) it(q, () => expect(parseIntent(q)).toEqual(want));
});
