import { describe, expect, it } from 'vitest';
import { orderPhotos } from '../src/photos/service';

const p = (id: string, date: string, hour: number) => ({ id, date, hour, path: id, week: '', name: id, size: 1, mime: 'image/jpeg', source: 'folder', hasExif: true } as any);

describe('한 주 사진 확인 순서', () => {
  const ps = [p('a1', '2024-03-04', 10), p('a2', '2024-03-04', 11), p('a3', '2024-03-04', 12), p('b1', '2024-03-05', 2), p('c1', '2024-03-06', 9)];
  it('날짜를 고르게 돌아가며 고른다', () => {
    expect(orderPhotos(ps, false).map((x) => x.id)).toEqual(['a1', 'b1', 'c1', 'a2', 'a3']);
  });
  it('새벽 사진 배지면 새벽 사진부터', () => {
    expect(orderPhotos(ps, true)[0].id).toBe('b1');
  });
});
