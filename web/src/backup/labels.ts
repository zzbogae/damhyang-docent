// 붙인 이름(방의 재료) 백업·복원. 이름과 주 번호, 붙인 날만 담는다(원문·사진 없음).
import { db, type LabelRow } from '../db';

export interface LabelsFile { schema: 'mined.labels/1'; exported_at: string; labels: { week: string; name: string; createdAt: string }[] }

export async function exportLabels(): Promise<LabelsFile> {
  const rows = await db.labels.toArray();
  return {
    schema: 'mined.labels/1',
    exported_at: new Date().toISOString(),
    labels: rows
      .map((r) => ({ week: r.week, name: r.name, createdAt: r.createdAt }))
      .sort((a, b) => a.week.localeCompare(b.week) || a.name.localeCompare(b.name, 'ko')),
  };
}

const key = (week: string, name: string) => JSON.stringify([week, name]);

/** 같은 주·같은 이름은 한 번만 둔다. 새로 더한 개수를 돌려준다. */
export async function importLabels(j: unknown): Promise<number> {
  const f = j as LabelsFile;
  if (!f || f.schema !== 'mined.labels/1' || !Array.isArray(f.labels)) throw new Error('붙인 이름 백업 파일이 아닙니다');
  const have = new Set((await db.labels.toArray()).map((r) => key(r.week, r.name)));
  const add: LabelRow[] = [];
  for (const l of f.labels) {
    if (typeof l.week !== 'string' || !/^\d{4}-W\d{2}$/.test(l.week) || typeof l.name !== 'string' || !l.name.trim()) continue;
    const name = l.name.trim().slice(0, 24);
    const k = key(l.week, name);
    if (have.has(k)) continue;
    have.add(k);
    add.push({ week: l.week, name, createdAt: typeof l.createdAt === 'string' ? l.createdAt : new Date().toISOString() });
  }
  if (add.length) await db.labels.bulkAdd(add);
  return add.length;
}
