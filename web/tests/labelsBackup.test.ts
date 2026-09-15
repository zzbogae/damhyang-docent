import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { exportLabels, importLabels } from '../src/backup/labels';

describe('붙인 이름 백업·복원', () => {
  it('내보내고 지운 뒤 다시 가져오면 같고, 두 번 가져와도 겹치지 않는다', async () => {
    await db.labels.clear();
    await db.labels.bulkAdd([
      { week: '2024-W10', name: '긴 겨울', createdAt: '2024-03-10T00:00:00Z' },
      { week: '2024-W11', name: '긴 겨울', createdAt: '2024-03-17T00:00:00Z' },
    ]);
    const f = await exportLabels();
    await db.labels.clear();
    expect(await importLabels(f)).toBe(2);
    expect(await importLabels(f)).toBe(0);
    expect((await db.labels.toArray()).map((l) => l.week).sort()).toEqual(['2024-W10', '2024-W11']);
    await expect(importLabels({ foo: 1 })).rejects.toThrow('백업 파일이 아닙니다');
  });
});
