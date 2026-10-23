// 광석은 처음엔 날짜로만 보이고, 광물 이름은 사용자가 예시 중에서 고르거나 직접 적는다
import { describe, expect, it } from 'vitest';
import { exampleNames, oreLabel } from '../src/ui/oreName';

describe('광석 이름', () => {
  it('이름을 붙이기 전에는 날짜만 보인다', () => {
    expect(oreLabel({ week: '2021-W16', date_start: '2021-04-19', mineral: '호박' })).toBe('2021년 4월 19일의 광석');
  });
  it('광석이 아닌 주는 이름이 없다', () => {
    expect(oreLabel({ week: '2021-W17', date_start: '2021-04-26', mineral: null })).toBe('');
  });
  it('예시 이름은 이 광석의 색에 맞는 이름이 맨 앞이고 9종 모두 고를 수 있다', () => {
    const names = exampleNames('청금석');
    expect(names[0]).toBe('청금석');
    expect(new Set(names).size).toBe(9);
  });
});
