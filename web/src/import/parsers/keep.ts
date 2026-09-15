// Keep 메모(Google Takeout JSON). 메모 원문은 MemoRecord 로 남긴다(필터 플래그는 memoFilter 가 채움).
import type { MemoRecord } from '../../types';
import type { Aggregator } from '../aggregate';
import { isoWeek, utcMsToLocal } from '../dates';
import { chars, isNight, nfc } from '../rules';

interface KeepNote {
  isTrashed?: boolean;
  title?: string;
  textContent?: string;
  listContent?: { text?: string }[];
  createdTimestampUsec?: number | string;
  userEditedTimestampUsec?: number | string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function parseKeep(text: string, entryPath: string, agg: Aggregator): MemoRecord | null {
  let note: KeepNote;
  try {
    note = JSON.parse(text);
  } catch {
    return null;
  }
  if (!note || note.isTrashed) return null;
  const body = nfc(
    note.textContent ?? (Array.isArray(note.listContent) ? note.listContent.map((x) => x?.text ?? '').join('\n') : ''),
  ).trim();
  const title = nfc(note.title ?? '').trim();
  if (!body && !title) return null;
  const usec = Number(note.createdTimestampUsec ?? note.userEditedTimestampUsec);
  if (!Number.isFinite(usec) || usec <= 0) return null;
  const t = utcMsToLocal(Math.floor(usec / 1000));
  const n = chars(body);
  agg.add(t.date, 'memo_n');
  if (n) agg.add(t.date, 'memo_chars', n);
  if (isNight(t.hour)) agg.add(t.date, 'memo_night_n');
  agg.touch('memo', t.date, 'keep');
  return {
    id: `keep:${entryPath}`,
    ts: `${t.date}T${pad(t.hour)}:${pad(t.minute)}`,
    date: t.date,
    week: isoWeek(t.date),
    hour: t.hour,
    text: body,
    chars: n,
    source: 'keep',
    ...(title ? { title } : {}),
  };
}
