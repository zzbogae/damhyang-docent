// 앱 상태: IndexedDB 에서 판정 결과·메모·사진 색인·라벨을 읽어 화면에 나눠 준다.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { db, getKV, loadResult, setKV, type LabelRow } from '../db';
import type { MemoRecord, MinedResult, PhotoRecord, WeekRecord } from '../types';

export type Phase = 'boot' | 'empty' | 'working' | 'ready';

export interface Settings { voice: boolean; tone: boolean; large?: boolean }

export interface Progress {
  stage: string;
  detail?: string;
  channels?: Record<string, { files: number; records: number }>;
  done?: boolean;
}

interface Ctx {
  phase: Phase;
  setPhase: (p: Phase) => void;
  result?: MinedResult;
  weeks: WeekRecord[];
  byKey: Map<string, WeekRecord>;
  memosByWeek: Map<string, MemoRecord[]>;
  photosByWeek: Map<string, PhotoRecord[]>;
  labels: LabelRow[];
  selected?: string;
  select: (week?: string) => void;
  greeted: boolean;
  markGreeted: () => void;
  settings: Settings;
  setSettings: (s: Settings) => void;
  progress?: Progress;
  setProgress: (p?: Progress) => void;
  error?: string;
  setError: (e?: string) => void;
  reload: () => Promise<void>;
  addLabel: (week: string, name: string) => Promise<void>;
  removeLabel: (id: number) => Promise<void>;
  unlocked: Set<string>;
  unlock: (week: string) => void;
}

const C = createContext<Ctx | null>(null);

function group<T extends { week: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const a = m.get(r.week);
    if (a) a.push(r); else m.set(r.week, [r]);
  }
  return m;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('boot');
  const [result, setResult] = useState<MinedResult>();
  const [memosByWeek, setMemos] = useState<Map<string, MemoRecord[]>>(new Map());
  const [photosByWeek, setPhotos] = useState<Map<string, PhotoRecord[]>>(new Map());
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [selected, setSelected] = useState<string>();
  const [greeted, setGreeted] = useState(false);
  const [settings, setSettingsState] = useState<Settings>({ voice: true, tone: false });
  const [progress, setProgress] = useState<Progress>();
  const [error, setError] = useState<string>();
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    const r = await loadResult();
    const [memos, photos, labs, g, s] = await Promise.all([
      db.memos.toArray(), db.photos.toArray(), db.labels.toArray(), getKV<boolean>('greeted'), getKV<Settings>('settings'),
    ]);
    setResult(r);
    setMemos(group(memos));
    setPhotos(group(photos));
    setLabels(labs);
    setGreeted(!!g);
    if (s) setSettingsState(s);
    setPhase(r && r.weeks.length ? 'ready' : 'empty');
  }, []);

  useEffect(() => { reload().catch((e) => { setError(String(e)); setPhase('empty'); }); }, [reload]);
  useEffect(() => { document.documentElement.classList.toggle('large', !!settings.large); }, [settings.large]);

  const weeks = result?.weeks ?? [];
  const byKey = useMemo(() => new Map(weeks.map((w) => [w.week, w])), [weeks]);

  const value: Ctx = {
    phase, setPhase, result, weeks, byKey, memosByWeek, photosByWeek, labels,
    selected, select: setSelected,
    greeted,
    markGreeted: () => { setGreeted(true); setKV('greeted', true); },
    settings,
    setSettings: (s) => { setSettingsState(s); setKV('settings', s); },
    progress, setProgress, error, setError, reload,
    addLabel: async (week, name) => {
      const n = name.trim();
      if (!n) return;
      await db.labels.add({ week, name: n, createdAt: new Date().toISOString() });
      setLabels(await db.labels.toArray());
    },
    removeLabel: async (id) => {
      await db.labels.delete(id);
      setLabels(await db.labels.toArray());
    },
    unlocked,
    unlock: (w) => setUnlocked((s) => new Set(s).add(w)),
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useStore(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error('StoreProvider 밖에서 useStore 를 불렀습니다');
  return v;
}
