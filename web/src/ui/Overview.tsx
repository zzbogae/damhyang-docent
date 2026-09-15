// 오른쪽 칸 기본 화면: 민디 첫 인사, 최근 판정된 주 목록(큰 글씨로 누르기 쉽게), 시기.
import { useStore } from '../state/store';
import { MindiGreeting } from './Mindi';
import { rangeLabel } from '../mindi/templates';
import { IconArrow } from './Icons';

export function Overview() {
  const { weeks, select, result } = useStore();
  const recent = weeks.filter((w) => w.candidate).slice(-8).reverse();
  const eras = result?.eras ?? [];
  return (
    <div className="stack">
      <MindiGreeting />
      <section aria-labelledby="recent-title">
        <h2 id="recent-title" className="section-title">최근에 평소와 달랐던 주</h2>
        {recent.length === 0 && <p className="muted">아직 평소와 크게 달랐던 주가 없습니다. 기록이 1년 넘게 쌓이면 비교할 수 있습니다.</p>}
        <div className="sim">
          {recent.map((w) => (
            <button key={w.week} onClick={() => select(w.week)}>
              <span>{rangeLabel(w)}</span>
              <span className="muted small">{w.evidence.cross_validated ? `기록 ${w.evidence.independent}종` : '근거가 얇음'} <IconArrow style={{ width: 16, height: 16, verticalAlign: '-3px' }} /></span>
              <span className="why">{w.sentence?.split('. ')[0].replace(/^.*?한 주간, /, '')}.</span>
            </button>
          ))}
        </div>
      </section>
      {eras.length > 1 && (
        <section aria-labelledby="era-title">
          <h2 id="era-title" className="section-title">시기</h2>
          <p className="lede">여러 기록이 함께 달라진 지점으로 나눈 시기입니다.</p>
          {eras.slice().reverse().map((e) => (
            <div className="era" key={e.id}>
              <p className="span">{e.start.replaceAll('-', '.')} ~ {e.end.replaceAll('-', '.')} · {e.n_weeks}주</p>
              <p>평소와 달랐던 주 {e.n_candidates}개{e.boundary_indicators.length ? ` · 시작 지점에서 달라진 기록: ${e.boundary_indicators.length}개 지표` : ''}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
