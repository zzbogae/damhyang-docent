// P7 광석 캐기 (10/23 버튼배치 확정): 광석 자체를 3번 탭 → 깨짐 → 하단 「관측소로 가져가기」(왼) / 「여기서 바로 보기」(오른, 강조)
import type { WeekRecord } from '../types';
export function Mine({ w, onCarry, onView }: { w: WeekRecord; onCarry: () => void; onView: () => void }) {
  void w; void onCarry; void onView;
  return null;
}
