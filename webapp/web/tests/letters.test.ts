import { describe, expect, it } from 'vitest';
import { arrivedCount, isDue, makeLetter, opensAt } from '../src/letters/letters';

describe('편지', () => {
  const t0 = new Date('2026-10-03T10:00:00');
  it('받침대마다 열릴 때를 정한다', () => {
    expect(opensAt(t0, 'day').toISOString()).toBe(new Date('2026-10-04T10:00:00').toISOString());
    expect(opensAt(t0, 'week').getDate()).toBe(10);
    expect(opensAt(t0, 'month').getMonth()).toBe(10);
    expect(opensAt(t0, 'year').getFullYear()).toBe(2027);
    expect(opensAt(t0, 'year3').getFullYear()).toBe(2029);
  });
  it('열 때가 온 편지만 세고, 3년 받침대는 먼저 알리지 않는다', () => {
    const a = makeLetter('a', 'day', t0);
    const b = makeLetter('b', 'year3', t0);
    const later = new Date('2030-01-01T00:00:00');
    expect(isDue(a, t0)).toBe(false);
    expect(arrivedCount([a, b], later)).toBe(1);
    expect(isDue(b, later)).toBe(true);
    expect(arrivedCount([{ ...a, opened_at: later.toISOString() }, b], later)).toBe(0);
  });
});
