// 편지(미래 축, 팀 9/23 §1-10): 지금의 내가 미래에 편지를 두고, 미래의 내가 캔다.
// 알림은 보내지 않는다. 웹앱은 1년 뒤 알림을 보장할 수 없고(서비스 워커가 그만큼 살아 있지 않다), 외부 요청 0건도 지켜야 해서
// 「앱을 열었을 때 발견하는」 구조로 둔다. 열릴 날짜(D-day)는 화면에 내지 않는다. 3년 받침대는 열 때가 와도 먼저 알리지 않는다.
import { getKV, setKV } from '../db';

export type Horizon = 'day' | 'week' | 'month' | 'year' | 'year3';
export const HORIZONS: { id: Horizon; label: string }[] = [
  { id: 'day', label: '다음 날' }, { id: 'week', label: '다음 주' }, { id: 'month', label: '다음 달' },
  { id: 'year', label: '1년 후' }, { id: 'year3', label: '3년 후' },
];

export interface Letter {
  id: string;
  horizon: Horizon;
  text: string;
  written_at: string; // ISO 시각
  opens_at: string; // ISO 시각. 화면에는 내지 않는다
  opened_at?: string;
}

export function opensAt(written: Date, h: Horizon): Date {
  const d = new Date(written);
  if (h === 'day') d.setDate(d.getDate() + 1);
  else if (h === 'week') d.setDate(d.getDate() + 7);
  else if (h === 'month') d.setMonth(d.getMonth() + 1);
  else if (h === 'year') d.setFullYear(d.getFullYear() + 1);
  else d.setFullYear(d.getFullYear() + 3);
  return d;
}

export function makeLetter(text: string, h: Horizon, now = new Date()): Letter {
  return {
    id: `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    horizon: h, text, written_at: now.toISOString(), opens_at: opensAt(now, h).toISOString(),
  };
}

export const isDue = (l: Letter, now = new Date()) => new Date(l.opens_at).getTime() <= now.getTime();

/** 앱을 열었을 때 머리말에 조용히 보여 줄 수: 열 때가 왔고 아직 안 연 편지. 3년 받침대는 세지 않는다(알람 없음). */
export function arrivedCount(ls: Letter[], now = new Date()): number {
  return ls.filter((l) => !l.opened_at && l.horizon !== 'year3' && isDue(l, now)).length;
}

export async function loadLetters(): Promise<Letter[]> {
  return (await getKV<Letter[]>('letters')) ?? [];
}
export async function saveLetters(ls: Letter[]) {
  await setKV('letters', ls);
}
