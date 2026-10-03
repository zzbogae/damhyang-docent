// 밤 기록 공백(quiet): 수면 기록이 없는 사람도 쉼 축을 볼 수 있게, 직접 남긴 활동 시각 사이의 가장 긴 밤 공백을 잰다.
// 팀 9/23 §1-2 「밤 무기록 구간의 대체 지표」. 잠을 잰 값이 아니라 「기록이 끊긴 시간」이다. 화면에서도 그렇게 부른다.
//
// 규칙(깨어난 날 D 에 붙인다, 수면 기록과 같은 방식):
// - 창: D-1 18:00 ~ D 14:00 에 있는 활동 시각
// - 창 안에서 이웃한 두 시각 사이의 가장 긴 간격을 고르되, 간격의 가운데가 D-1 22:00 ~ D 09:00 안이어야 한다
// - 공백 앞뒤가 모두 창 안의 활동이어야 하므로, 밤 앞이나 뒤에 기록이 없으면 그 밤은 재지 않는다
// - 2시간보다 짧거나 16시간보다 길면 버린다(밤이 아니거나, 기록을 안 한 날)
const H = 3600_000;
export const QUIET_MIN_H = 2;
export const QUIET_MAX_H = 16;

const dayStart = (ms: number) => Math.floor(ms / (24 * H)) * 24 * H;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** 벽시계 밀리초(LocalTime.ms) 목록 → 깨어난 날짜별 밤 공백(분) */
export function nightQuiet(stamps: number[]): Map<string, number> {
  const out = new Map<string, number>();
  if (stamps.length < 2) return out;
  const s = Float64Array.from(stamps).sort();
  const first = dayStart(s[0]) + 24 * H;
  const last = dayStart(s[s.length - 1]);
  let lo = 0;
  for (let D = first; D <= last; D += 24 * H) {
    const a = D - 6 * H, b = D + 14 * H;
    while (lo < s.length && s[lo] < a) lo++;
    let hi = lo;
    while (hi < s.length && s[hi] < b) hi++;
    if (hi - lo < 2) continue;
    let best = 0;
    for (let i = lo; i + 1 < hi; i++) {
      const g = s[i + 1] - s[i];
      const mid = s[i] + g / 2;
      if (g > best && mid >= D - 2 * H && mid <= D + 9 * H) best = g;
    }
    if (best >= QUIET_MIN_H * H && best <= QUIET_MAX_H * H) out.set(iso(D), Math.round(best / 60000));
  }
  return out;
}
