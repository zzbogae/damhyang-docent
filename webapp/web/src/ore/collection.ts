// 광석 두 갈래(10/23 광물 규칙 v4 §2·§4·§9·§10)와 캔 광석 모음.
// - 데이터 광석: 판정이 표시한 주(candidate). 겉색은 코어가 정한 mineral 그대로
// - 직접 고른 광석: 사용자가 아무 주나 골라 캐면 광석이 된다. 겉색 = 그 주에 가장 크게 벗어난 지표(축 대표 z, 없으면 백분위)와 방향
// 같은 데이터면 언제나 같은 광석이다(난수 없음). 캔 광석 목록은 이 기기 브라우저에만 둔다.
import { useEffect, useState } from 'react';
import { AXES, CHANNELS, type Axis, type Channel, type WeekRecord } from '../types';
import { MINERAL_BY_AXIS_DIR, type Mineral } from '../ui/minerals';

export interface PickedOre { mineral: Mineral; axis: Axis; dir: 'up' | 'down' }

/** 축 하나가 평소에서 얼마나 벗어났는지: z 가 있으면 |z|, 없으면 백분위가 가운데(0.5)에서 떨어진 정도를 z 와 비슷한 크기로 */
function deviation(a: NonNullable<WeekRecord['axes'][Axis]>): { size: number; dir: 'up' | 'down' } {
  if (typeof a.z === 'number' && Number.isFinite(a.z)) return { size: Math.abs(a.z), dir: a.z >= 0 ? 'up' : 'down' };
  return { size: Math.abs(a.pr - 0.5) * 4, dir: a.pr >= 0.5 ? 'up' : 'down' };
}

/**
 * 직접 고른 주의 겉색. 가장 크게 벗어난 축 × 방향으로 정한다(§4). 동률이면 걸음 → 수면 → 언어 → 소통 순서로 앞의 축.
 * 판정할 수 있는 축이 하나도 없으면 null(기록이 비어 색을 정할 수 없음).
 */
export function pickedMineral(w: WeekRecord): PickedOre | null {
  let best: { axis: Axis; size: number; dir: 'up' | 'down' } | null = null;
  for (const axis of AXES) {
    const a = w.axes[axis];
    if (!a) continue;
    const d = deviation(a);
    if (!best || d.size > best.size) best = { axis, ...d };
  }
  if (!best) return null;
  return { mineral: MINERAL_BY_AXIS_DIR[best.axis][best.dir], axis: best.axis, dir: best.dir };
}

/** 이 주의 광석 겉색: 데이터 광석이면 코어 값, 아니면 직접 고른 광석 규칙 */
export function oreMineral(w: WeekRecord): Mineral | null {
  if (w.candidate && w.mineral) return w.mineral as Mineral;
  return pickedMineral(w)?.mineral ?? null;
}

/**
 * §9 「그 주에 평소 있던 기록 중 N종이 비어 있습니다」. 평소 있던 기록 = 직전 52주 중 절반 넘게 관측된 계열.
 * 밤 공백(quiet)은 다른 기록에서 잰 값이라 세지 않는다.
 */
export function missingUsual(w: WeekRecord, weeks: WeekRecord[]): Channel[] {
  const i = weeks.findIndex((x) => x.week === w.week);
  if (i <= 0) return [];
  const prev = weeks.slice(Math.max(0, i - 52), i);
  return CHANNELS.filter((c) => c !== 'quiet'
    && prev.filter((p) => p.coverage[c] === 'observed').length > prev.length / 2
    && w.coverage[c] !== 'observed');
}

export interface Collected { week: string; picked: boolean; at: string }
const KEY = 'mined.collected.v1';
const EVT = 'mined:collected';

export function loadCollected(): Collected[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Collected[]) : [];
  } catch {
    return [];
  }
}

/** 캔 광석을 모음에 넣는다. 같은 주를 다시 캐도 한 번만 센다 */
export function collect(w: WeekRecord): void {
  const all = loadCollected();
  if (all.some((c) => c.week === w.week)) return;
  all.push({ week: w.week, picked: !w.candidate, at: new Date().toISOString() });
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* 사생활 보호 창: 이번 화면에서만 */ }
  window.dispatchEvent(new Event(EVT));
}

export function clearCollected(): void {
  try { localStorage.removeItem(KEY); } catch { /* 없음 */ }
  window.dispatchEvent(new Event(EVT));
}

/** 나의 공간이 열리는 광석 수(§10) */
export const SPACE_NEED = 3;

export function useCollected(): Collected[] {
  const [list, setList] = useState<Collected[]>(loadCollected);
  useEffect(() => {
    const on = () => setList(loadCollected());
    window.addEventListener(EVT, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(EVT, on); window.removeEventListener('storage', on); };
  }, []);
  return list;
}
