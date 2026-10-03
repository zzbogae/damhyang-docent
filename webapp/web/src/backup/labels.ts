// 백업·복원: 붙인 이름(방의 재료), 편지, 기록 더하기(스크린타임 분·커밋 수). 기록 원문·사진은 담지 않는다.
// 편지는 사용자가 직접 쓴 글이라 내용이 들어간다(화면에 그렇게 알린다). /1(이름만) 파일도 그대로 읽는다.
import { db, type LabelRow } from '../db';
import { loadLetters, saveLetters, type Letter } from '../letters/letters';
import { loadExtras, saveExtras, type Extras } from '../extras/extras';

export interface LabelsFile {
  schema: 'mined.labels/1' | 'mined.labels/2'; exported_at: string;
  labels: { week: string; name: string; createdAt: string }[];
  letters?: Letter[];
  extras?: Extras;
}

export async function exportLabels(): Promise<LabelsFile> {
  const rows = await db.labels.toArray();
  return {
    schema: 'mined.labels/2',
    letters: await loadLetters(),
    extras: await loadExtras(),
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
  if (!f || (f.schema !== 'mined.labels/1' && f.schema !== 'mined.labels/2') || !Array.isArray(f.labels)) throw new Error('Mine D 백업 파일이 아닙니다');
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
  // 편지: 같은 id 는 한 번만. 이미 연 기록이 있으면 남긴다
  if (Array.isArray(f.letters) && f.letters.length) {
    const cur = await loadLetters();
    const ids = new Set(cur.map((l) => l.id));
    const fresh = f.letters.filter((l) => l && typeof l.id === 'string' && typeof l.text === 'string' && typeof l.opens_at === 'string' && !ids.has(l.id));
    if (fresh.length) await saveLetters([...cur, ...fresh]);
  }
  // 기록 더하기: 스크린타임은 (날짜, 종류)가 같으면 지금 것을 두고, 커밋은 날짜별로 큰 값
  if (f.extras && (f.extras.screen?.length || f.extras.git?.length)) {
    const cur = await loadExtras();
    const has = new Set(cur.screen.map((x) => `${x.date}|${x.kind}`));
    const screen = [...cur.screen, ...(f.extras.screen ?? []).filter((x) => !has.has(`${x.date}|${x.kind}`))];
    const git = new Map(cur.git.map((g) => [g.date, g.n]));
    for (const g of f.extras.git ?? []) git.set(g.date, Math.max(g.n, git.get(g.date) ?? 0));
    await saveExtras({ screen, git: [...git.entries()].map(([date, n]) => ({ date, n })).sort((a, b) => a.date.localeCompare(b.date)) });
  }
  return add.length;
}
