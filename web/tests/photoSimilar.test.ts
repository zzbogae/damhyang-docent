// 비슷한 사진 묶기: 차이 해시와 해밍 거리, 시각을 함께 본 묶음.
import { describe, expect, it } from 'vitest';
import { colorDist, dhashFromGray, dhashFromRgba, groupSimilar, hamming } from '../src/photos/similar';

/** 9×8 흑백 화소를 함수로 만든다 */
const img = (f: (x: number, y: number) => number) => Array.from({ length: 72 }, (_, i) => f(i % 9, Math.floor(i / 9)));

describe('비슷한 사진', () => {
  it('차이 해시: 왼쪽이 밝으면 1, 64비트 16진수', () => {
    expect(dhashFromGray(img((x) => 255 - x * 20))).toBe('ffffffffffffffff');
    expect(dhashFromGray(img((x) => x * 20))).toBe('0000000000000000');
    expect(hamming('ffffffffffffffff', '0000000000000000')).toBe(64);
    expect(hamming('ff00000000000000', 'fe00000000000000')).toBe(1);
  });

  it('가까운 시각의 비슷한 사진은 한 묶음, 다른 장면·먼 시각은 따로', () => {
    const base = dhashFromGray(img((x, y) => (x * 31 + y * 17) % 97));
    const near = base.slice(0, 15) + ((parseInt(base[15], 16) ^ 0b11).toString(16)); // 2비트 다름
    const other = dhashFromGray(img((x, y) => (x * 7 + y * 53) % 89));
    expect(hamming(base, other)).toBeGreaterThan(10);
    const g = groupSimilar([
      { id: 'a', dh: base, date: '2025-06-23', hour: 10, minute: 1 },
      { id: 'b', dh: near, date: '2025-06-23', hour: 10, minute: 2 },
      { id: 'c', dh: other, date: '2025-06-23', hour: 10, minute: 3 },
      { id: 'd', dh: near, date: '2025-06-25', hour: 18 }, // 이틀 뒤라도 해시가 거의 같으면(4비트 이하) 같은 사진으로 묶는다
      { id: 'e', date: '2025-06-23', hour: 10, minute: 4 }, // 해시 없음: 따로
    ]);
    expect(g.map((x) => x.members.map((m) => m.id))).toEqual([['a', 'b', 'd'], ['c'], ['e']]);
    // 이틀 뒤 사진이 조금 다르면(8비트) 먼 시각 기준(4비트)을 넘어 따로 둔다
    const far = base.slice(0, 14) + 'ff';
    expect(hamming(far, base)).toBeGreaterThan(4);
    const g2 = groupSimilar([
      { id: 'a', dh: base, date: '2025-06-23', hour: 10 },
      { id: 'x', dh: far, date: '2025-06-25', hour: 10 },
    ]);
    expect(g2).toHaveLength(2);
    // 같은 사진이 한 주 안에서 멀리 떨어져 되풀이돼도(저장 경로가 다른 복사본 등) 한 묶음이 된다
    const others = Array.from({ length: 12 }, (_, i) => ({ id: `o${i}`, dh: dhashFromGray(img((x, y) => ((x + 3) * (i + 5) * 13 + y * 29 * (i + 1)) % 251)), date: '2025-06-24', hour: i }));
    const g3 = groupSimilar([{ id: 'a', dh: base, date: '2025-06-23', hour: 9 }, ...others, { id: 'z', dh: base, date: '2025-06-28', hour: 20 }]);
    expect(g3.find((x) => x.rep.id === 'a')!.members.map((m) => m.id)).toEqual(['a', 'z']);
  });

  it('무늬 없는 사진은 평균 색이 다르면 묶지 않는다', () => {
    const flat = (r: number, g: number, b: number) => dhashFromRgba(Array.from({ length: 72 }, () => [r, g, b, 255]).flat());
    const blue = flat(40, 90, 200), sky = flat(50, 100, 210), red = flat(200, 40, 40);
    expect(hamming(blue, red)).toBe(0); // 차이 해시만으로는 구분이 안 된다
    expect(colorDist(blue, sky)).toBe(10);
    expect(colorDist(blue, red)).toBe(160);
    const g = groupSimilar([
      { id: 'b', dh: blue, date: '2025-01-01', hour: 9 },
      { id: 's', dh: sky, date: '2025-01-01', hour: 9 },
      { id: 'r', dh: red, date: '2025-01-01', hour: 9 },
    ]);
    expect(g.map((x) => x.members.map((m) => m.id))).toEqual([['b', 's'], ['r']]);
  });
});
