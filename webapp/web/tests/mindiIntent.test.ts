// 민디 자유 질문: 기기 안 규칙으로 정해진 질문에 잇고, 마음을 묻는 말은 판정하지 않는다
import { describe, expect, it } from 'vitest';
import { parseIntent } from '../src/mindi/intent';

describe('민디 자유 질문', () => {
  const cases: [string, unknown][] = [
    ['잠을 못 잔 주는 언제였어?', { kind: 'axis', axis: 'rest', dir: 'down' }],
    ['푹 잔 주 알려줘', { kind: 'axis', axis: 'rest', dir: 'up' }],
    ['많이 걸었던 때는?', { kind: 'axis', axis: 'move', dir: 'up' }],
    ['산책을 안 걸은 주', { kind: 'axis', axis: 'move', dir: 'down' }],
    ['유튜브 많이 본 주', { kind: 'axis', axis: 'watch', dir: 'up' }],
    ['사진을 적게 찍은 주는?', { kind: 'axis', axis: 'leave', dir: 'down' }],
    ['메모 남긴 주', { kind: 'axis_unclear', axis: 'leave' }],
    ['이 주랑 비슷한 주 있어?', { kind: 'question', id: 'similar' }],
    ['왜 이 주가 골라졌어', { kind: 'question', id: 'why' }],
    ['그 뒤엔 어떻게 됐어', { kind: 'question', id: 'after' }],
    ['그때 나 많이 힘들었지?', { kind: 'feeling' }],
    ['오늘 날씨 어때', { kind: 'unknown' }],
  ];
  for (const [q, want] of cases) it(q, () => expect(parseIntent(q)).toEqual(want));
});
