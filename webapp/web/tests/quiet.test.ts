import { describe, expect, it } from 'vitest';
import { nightQuiet } from '../src/import/quiet';
import { wall } from '../src/import/dates';

const t = (d: number, h: number, mi = 0) => wall(2026, 3, d, h, mi).ms;

describe('밤 기록 공백', () => {
  it('밤의 가장 긴 공백을 깨어난 날에 붙인다', () => {
    const q = nightQuiet([t(1, 9), t(1, 23, 30), t(2, 7, 0), t(2, 12)]);
    expect(q.get('2026-03-02')).toBe(450);
  });
  it('낮 공백은 밤 공백으로 세지 않는다', () => {
    // 밤새 한 시간마다 기록이 있고, 3/2 10시~18시 공백(가운데 14시)만 길다
    const night = [22, 23].map((h) => t(1, h)).concat([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => t(2, h)));
    const q = nightQuiet([...night, t(2, 18)]);
    expect(q.has('2026-03-02')).toBe(false);
  });
  it('밤 앞이나 뒤에 기록이 없으면 재지 않는다', () => {
    const q = nightQuiet([t(1, 9), t(1, 12), t(3, 9)]);
    expect(q.has('2026-03-02')).toBe(false);
  });
});
