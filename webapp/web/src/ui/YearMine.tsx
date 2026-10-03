// 광물 지하(8/22 랜딩 3번 화면): 한 해를 크게 띄우고, 그해 광물이 나온 주를 광물 그림으로 보여 준다.
// 가로 위치는 그 주가 한 해 중 어디인지(1~53주), 세로 위치는 광물을 정한 축(걸음·쉼·화면·기록 순서로 위에서 아래)이다.
// 위치·크기는 판정값에서만 나오고 난수를 쓰지 않는다. 광물을 누르면 그 주가 열린다.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { rangeLabel } from '../mindi/templates';
import { MINERAL_IMG } from './design';
import { MindiMark } from './Icons';
import type { WeekRecord } from '../types';

const ROW: Record<string, number> = { 호박: 0, 황철석: 0, 청금석: 1, 월장석: 1, 자수정: 2, 홍옥: 2, 흑요석: 3, 석류석: 3, 형석: 1.5 };

export function YearMine() {
  const { weeks, selected, select } = useStore();
  const byYear = useMemo(() => {
    const m = new Map<number, WeekRecord[]>();
    for (const w of weeks) {
      const y = Number(w.week.split('-W')[0]);
      if (!m.has(y)) m.set(y, []);
      if (w.candidate && w.mineral) m.get(y)!.push(w);
    }
    return m;
  }, [weeks]);
  const years = useMemo(() => [...byYear.keys()].sort((a, b) => a - b), [byYear]);
  const [year, setYear] = useState<number | undefined>(undefined);
  // 고른 주가 바뀌면 그 해로 옮겨 간다. 처음에는 광물이 있는 가장 최근 해.
  useEffect(() => {
    if (selected) { setYear(Number(selected.split('-W')[0])); return; }
    if (year === undefined) setYear([...years].reverse().find((y) => (byYear.get(y)?.length ?? 0) > 0) ?? years[years.length - 1]);
  }, [selected, years, byYear]); // eslint-disable-line react-hooks/exhaustive-deps
  if (year === undefined || !years.length) return null;
  const i = years.indexOf(year);
  const ores = byYear.get(year) ?? [];
  return (
    <section className="yearmine" aria-label={`${year}년 광물`}>
      <div className="ym-head">
        <button className="ym-arrow" onClick={() => setYear(years[i - 1])} disabled={i <= 0} aria-label="이전 해">‹</button>
        <span className="ym-year">{year}</span>
        <button className="ym-arrow" onClick={() => setYear(years[i + 1])} disabled={i >= years.length - 1} aria-label="다음 해">›</button>
      </div>
      <div className="ym-field">
        {[0, 1, 2, 3].map((r) => <span key={r} className="ym-band" style={{ top: `${14 + r * 21}%` }} />)}
        {ores.map((w) => {
          const wk = Number(w.week.split('-W')[1]);
          const row = ROW[w.mineral!] ?? 1.5;
          const size = 34 + Math.min(3, w.evidence.independent ?? 1) * 8;
          return (
            <button key={w.week} className={`ym-ore${w.week === selected ? ' on' : ''}${w.evidence.cross_validated ? '' : ' thin'}`}
              style={{ left: `${7 + ((wk - 1) / 52) * 86}%`, top: `${10 + row * 21}%`, width: size, height: size }}
              onClick={() => select(w.week)} aria-label={`${rangeLabel(w)} · ${w.mineral}`} title={`${rangeLabel(w)} · ${w.mineral}`}>
              <img src={MINERAL_IMG[w.mineral as keyof typeof MINERAL_IMG]} alt="" />
            </button>
          );
        })}
        {!ores.length && <p className="ym-empty">{year}년에는 광물이 나온 주가 없습니다.</p>}
        <span className="ym-mindi"><MindiMark size={34} /></span>
      </div>
      <p className="small muted">{year}년 광물 {ores.length}개 · 가로는 한 해의 시기, 세로는 광물을 정한 축(걸음·쉼·화면·기록)입니다.</p>
    </section>
  );
}
