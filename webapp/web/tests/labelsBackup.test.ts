import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { exportLabels, importLabels } from '../src/backup/labels';
import { loadLetters, makeLetter, saveLetters } from '../src/letters/letters';
import { loadExtras, saveExtras } from '../src/extras/extras';

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
  it('편지와 기록 더하기도 담고, 옛 /1 파일도 읽는다', async () => {
    await db.kv.clear();
    await saveLetters([makeLetter('내년의 나에게', 'year', new Date('2026-10-03T10:00:00'))]);
    await saveExtras({ screen: [{ id: 's', date: '2025-03-04', minutes: 263, kind: 'week_avg', file: 'a.png' }], git: [{ date: '2025-03-04', n: 2 }] });
    const f = await exportLabels();
    expect(f.schema).toBe('mined.labels/2');
    await db.kv.clear();
    await importLabels(f);
    expect((await loadLetters()).map((l) => l.text)).toEqual(['내년의 나에게']);
    expect((await loadExtras()).screen[0].minutes).toBe(263);
    await importLabels(f);
    expect(await loadLetters()).toHaveLength(1);
    await expect(importLabels({ schema: 'mined.labels/1', labels: [] })).resolves.toBe(0);
  });
});
