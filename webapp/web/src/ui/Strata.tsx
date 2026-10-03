// 지층: 한 줄이 한 해(가장 최근 해가 맨 위), 한 칸이 한 주. 같은 세로줄은 해마다 같은 시기라서
// "해마다 비슷한 시기에 비슷해지는" 흐름이 세로로 쌓여 보인다.
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useStore } from '../state/store';
import type { WeekRecord } from '../types';
import { rangeLabel } from '../mindi/templates';

import { MINERAL_BY_AXIS_DIR } from './minerals';
import { playCue } from '../mindi/sound';
import { AXES, axisScreen } from '../types';

// 범례: 광물 9종과 그 광물이 말하는 축·방향(방향이 곧 정보다)
const MINERAL_LEGEND: [string, string][] = [
  ...AXES.flatMap((ax) => [
    [MINERAL_BY_AXIS_DIR[ax].up, `${axisScreen(ax)} 많음`] as [string, string],
    [MINERAL_BY_AXIS_DIR[ax].down, `${axisScreen(ax)} 적음`] as [string, string],
  ]),
  ['형석', '여러 축'],
];

function isoWeekNo(key: string) { return Number(key.split('-W')[1]); }
function isoYear(key: string) { return Number(key.split('-W')[0]); }

function observedCount(w: WeekRecord) {
  return Object.values(w.coverage).filter((c) => c === 'observed').length;
}

function sedimentClass(n: number) {
  if (n === 0) return 'c0';
  if (n === 1) return 'c1';
  if (n <= 3) return 'c2';
  if (n === 4) return 'c3';
  return 'c4';
}

export function describeWeek(w: WeekRecord): string {
  const n = observedCount(w);
  const base = `${rangeLabel(w)} · 기록 ${n}종`;
  if (!w.candidate) return n === 0 ? `${rangeLabel(w)} · 기록 없음` : base;
  return `${base} · 광물${w.mineral ? ` · ${w.mineral}` : ''}${w.evidence.cross_validated ? '' : ' · 근거가 얇음'}`;
}

export function Strata() {
  const { weeks, selected, select, labels, byKey, settings } = useStore();
  // 고른 주가 돌아온 뒤 지켜본 구간(return_week ~ hold_until). not_returned 는 문안이 정해질 때까지 그리지 않는다
  const span = useMemo(() => {
    const w = selected ? byKey.get(selected) : undefined;
    if (!w || !w.return_week || !w.hold_until || !(w.grade === 'held' || w.grade === 'returned' || w.grade === 'broken')) return null;
    return { from: w.return_week, to: w.hold_until };
  }, [selected, byKey]);
  const [tip, setTip] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);
  const labeled = useMemo(() => new Set(labels.map((l) => l.week)), [labels]);

  const years = useMemo(() => {
    const m = new Map<number, (WeekRecord | undefined)[]>();
    for (const w of weeks) {
      const y = isoYear(w.week);
      if (!m.has(y)) m.set(y, new Array(53).fill(undefined));
      m.get(y)![isoWeekNo(w.week) - 1] = w;
    }
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [weeks]);

  const order = useMemo(() => weeks.map((w) => w.week), [weeks]);

  function move(e: KeyboardEvent) {
    if (!selected) return;
    const i = order.indexOf(selected);
    let j = i;
    if (e.key === 'ArrowLeft') j = i - 1;
    else if (e.key === 'ArrowRight') j = i + 1;
    else if (e.key === 'ArrowUp') j = i + 52;
    else if (e.key === 'ArrowDown') j = i - 52;
    else return;
    e.preventDefault();
    j = Math.max(0, Math.min(order.length - 1, j));
    select(order[j]);
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-week="${order[j]}"]`)?.focus());
  }

  const nCand = weeks.filter((w) => w.candidate).length;

  return (
    <section aria-labelledby="strata-title">
      <h2 id="strata-title" className="section-title">지층</h2>
      <p className="lede">한 줄이 한 해, 한 칸이 한 주입니다. 맨 위가 가장 최근입니다. 색이 있는 칸은 광물이 나온 주({nCand}주)입니다.</p>
      <div className="strata" ref={gridRef} onKeyDown={move} role="grid" aria-label="주 단위 지층">
        {years.map(([y, cells]) => (
          <div className="stratum" role="row" key={y}>
            <div className="yr" role="rowheader">{y}</div>
            <div className="weeks">
              {cells.map((w, k) => {
                if (!w) return <span key={k} aria-hidden="true" />;
                const n = observedCount(w);
                const cls = ['wk', sedimentClass(n)];
                if (w.candidate && w.mineral) cls.push('hit', `m-${w.mineral}`);
                if (w.candidate && !w.evidence.cross_validated) cls.push('thin');
                if (w.candidate && w.episode) cls.push('ep');
                if (w.week === selected) cls.push('sel');
                if (span && w.week >= span.from && w.week <= span.to) cls.push('span');
                const label = describeWeek(w);
                return (
                  <button
                    key={w.week}
                    className={cls.join(' ')}
                    data-week={w.week}
                    role="gridcell"
                    aria-label={label}
                    aria-selected={w.week === selected}
                    tabIndex={w.week === selected || (!selected && k === 0) ? 0 : -1}
                    disabled={n === 0 && !w.candidate}
                    onMouseEnter={() => setTip(label)}
                    onFocus={() => setTip(label)}
                    // 이미 고른 주를 다시 눌러도(설정·편지 화면에서) 주 화면으로 돌아가게 알린다
                    onClick={() => { select(w.week); window.dispatchEvent(new CustomEvent('mined:show-week')); if (settings.sound && w.candidate) playCue('mined'); }}
                  >
                    {labeled.has(w.week) && <span className="lab" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="strata-tip" aria-live="polite">{tip || '칸에 마우스를 올리거나 방향키로 움직이면 날짜가 나옵니다.'}</p>
      {span && (() => {
        const a = byKey.get(span.from), b = byKey.get(span.to);
        const txt = a && b ? rangeLabel({ date_start: a.date_start, date_end: b.date_end }) : `${span.from} ~ ${span.to}`;
        return <p className="small muted">밑줄 친 칸({txt})은 돌아온 주부터 지켜본 구간입니다.</p>;
      })()}
      <div className="legend">
        {MINERAL_LEGEND.map(([name, what]) => (
          <span key={name}><i className={`wk hit m-${name} swatch`} />{name} <small>{what}</small></span>
        ))}
        <span><i className="wk hit m-흑요석 thin swatch" />근거가 얇은 광물</span>
        <span><i className="wk c4 swatch" />기록이 많은 주</span>
        <span><i className="wk c1 swatch" />기록이 적은 주</span>
        <span><i className="wk c0 swatch" />기록 없음</span>
      </div>
    </section>
  );
}
