// P7 광석 캐기 (10/23 버튼배치 확정): 화면 가운데 광석 자체를 3번 탭 → 금 → 깨짐(갈라진 겹) → 하단 「관측소로 가져가기」(왼) / 「여기서 바로 보기」(오른, 강조).
// 진행은 점 3개로만 보여 준다. 희귀도·성공/실패 확률 연출은 넣지 않는다. 연출 줄이기(OS 설정)면 1번, 키보드 Enter 도 받는다.
// 데이터 광석이면 깨진 겉돌 안에서 그 광물이, 직접 고른 주면 깎인 돌(StoneA_Cut)이 드러난다.
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { playCue } from '../mindi/sound';
import { sfx } from '../mindi/soundKit';
import { ART, MINERAL_IMG, stratumFor } from './design';
import { oreMineral } from '../ore/collection';
import { CRACK_C1, CRACK_C2, monthWeek } from './MineField';
import type { Mineral } from './minerals';
import type { WeekRecord } from '../types';
import './mine.css';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Mine({ w, onCarry, onView }: { w: WeekRecord; onCarry: () => void; onView: () => void }) {
  const { settings } = useStore();
  const need = reduced() ? 1 : 3;
  const [hits, setHits] = useState(0);
  const [shake, setShake] = useState(0);
  const [leaving, setLeaving] = useState<'up' | 'view'>();
  const done = hits >= need;
  const m = oreMineral(w) as Mineral | null;
  const core = w.candidate && m && m in MINERAL_IMG ? MINERAL_IMG[m] : ART.stoneCut;
  const year = Number(w.week.split('-W')[0]);
  const nextRef = useRef<HTMLButtonElement>(null);
  const hit = () => {
    if (done) return;
    const n = hits + 1;
    setHits(n); setShake((k) => k + 1);
    if (n < need) { sfx(n === 1 ? 'hit1' : 'hit2'); return; }
    sfx('hit3');
    if (settings.sound) playCue('mined');
  };
  useEffect(() => { if (done) setTimeout(() => nextRef.current?.focus(), 450); }, [done]);
  const carry = () => {
    sfx('keep');
    if (reduced()) { onCarry(); return; }
    setLeaving('up');
    setTimeout(onCarry, 700);
  };
  const view = () => { sfx('confirm'); setLeaving('view'); setTimeout(onView, reduced() ? 0 : 180); };
  const stage = done ? 'broken' : hits === 2 ? 'crack-2' : hits === 1 ? 'crack-1' : 'intact';
  return (
    <section className={`mine${leaving === 'up' ? ' leaving-up' : ''}`} aria-label={`광석 캐기 · ${monthWeek(w)}`}>
      <img className="mine-band" src={stratumFor(year).src} alt="" aria-hidden="true" />
      {!done && <p className="mine-hint" aria-hidden="true"><img src={ART.pickaxe} alt="" />눌러서 캐기 ({need}번)</p>}
      <button type="button" className={`mine-ore ${stage}`} key={shake} onClick={hit} disabled={done}
        aria-label={done ? `${monthWeek(w)} 광석을 캤습니다` : `${monthWeek(w)} 광석 캐기 (${hits}/${need})`}>
        {done && <img className="mine-core" src={core} alt="" />}
        <img className="mine-shell" src={ART.stoneBasic} alt="" />
        <svg className="mine-crack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path className="c1" d={CRACK_C1} /><path className="c2" d={CRACK_C2} /></svg>
        <img className="mine-frag" src={ART.stoneFragment} alt="" aria-hidden="true" />
      </button>
      <div className="mine-dots" aria-hidden="true">{Array.from({ length: need }, (_, k) => <i key={k} className={k < hits ? 'on' : ''} />)}</div>
      {done && (
        <div className="mine-next" role="group" aria-label="캔 뒤">
          <button className="mine-btn" onClick={carry} disabled={!!leaving}>관측소로 가져가기</button>
          <button className="mine-btn primary" ref={nextRef} onClick={view} disabled={!!leaving}>여기서 바로 보기</button>
        </div>
      )}
      <p className="sr-only" role="status">{done ? `${monthWeek(w)} 광석을 캤습니다. 관측소로 가져가거나 여기서 바로 볼 수 있습니다.` : ''}</p>
    </section>
  );
}
