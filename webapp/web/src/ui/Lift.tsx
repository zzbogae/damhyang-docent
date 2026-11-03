// P5 MINDY'S LIFT 엘리베이터 (10/23 버튼배치 확정): 가운데 세로 그림(지상 관측소 → 지층 단면),
// 오른쪽 세로 층 표시기 + 위 ▲ / 아래 ▼(Time Machine), 하단 가운데 확인 쌍 「돌아가기 / ○○년으로 내려간다」(하빈 UI 시트).
// 층 이름은 연도만. 층마다 그해 기록 양을 작은 막대로(Wayback Machine 연도 막대) 보여 주되 좋고 나쁨 색으로 칠하지 않는다.
// 휠로도 한 층씩 움직인다. 연출 줄이기(OS 설정)가 켜져 있으면 하강 연출 없이 바로 넘어간다.
// v2(11/03) 하강 장면: 정지 그림 한 장을 확대하던 것을, 기존 그림을 조합한 세로 갱도로 바꿨다.
//  지상(관측소 바닥 그림) 아래로 연도별 지층 그림(stratum_YYYY)을 한 해씩 쌓고, 가운데 철제 승강장에 민디(mindi_full)가 타고 있다.
//  내려가면 갱도가 위로 흘러가며 지나는 해의 이름이 바뀌고, 층마다 「딸깍」. 고른 해에서 멈추고 「○○년입니다.」
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { kitDescend, sfx } from '../mindi/soundKit';
import { ART, stratumFor } from './design';
import { MindiMark } from './Icons';
import { mindiSay } from '../mindi/soundKit';
import './lift.css';

// 민디 대사 정본(전체대본집 v1.1 §6-1, 조용한 결): 5-1 층 표시기, 5-2 확인 쌍, 5-3 내려가는 중
const L51 = '여기 한 층이 한 해예요. 깊이 내려갈수록 오래된 해고요. 가 보고 싶은 해를 골라 보세요.';
const L52 = '아래를 누르면 내려가요. 돌아가셔도 되고요.';
const L53 = '조금만 더 내려갈게요.';

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
  const [said, setSaid] = useState(L51);
  const cur = floors[at];
  const move = (k: number) => {
    const n = Math.max(0, Math.min(floors.length - 1, k));
    if (n !== at) { sfx('floor'); setAt(n); setSaid(L52); }
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
  const [depth, setDepth] = useState(-1); // 승강장이 지금 있는 층(-1 = 지상)
  const [passing, setPassing] = useState<number | null>(null);
  const [dur, setDur] = useState(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const descend = async () => {
    if (!cur || going) return;
    sfx('confirm');
    if (reduced()) { onDescend(cur.year); return; }
    setGoing(true);
    setSaid(L53); mindiSay(L53);
    // 한 층 0.55초(최소 1.6초, 최대 4.2초). 지나가는 해마다 층 표시와 딸깍
    const per = Math.max(0.35, Math.min(0.55, 4.2 / (at + 1)));
    const total = Math.max(1.6, per * (at + 1));
    setDur(total);
    requestAnimationFrame(() => setDepth(at));
    for (let k = 0; k <= at; k++) {
      timers.current.push(window.setTimeout(() => { setPassing(k); if (k < at) sfx('floor'); }, ((k + 0.5) / (at + 1)) * total * 1000));
    }
    void kitDescend(Math.min(1, (at + 1) / Math.max(1, floors.length)), total);
    await new Promise((r) => { timers.current.push(window.setTimeout(r, total * 1000)); });
    setSaid(`${cur.year}년입니다.`);
    sfx('floor');
    await new Promise((r) => { timers.current.push(window.setTimeout(r, 900)); });
    onDescend(cur.year);
  };
  if (!floors.length) return <p className="muted" style={{ padding: 80 }}>아직 내려갈 지층이 없습니다.</p>;
  return (
    <section className={`lift${going ? ' going' : ''}`} aria-label="민디의 리프트 · 엘리베이터" onWheel={onWheel}>
      <div className="lift-shaft" aria-hidden="true">
        {/* 세로 갱도: 지상 + 한 해 한 층. 승강장은 가운데 고정, 갱도가 위로 흐른다 */}
        <div className="lift-column" style={{ ['--d' as string]: String(depth + 1), transitionDuration: `${dur}s` }}>
          <div className="lift-surface" style={{ backgroundImage: `url(${ART.observatoryBg})` }} />
          {floors.map((f, k) => (
            <div key={f.year} className={`lift-stratum${k === at ? ' pick' : ''}`} style={{ backgroundImage: `url(${stratumFor(f.year).src})` }}>
              <span className="lift-year">{f.year}</span>
            </div>
          ))}
          <div className="lift-bottom" />
        </div>
        <div className="lift-rail l" /><div className="lift-rail r" />
        <div className={`lift-cage${going ? ' moving' : ''}`}>
          <i className="lift-cable" />
          <div className="lift-cage-top" />
          <img className="lift-rider" src={ART.mindiFull} alt="" />
          <div className="lift-cage-floor"><i className="lift-lamp" /></div>
        </div>
        {going && passing !== null && floors[passing] && <div className="lift-passing" key={passing}>{floors[passing].year}</div>}
        <div className="lift-shade" />
      </div>
      <div className="lift-say" key={said} aria-live="polite"><MindiMark size={30} /><p>{said}</p></div>
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
