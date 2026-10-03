// 깃 커밋 기록(회의 질문 4). 외부 요청 없이, 사용자가 자기 저장소에서 뽑은 git log 결과 파일을 읽는다.
//   git log --author="$(git config user.email)" --date=iso-strict --pretty=format:%ad > mined_git.txt
// 기본 git log 출력(「Date:   Tue Mar 4 22:12:01 2025 +0900」)도 읽는다. 커밋 메시지는 저장하지 않고 날짜만 센다.
import { utcMsToLocal } from '../dates';

const ISO_RE = /(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?\s*(Z|[+-]\d{2}:?\d{2})?/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DEFAULT_RE = /^Date:\s+\w{3}\s+(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})\s+([+-]\d{4})/;

function tzMs(tz: string | undefined): number {
  if (!tz || tz === 'Z') return 0;
  const m = tz.match(/([+-])(\d{2}):?(\d{2})/)!;
  return (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) * 60000;
}

/** 텍스트 → 커밋 시각(UTC 밀리초) 목록 */
export function parseGitLog(text: string): number[] {
  const out: number[] = [];
  for (const line of text.split(/\r?\n/)) {
    const d = line.match(DEFAULT_RE);
    if (d) {
      const [, mon, day, hh, mm, ss, y, tz] = d;
      const mo = MONTHS.indexOf(mon);
      if (mo >= 0) out.push(Date.UTC(+y, mo, +day, +hh, +mm, +ss) - tzMs(tz));
      continue;
    }
    const m = line.match(ISO_RE);
    if (m) {
      const [y, mo, day] = m[1].split('-').map(Number);
      out.push(Date.UTC(y, mo - 1, day, +m[2], +m[3], +(m[4] ?? 0)) - tzMs(m[5] ?? '+09:00'));
    }
  }
  return out;
}

/** 커밋 시각 → 날짜별 커밋 수(한국 시간) */
export function commitsByDate(utcMs: number[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of utcMs) { const d = utcMsToLocal(t).date; m.set(d, (m.get(d) ?? 0) + 1); }
  return m;
}
