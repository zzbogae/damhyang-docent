// P5 MINDY'S LIFT 엘리베이터 (10/23 버튼배치 확정): 가운데 세로 그림(지상 관측소 → 지층 단면),
// 오른쪽 세로 층 표시기 + 위 ▲ / 아래 ▼(Time Machine), 하단 가운데 확인 쌍 「돌아가기 / ○○년으로 내려간다」(하빈 UI 시트).
// 층 이름은 연도만. 층마다 그해 기록 양을 작은 막대로(Wayback Machine 연도 막대) 보여 주되 좋고 나쁨 색으로 칠하지 않는다.
// 휠로도 한 층씩 움직인다. 연출 줄이기(OS 설정)가 켜져 있으면 하강 연출 없이 바로 넘어간다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { kitDescend, sfx } from '../mindi/soundKit';
import { ART } from './design';
import './lift.css';
import { YearStack } from './YearStack';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Lift({ onBack, onDescend }: { onBack: () => void; onDescend: (year: number) => void }) {
  const { weeks } = useStore();
  // 위가 최근, 아래로 오래됨. 그해 기록이 남은 주 수 = 막대 길이
  const floors = useMemo(() => {
    const m = new Map<number, number>();
    for (const w of weeks) {
      const y = Number(w.week.split('-W')[0]);
      const seen = Object.values(w.coverage).some((c) => c === 'observed') ? 1 : 0;
      m.set(y, (m.get(y) ?? 0) + seen);
    }
    return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([year, n]) => ({ year, n }));
  }, [weeks]);
  const max = Math.max(1, ...floors.map((f) => f.n));
  const first = Math.max(0, floors.findIndex((f) => f.n > 0));
  const [at, setAt] = useState(first);
  const [going, setGoing] = useState(false);
  const cur = floors[at];
  const move = (k: number) => {
    const n = Math.max(0, Math.min(floors.length - 1, k));
    if (n !== at) { sfx('floor'); setAt(n); }
  };
  const wheelAt = useRef(0);
  const onWheel = (e: React.WheelEvent) => {
    if (going || Math.abs(e.deltaY) < 8) return;
    const now = Date.now();
    if (now - wheelAt.current < 260) return;
    wheelAt.current = now;
    move(at + (e.deltaY > 0 ? 1 : -1));
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (going) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); move(at + 1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); move(at - 1); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const descend = async () => {
    if (!cur || going) return;
    sfx('confirm');
    if (reduced()) { onDescend(cur.year); return; }
    setGoing(true);
    await kitDescend(Math.min(1, (at + 1) / Math.max(1, floors.length)), 2.2);
    onDescend(cur.year);
  };
  if (!floors.length) return <p className="muted" style={{ padding: 80 }}>아직 내려갈 지층이 없습니다.</p>;
  return (
    <section className={`lift${going ? ' going' : ''}`} aria-label="민디의 리프트 · 엘리베이터" onWheel={onWheel}>
      <div className="lift-shaft" aria-hidden="true">
        <img src={ART.liftShaft} alt="" style={{ ['--lift-depth' as string]: String((at + 1) / (floors.length + 1)) }} />
        <div className="lift-shade" />
      </div>
      {going && cur && <YearStack years={floors.slice(0, at + 1).map((f) => f.year)} sec={2.2} />}
      <div className="lift-indicator">
        <button className="lift-arrow" onClick={() => move(at - 1)} disabled={at <= 0 || going} aria-label="한 층 위로">▲</button>
        <ol className="lift-floors" aria-label="층 표시기">
          <li className="lift-ground" aria-hidden="true">지상</li>
          {floors.map((f, k) => (
            <li key={f.year}>
              <button className={`lift-floor${k === at ? ' on' : ''}`} aria-current={k === at ? 'true' : undefined} disabled={going}
                onClick={() => move(k)} aria-label={`${f.year}년 · 기록 남은 주 ${f.n}주`}>
                <span className="lift-mark" aria-hidden="true">▶</span>{f.year}
                <i className="lift-bar" style={{ width: Math.max(2, Math.round((f.n / max) * 64)) }} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
        <button className="lift-arrow" onClick={() => move(at + 1)} disabled={at >= floors.length - 1 || going} aria-label="한 층 아래로">▼</button>
      </div>
      <div className="lift-confirm" role="group" aria-label="내려가기 확인">
        <button className="lift-btn" onClick={() => { sfx('back'); onBack(); }} disabled={going}>돌아가기</button>
        <button className="lift-btn primary" onClick={descend} disabled={going}>{cur.year}년으로 내려간다</button>
      </div>
      <p className="sr-only" role="status">{going ? `${cur.year}년으로 내려가는 중입니다` : `${cur.year}년을 골랐습니다`}</p>
    </section>
  );
}
