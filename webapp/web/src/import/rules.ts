// 가져오기 규칙(docs/import_rules.md)의 TypeScript 판. synth/rules.py 와 같은 규칙이어야 한다.

export const KST_OFFSET_MS = 9 * 3600 * 1000; // 한국 시간 UTC+9, 서머타임 없음
export const NIGHT_HOURS: [number, number] = [0, 5]; // 현지 00:00~04:59
export const REPLY_CAP_MIN = 360;
export const SLEEP_SESSION_GAP_MIN = 90;

/** 1인칭: 토큰 앞뒤의 글자·숫자가 아닌 문자를 떼어 낸 뒤 이 패턴과 맞으면 1인칭 토큰 */
export const FIRST_PERSON_RE = /^(나|내|저|제)(는|도|가|를|랑|한테|에게|만)?$/u;
/** 단정어: 부분 문자열로 찾는다 */
export const ASSERTIVE_WORDS = ['반드시', '절대', '무조건', '항상', '전혀', '당연히', '확실히', '분명히', '틀림없이', '결코'];

export const SLEEP_ASLEEP_VALUES = new Set([
  'HKCategoryValueSleepAnalysisAsleep',
  'HKCategoryValueSleepAnalysisAsleepCore',
  'HKCategoryValueSleepAnalysisAsleepDeep',
  'HKCategoryValueSleepAnalysisAsleepREM',
  'HKCategoryValueSleepAnalysisAsleepUnspecified',
]);

export const SCREENSHOT_NAME_RE = /(screenshot|스크린샷|screen shot)/i;

export function nfc(s: string): string {
  return s.normalize('NFC');
}

/** 유니코드 코드 포인트 수(NFC 정규화 뒤) */
export function chars(s: string): number {
  let n = 0;
  for (const _ of nfc(s)) n++;
  return n;
}

export function isNight(hour: number): boolean {
  return hour >= NIGHT_HOURS[0] && hour < NIGHT_HOURS[1];
}

const EDGE_RE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

export function isFirstPerson(text: string): boolean {
  for (const tok of text.split(/\s+/)) {
    if (!tok) continue;
    if (FIRST_PERSON_RE.test(tok.replace(EDGE_RE, ''))) return true;
  }
  return false;
}

export function isAssertive(text: string): boolean {
  return ASSERTIVE_WORDS.some((w) => text.includes(w));
}
