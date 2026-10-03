// 민디 소리: 사건 세 가지에만 소리가 있고, 같은 사건은 언제나 같은 소리다(내용에 따라 바뀌지 않음)
import { describe, expect, it } from 'vitest';
import { cueSyllables } from '../src/mindi/sound';

describe('민디 소리', () => {
  it('사건마다 정해진 음절이 있고 다시 불러도 같다', () => {
    for (const c of ['found', 'wait', 'mined'] as const) {
      expect(cueSyllables(c).length).toBeGreaterThan(1);
      expect(cueSyllables(c)).toEqual(cueSyllables(c));
    }
    expect(cueSyllables('found')).not.toEqual(cueSyllables('wait'));
  });
});
