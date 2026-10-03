// 광물 지하(드라이브 8/22 랜딩 3번 화면을 실제 판정값으로): 화면 전체가 지층이다.
// 위에 하늘·지표, 아래로 물결 지층 8겹, 가운데 위 민디 눈과 큰 연도(‹ ›), 왼쪽 연도 목록, 오른쪽 아래 민디·로고.
// 원본은 연도별 무작위 위치·무작위 광물이었지만, 여기서는 광물이 나온 주만 놓는다.
// 가로 = 그 주가 한 해 중 어디인지(1~53주), 세로 = 광물을 정한 축(걸음·쉼·화면·기록, 깊을수록 아래), 크기 = 서로 다른 근거 수. 난수는 쓰지 않는다.
// 광물을 곡괭이로 세 번 치면(1·2번은 금이 가고 3번째에 깨짐) 기록 조각 카드가 뜨고, 「상세 페이지에서 이어보기」로 그 주를 연다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { rangeLabel } from '../mindi/templates';
import { playCue } from '../mindi/sound';
import { MINERAL_IMG, ART } from './design';
import { MINERAL_HEX, type Mineral } from './minerals';
import { MindiGreeting } from './Mindi';
import type { WeekRecord } from '../types';

const ROW: Record<string, number> = { 호박: 0, 황철석: 0, 청금석: 1, 월장석: 1, 자수정: 2, 홍옥: 2, 흑요석: 3, 석류석: 3, 형석: 1.5 };
const LAYERS = [
  { y: 200, amp: 14, phase: 0.3, color: '#3a3a3c' }, { y: 270, amp: 10, phase: 1.6, color: '#302f33' },
  { y: 340, amp: 16, phase: 0.7, color: '#26232a' }, { y: 430, amp: 11, phase: 2.2, color: '#1e1a20' },
  { y: 530, amp: 14, phase: 1.1, color: '#19151b' }, { y: 640, amp: 10, phase: 2.7, color: '#151119' },
  { y: 760, amp: 13, phase: 0.5, color: '#100d15' }, { y: 880, amp: 9, phase: 1.9, color: '#0b090f' },
];
function wave(y: number, amp: number, phase: number) {
  const p = (x: number) => y + Math.sin((x / 1000) * Math.PI * 2 + phase) * amp;
  return `M0,${p(0)} C 170,${p(170) - amp * 0.6} 330,${p(330) + amp * 0.6} 500,${p(500)} S 830,${p(830) - amp * 0.6} 1000,${p(1000)}`;
}
const CRACK_C1 = 'M24,10 L40,32 L26,40 L46,62 L30,70 L48,90';
const CRACK_C2 = 'M80,16 L58,30 L76,44 L52,58 L72,74 L54,92';

function Ore({ w, i, onMined }: { w: WeekRecord; i: number; onMined: (w: WeekRecord, x: number, y: number) => void }) {
  const { settings } = useStore();
  const [hits, setHits] = useState(0);
  const [hit, setHit] = useState(0);
  const wk = Number(w.week.split('-W')[1]);
  const x = 16 + ((wk - 1) / 52) * 66;
  let y = 42 + (ROW[w.mineral!] ?? 1.5) * 12.5;
  if (x > 70 && y > 66) y = 60;
  const size = 46 + Math.min(3, w.evidence.independent ?? 1) * 10;
  const m = w.mineral as Mineral;
  const click = (e: React.MouseEvent) => {
    if (hits >= 3) return;
    const n = hits + 1;
    setHits(n); setHit((k) => k + 1);
    if (n === 3) {
      if (settings.sound) playCue('mined');
      const r = (e.currentTarget as HTMLElement).closest('.minefield')!.getBoundingClientRect();
      setTimeout(() => { onMined(w, e.clientX - r.left, e.clientY - r.top); setHits(0); }, 260);
    }
  };
  return (
    <button
      className={`mf-ore${hits === 1 ? ' crack-1' : ''}${hits === 2 ? ' crack-2' : ''}${hits >= 3 ? ' breaking' : ''}${w.evidence.cross_validated ? '' : ' thin'}`}
      key={hit} data-mine-week={w.week}
      style={{ left: `${x}%`, top: `${y}%`, width: size, animationDelay: `${i * 0.05}s` }}
      onClick={click} aria-label={`${rangeLabel(w)} · ${m} 캐기 (${hits}/3)`} title={`${rangeLabel(w)} · ${m}`}
    >
      <span className="mf-glow" style={{ background: `radial-gradient(circle, ${MINERAL_HEX[m]}88, transparent 70%)` }} />
      <img className="mf-core" src={MINERAL_IMG[m]} alt="" />
      <svg className="mf-crack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path className="c1" d={CRACK_C1} /><path className="c2" d={CRACK_C2} /></svg>
    </button>
  );
}

export function MineField() {
  const { weeks, select, greeted } = useStore();
  const byYear = useMemo(() => {
    const m = new Map<number, WeekRecord[]>();
    for (const w of weeks) {
      const y = Number(w.week.split('-W')[0]);
      if (!m.has(y)) m.set(y, []);
      if (w.candidate && w.mineral && w.mineral in MINERAL_IMG) m.get(y)!.push(w);
    }
    return m;
  }, [weeks]);
  const years = useMemo(() => [...byYear.keys()].sort((a, b) => b - a), [byYear]);
  const [year, setYear] = useState<number>();
  const [pulse, setPulse] = useState(0);
  const [card, setCard] = useState<{ w: WeekRecord; x: number; y: number }>();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (year === undefined && years.length) setYear(years.find((y) => (byYear.get(y)?.length ?? 0) > 0) ?? years[0]);
  }, [years, byYear, year]);
  if (year === undefined) return null;
  const go = (y: number) => { setYear(y); setPulse((k) => k + 1); setCard(undefined); };
  const i = years.indexOf(year);
  const ores = byYear.get(year) ?? [];
  const W = ref.current?.clientWidth ?? 1200, H = ref.current?.clientHeight ?? 800;
  const cardPos = card && { left: card.x + 22 + 300 > W ? card.x - 322 : card.x + 22, top: Math.max(10, Math.min(card.y - 30, H - 170)) };
  return (
    <div className="minefield" ref={ref} role="region" aria-label="광물 지하">
      <svg className="mf-strata" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="mfSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#cfe0e6" /><stop offset="55%" stopColor="#8a8f92" /><stop offset="100%" stopColor="#4b4a4d" /></linearGradient></defs>
        <rect x="0" y="0" width="1000" height="210" fill="url(#mfSky)" />
        {LAYERS.map((L) => <path key={L.y} d={`${wave(L.y, L.amp, L.phase)} L1000,1000 L0,1000 Z`} fill={L.color} />)}
        {LAYERS.map((L) => <path key={`l${L.y}`} d={wave(L.y, L.amp, L.phase)} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="2" />)}
      </svg>
      <div className="mf-scanner" aria-hidden="true"><i /><i /></div>
      <div className="mf-picker">
        <button className="mf-chev" onClick={() => go(years[i + 1])} disabled={i >= years.length - 1} aria-label="이전 해">‹</button>
        <h2 className="mf-year" key={pulse}>{year}</h2>
        <button className="mf-chev" onClick={() => go(years[i - 1])} disabled={i <= 0} aria-label="다음 해">›</button>
      </div>
      <nav className="mf-years" aria-label="연도">
        {years.map((y) => (
          <button key={y} className={`mf-yr${y === year ? ' on' : ''}`} onClick={() => go(y)} aria-current={y === year ? 'true' : undefined}>
            <span className="arrow">▶</span>{y}{(byYear.get(y)?.length ?? 0) > 0 && <small> · {byYear.get(y)!.length}</small>}
          </button>
        ))}
      </nav>
      <div className="mf-field" key={year}>
        {ores.map((w, k) => <Ore key={w.week} w={w} i={k} onMined={(ww, x, y) => setCard({ w: ww, x, y })} />)}
        {!ores.length && <p className="mf-empty">{year}년에는 평소를 벗어난 주가 없습니다.</p>}
      </div>
      {card && cardPos && (
        <div className="mf-card" style={cardPos} role="dialog" aria-label="기록 조각">
          <button className="mf-card-x" onClick={() => setCard(undefined)} aria-label="닫기">✕</button>
          <div className="mf-card-eyebrow">{rangeLabel(card.w)} · {card.w.mineral}</div>
          <p className="mf-card-line">{card.w.sentence_plain ?? card.w.sentence}</p>
          <button className="mf-card-next" onClick={() => select(card.w.week)}>상세 페이지에서 이어보기 →</button>
        </div>
      )}
      {!greeted && <div className="mf-greet"><MindiGreeting /></div>}
      <div className="mf-brand" aria-hidden="true">
        <img className="mindy" src={ART.mindiCharacter} alt="" />
        <img className="logo" src={ART.logoLight} alt="" />
        <div className="tagline">Your Mind In Your Mine D</div>
      </div>
      <p className="mf-hint">광물을 곡괭이로 세 번 치면 그 주의 기록 조각이 나옵니다. 가로는 한 해의 시기, 깊이는 광물을 정한 축(걸음·쉼·화면·기록)입니다.</p>
    </div>
  );
}
