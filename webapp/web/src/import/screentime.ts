// 스크린타임 캡처(아이폰 스크린 타임·삼성 디지털 웰빙)에서 읽은 줄 → 사용 시간(분). OCR 결과를 해석만 하고 저장하지 않는다.
// 어느 날의 값인지는 캡처 파일의 날짜에서 정하고, 사용자가 화면에서 고칠 수 있다.
import type { OcrLine } from '../ocr/ocr';

export type ScreenKind = 'day' | 'week_avg';
export interface ScreenReading { minutes: number; kind: ScreenKind; label: string; offsetDays: number }

const NUM = '(\\d{1,2})';
const DUR_RES: [RegExp, (m: RegExpMatchArray) => number][] = [
  [new RegExp(`${NUM}\\s*시간\\s*${NUM}\\s*분`), (m) => +m[1] * 60 + +m[2]],
  [new RegExp(`${NUM}\\s*h(?:r|rs)?\\s*${NUM}\\s*m(?:in)?`, 'i'), (m) => +m[1] * 60 + +m[2]],
  [new RegExp(`${NUM}\\s*시간`), (m) => +m[1] * 60],
  [/(\d{1,3})\s*분/, (m) => +m[1]],
  [new RegExp(`${NUM}\\s*h(?:r|rs)?\\b`, 'i'), (m) => +m[1] * 60],
  [/(\d{1,3})\s*m(?:in)?\b/i, (m) => +m[1]],
];

export function parseDuration(text: string): number | null {
  const t = text.replace(/\s+/g, ' ');
  for (const [re, f] of DUR_RES) {
    const m = t.match(re);
    if (m) {
      const v = f(m);
      return v > 0 && v <= 24 * 60 ? v : null;
    }
  }
  return null;
}

const WEEK_AVG_RE = /(일일\s*평균|하루\s*평균|daily\s*average)/i;
const DAY_RE = /(오늘|어제|today|yesterday|스크린\s*타임|화면\s*시간|사용\s*시간)/i;
const YESTERDAY_RE = /(어제|yesterday)/i;
// 앱별·카테고리별 줄은 그날 전체 값이 아니므로 기준 문구 바로 근처의 값만 쓴다
const MAX_GAP = 0.12;

/** 기준 문구(일일 평균·오늘 등) 바로 아래나 옆에 있는 시간을 고른다. 기준 문구가 없으면 화면 위쪽 40% 안의 첫 시간. */
export function readScreenTime(lines: OcrLine[]): ScreenReading | null {
  const durs = lines.map((l) => ({ l, v: parseDuration(l.text) })).filter((x) => x.v !== null) as { l: OcrLine; v: number }[];
  if (!durs.length) return null;
  const anchor = lines.find((l) => WEEK_AVG_RE.test(l.text)) ?? lines.find((l) => DAY_RE.test(l.text));
  const kind: ScreenKind = anchor && WEEK_AVG_RE.test(anchor.text) ? 'week_avg' : 'day';
  const offsetDays = lines.some((l) => YESTERDAY_RE.test(l.text)) ? -1 : 0;
  if (anchor) {
    const own = parseDuration(anchor.text);
    if (own !== null) return { minutes: own, kind, label: anchor.text, offsetDays };
    const near = durs.filter((d) => d.l.y >= anchor.y - 0.01 && d.l.y - anchor.y <= MAX_GAP).sort((a, b) => a.l.y - b.l.y)[0];
    if (near) return { minutes: near.v, kind, label: `${anchor.text} ${near.l.text}`, offsetDays };
  }
  const top = durs.filter((d) => d.l.y <= 0.4).sort((a, b) => a.l.y - b.l.y)[0];
  return top ? { minutes: top.v, kind, label: top.l.text, offsetDays } : null;
}

/** 캡처 파일 이름에서 날짜를 읽는다(아이폰 공유·안드로이드 Screenshot_20250304-221233·맥 「스크린샷 2025-03-04」). 없으면 null */
export function dateFromName(name: string): string | null {
  const m = name.match(/(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
  return `${y}-${mo}-${d}`;
}
