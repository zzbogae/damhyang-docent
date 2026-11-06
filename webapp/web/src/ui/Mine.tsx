// P7 광석 캐기 (10/23 버튼배치 확정): 화면 가운데 광석 자체를 3번 탭 → 금 → 깨짐(갈라진 겹) → 하단 「관측소로 가져가기」(왼) / 「여기서 바로 보기」(오른, 강조).
// 진행은 점 3개로만 보여 준다. 희귀도·성공/실패 확률 연출은 넣지 않는다. 연출 줄이기(OS 설정)면 1번, 키보드 Enter 도 받는다.
// 데이터 광석이면 깨진 겉돌 안에서 그 광물이, 직접 고른 주면 깎인 돌(StoneA_Cut)이 드러난다.
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { playCue } from '../mindi/sound';
import { ART, stratumFor } from './design';
import { oreMineral, SPACE_NEED, useCollected } from '../ore/collection';
import { loadSpaces } from './Space';
import { CRACK_C1, CRACK_C2, monthWeek } from './MineField';
import type { Mineral } from './minerals';
import type { WeekRecord } from '../types';
import { GeodeCore, bandColor, bandWord, bandsOf } from './OreSplit';
import { openOreRead } from './OreReadGuide';
import { MindiMark } from './Icons';
import { mindiSay, sfx } from '../mindi/soundKit';
import './mine.css';

// 민디 대사 정본(전체대본집 v1.1 §6-2 따라가기, 조용한 결): 7-1 시작, 7-2 칠 때마다, 7-3 깨진 단면, 7-4 두 갈래
const LINE_START = '세 번 두드리면 열려요.';
const HIT_LINES = ['음, 단단하네요.', '조금만 더요.', '아, 열렸다.'];
export const OPEN_LINES = ['꺼냈습니다. 생각보다 큰데요.', '안쪽 줄무늬가 결이에요. 띠가 두꺼운 색일수록 그 주를 많이 차지한 거예요.'];
const LINE_NEXT = '바로 열어 봐도 되고, 관측소로 가져가셔도 돼요.';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 11/06 전시: 섬을 아직 짓지 않았으면 캔 뒤 큰 버튼이 다음 걸음을 이끈다.
 * 광석이 3개가 안 되면 「한 개 더 캐기」(지층으로 바로), 3개가 되면 「나의 섬 만들러 가기」. 섬이 있으면 예전처럼 「여기서 바로 보기」가 크다.
 */
export function Mine({ w, onCarry, onView, onMore, onSpace }: { w: WeekRecord; onCarry: () => void; onView: () => void; onMore?: () => void; onSpace?: () => void }) {
  const { settings } = useStore();
  const collected = useCollected();
  const [guide] = useState(() => loadSpaces().length === 0 && !!onMore && !!onSpace);
  const after = Math.min(SPACE_NEED, collected.length + (collected.some((c) => c.week === w.week) ? 0 : 1));
  const need = reduced() ? 1 : 3;
  const [hits, setHits] = useState(0);
  const [shake, setShake] = useState(0);
  const [leaving, setLeaving] = useState<'up' | 'view'>();
  const done = hits >= need;
  const m = oreMineral(w) as Mineral | null;
  const year = Number(w.week.split('-W')[0]);
  const nextRef = useRef<HTMLButtonElement>(null);
  const hit = () => {
    if (done) return;
    const n = hits + 1;
    setHits(n); setShake((k) => k + 1);
    if (n < need) { sfx(n === 1 ? 'hit1' : 'hit2'); mindiSay(HIT_LINES[n - 1]); return; }
    sfx('hit3');
    if (settings.sound) playCue('mined');
    mindiSay(OPEN_LINES.join(' '), 'found');
  };
  useEffect(() => { if (done) setTimeout(() => nextRef.current?.focus(), 450); }, [done]);
  const carry = () => {
    sfx('keep');
    if (reduced()) { onCarry(); return; }
    setLeaving('up');
    setTimeout(onCarry, 700);
  };
  const view = () => { sfx('confirm'); setLeaving('view'); setTimeout(onView, reduced() ? 0 : 180); };
  const more = () => { sfx('keep'); setLeaving('up'); setTimeout(() => onMore?.(), reduced() ? 0 : 500); };
  const toSpace = () => { sfx('confirm'); setLeaving('up'); setTimeout(() => onSpace?.(), reduced() ? 0 : 500); };
  const stage = done ? 'broken' : hits === 2 ? 'crack-2' : hits === 1 ? 'crack-1' : 'intact';
  const bands = bandsOf(w, m ?? '형석');
  const say = done ? null : hits === 0 ? LINE_START : HIT_LINES[Math.min(hits, need) - 1];
  return (
    <section className={`mine${leaving === 'up' ? ' leaving-up' : ''}`} aria-label={`광석 캐기 · ${monthWeek(w)}`}>
      <img className="mine-band" src={stratumFor(year).src} alt="" aria-hidden="true" />
      {!done && <p className="mine-hint" aria-hidden="true"><img src={ART.pickaxe} alt="" />눌러서 캐기 ({need}번)</p>}
      {/* v2(11/03) 민디가 곡괭이를 들고 광석 옆에 선다. 칠 때마다 곡괭이를 내리친다(누르는 건 사용자, 휘두르는 건 민디) */}
      <div className={`mine-mindi${done ? ' done' : ''}`} aria-hidden="true">
        <img className="mine-mindi-body" src={ART.mindiFull} alt="" />
        <img className="mine-mindi-pick" key={`p${shake}`} src={ART.pickaxe} alt="" data-swing={shake > 0 && !done ? 'y' : undefined} />
        {shake > 0 && <i className="mine-spark" key={`s${shake}`} />}
      </div>
      <button type="button" className={`mine-ore ${stage}`} key={shake} onClick={hit} disabled={done}
        aria-label={done ? `${monthWeek(w)} 광석을 캤습니다` : `${monthWeek(w)} 광석 캐기 (${hits}/${need})`}>
        {/* 11/03 보별: 데이터 광석이든 직접 고른 주(회색 돌)든 깨진 안쪽에 결 띠를 그린다. 오른쪽 범례와 같은 색 */}
        {/* 11/06 보별: 단희 원 디자인대로 검은 돌이 깨지면 정동 안쪽에서 결 색이 나온다 */}
        {done && <span className="mine-core geode-wrap"><GeodeCore bands={bands} label={`${monthWeek(w)} 광석의 쪼갠 단면`} /></span>}
        <img className="mine-shell" src={ART.stoneBasic} alt="" />
        <svg className="mine-crack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path className="c1" d={CRACK_C1} /><path className="c2" d={CRACK_C2} /></svg>
        <img className="mine-frag" src={ART.stoneFragment} alt="" aria-hidden="true" />
      </button>
      {say && <div className="mine-say" key={say} aria-live="polite"><MindiMark size={28} /><p>{say}</p></div>}
      {done && (
        <aside className="mine-open" aria-label="깨진 광석의 결">
          <div className="mine-open-say"><MindiMark size={30} mood="found" /><div>{OPEN_LINES.map((l) => <p key={l}>{l}</p>)}</div></div>
          <ul className="mine-bands" aria-label="안쪽 결 · 네 지표">
            {bands.map((b) => <li key={b.axis}><i style={{ background: bandColor(b) }} aria-hidden="true" />{bandWord(b)}</li>)}
          </ul>
          {guide
            ? <p className="mine-open-next mine-count"><b>광석 {after}/{SPACE_NEED}</b> · {after >= SPACE_NEED ? '안개 옆에 나의 섬을 놓을 수 있어요.' : `${SPACE_NEED - after}개 더 캐면 나의 섬을 지을 수 있어요.`}</p>
            : <p className="mine-open-next">{LINE_NEXT}</p>}
          <button className="mine-read" onClick={() => openOreRead(m ?? undefined)}>광석 읽는 법 ›</button>
        </aside>
      )}
      <div className="mine-dots" aria-hidden="true">{Array.from({ length: need }, (_, k) => <i key={k} className={k < hits ? 'on' : ''} />)}</div>
      {done && (
        <div className="mine-next" role="group" aria-label="캔 뒤">
          <button className="mine-btn" onClick={carry} disabled={!!leaving}>관측소로 가져가기</button>
          {guide ? <>
            <button className="mine-btn" onClick={view} disabled={!!leaving}>여기서 바로 보기</button>
            {after >= SPACE_NEED
              ? <button className="mine-btn primary" ref={nextRef} onClick={toSpace} disabled={!!leaving}>나의 섬 만들러 가기</button>
              : <button className="mine-btn primary" ref={nextRef} onClick={more} disabled={!!leaving}>한 개 더 캐기 ({after}/{SPACE_NEED})</button>}
          </> : <button className="mine-btn primary" ref={nextRef} onClick={view} disabled={!!leaving}>여기서 바로 보기</button>}
        </div>
      )}
      <p className="sr-only" role="status">{done ? `${monthWeek(w)} 광석을 캤습니다. 관측소로 가져가거나 여기서 바로 볼 수 있습니다.` : ''}</p>
    </section>
  );
}
