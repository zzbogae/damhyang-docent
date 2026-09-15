// 날짜 도구. 모든 현지 시각은 한국 벽시계 시각이다(rules.ts).
import { KST_OFFSET_MS } from './rules';

export interface LocalTime {
  date: string; // YYYY-MM-DD
  hour: number;
  minute: number;
  ms: number; // 벽시계 시각을 UTC 로 가정했을 때의 밀리초(정렬·차이 계산용)
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** 벽시계 구성요소 → LocalTime */
export function wall(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): LocalTime {
  const ms = Date.UTC(y, mo - 1, d, h, mi, s);
  return { date: `${y}-${pad(mo)}-${pad(d)}`, hour: h, minute: mi, ms };
}

/** UTC 밀리초 → 한국 벽시계 */
export function utcMsToLocal(utcMs: number): LocalTime {
  const t = new Date(utcMs + KST_OFFSET_MS);
  return {
    date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
    ms: utcMs + KST_OFFSET_MS,
  };
}

/** "2023-01-01T12:34:56.789Z" 같은 ISO 문자열 → 한국 벽시계 */
export function isoToLocal(iso: string): LocalTime | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? utcMsToLocal(ms) : null;
}

/** "2019-01-01 08:00:00 +0900" (애플 건강) → 한국 벽시계 */
export function appleDateToLocal(s: string): LocalTime | null {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(s);
  if (!m) return null;
  const [, y, mo, d, h, mi, se, sign, oh, om] = m;
  const off = (Number(oh) * 60 + Number(om)) * (sign === '-' ? -1 : 1);
  const utc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se) - off * 60000;
  return utcMsToLocal(utc);
}

/** YYYY-MM-DD → ISO 주 'YYYY-Www' (월요일 시작) */
export function isoWeek(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dayNum = t.getUTCDay() || 7; // 월=1 … 일=7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum); // 그 주 목요일
  const wy = t.getUTCFullYear();
  const yearStart = Date.UTC(wy, 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${wy}-W${pad(week)}`;
}

/** 오전/오후 12시간제 → 24시간제 */
export function hour24(ampm: string, h: number): number {
  if (ampm === '오전' || /^am$/i.test(ampm)) return h === 12 ? 0 : h;
  return h === 12 ? 12 : h + 12;
}

/** 다른 IANA 시간대의 벽시계 시각 → 한국 벽시계(Intl 사용). Asia/Seoul 은 그대로. */
export function zonedWallToLocal(tzid: string, y: number, mo: number, d: number, h: number, mi: number, s: number): LocalTime {
  if (!tzid || tzid === 'Asia/Seoul') return wall(y, mo, d, h, mi, s);
  try {
    const guess = Date.UTC(y, mo - 1, d, h, mi, s);
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tzid, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
    const asWall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    const offset = asWall - guess; // 그 시간대의 UTC 오프셋
    return utcMsToLocal(guess - offset);
  } catch {
    return wall(y, mo, d, h, mi, s);
  }
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
