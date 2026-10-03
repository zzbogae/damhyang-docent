// 여는 화면(9/12 회의 5번 「이게 힐링인가」): 15년치 격자·순위 대신 가장 최근에 글이나 사진이 남은 주를 먼저 보여 준다.
// 날짜 순서로만 고른다(판정·추천으로 고르지 않음). 글·사진이 없으면 가장 최근 기록이 있는 주.
// 9/12 에는 「민디가 고른 한 주」로 열겠다고 했지만, 팀 9/23 원칙 3(앱이 고른 것으로 먼저 말 걸지 않는다)에 따라
// 앱이 고르지 않는 이번 주로 연다. 닮은 주 찾기는 민디 인사에서 사용자가 누를 때만 한다.
import { useStore } from '../state/store';
import { MindiGreeting } from './Mindi';
import { WeekDetail } from './WeekDetail';

export function Overview() {
  const { weeks, memosByWeek, photosByWeek } = useStore();
  const rev = [...weeks].reverse();
  const latest = rev.find((w) => (memosByWeek.get(w.week)?.length ?? 0) + (photosByWeek.get(w.week)?.length ?? 0) > 0)
    ?? rev.find((w) => Object.values(w.coverage).some((c) => c === 'observed'));
  return (
    <div className="stack">
      <MindiGreeting />
      {latest ? (
        <section aria-label="가장 최근에 남은 기록">
          <p className="small muted">가장 최근에 남은 기록 · 다른 주는 왼쪽 지층에서 칸을 눌러 엽니다.</p>
          <WeekDetail w={latest} key={latest.week} />
        </section>
      ) : <p className="muted">아직 가져온 기록이 없습니다.</p>}
    </div>
  );
}
