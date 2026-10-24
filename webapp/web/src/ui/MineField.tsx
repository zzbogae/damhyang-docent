// 광물 지하(드라이브 8/22 랜딩 3번 화면을 실제 판정값으로): 화면 전체가 지층이다.
// 맨 위가 하늘·지표이고, 아래로 스크롤할수록 한 해씩 더 오래된 지층(Team Art Assets 연도별 지층 그림)이 나온다.
// 가운데 위 민디 눈과 큰 연도는 지금 화면 한가운데 있는 지층의 해를 따라가고, ‹ ›·왼쪽 연도 목록은 그 지층으로 내려가거나 올라간다.
// 원본은 연도별 무작위 위치·무작위 광물이었지만, 여기서는 광물이 나온 주만 놓는다.
// 가로 = 그 주가 한 해 중 어디인지(1~53주), 세로 = 광물을 정한 축(걸음·쉼·화면·기록, 깊을수록 아래), 크기 = 서로 다른 근거 수. 난수는 쓰지 않는다.
// 광물을 곡괭이로 세 번 치면(1·2번은 금이 가고 3번째에 깨짐) 기록 조각 카드가 뜨고, 「상세 페이지에서 이어보기」로 그 주를 연다.
// 10/23 장면 플로우 ③: 지층마다 월 타임라인이 있고, 모든 주가 결 무늬 눈금으로 보인다. 아무 주나 골라 캐면 「직접 고른 광석」이 된다.
// 관측소에서 내려올 때는 엘리베이터 연출이 한 번 지나간다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { rangeLabel } from '../mindi/templates';
import { playCue } from '../mindi/sound';
import { fieldDepth, sfx, sceneOverlay } from '../mindi/soundKit';
import { MINERAL_IMG, ART, stratumFor } from './design';
import { MINERAL_HEX, type Mineral } from './minerals';
import { customOreName } from './oreName';
import { collect, missingUsual, oreMineral, pickedMineral } from '../ore/collection';
import { axisScreen, CHANNEL_LABEL, type WeekRecord } from '../types';
import { GYEOL_TEXT } from './Gyeol';

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

// 가로 자리: 한 해 안에서 몇 번째 주인지(0~1). 실제 위치는 CSS 변수 --mf-x0·--mf-xw 로 화면 폭에 맞춘다(좁은 화면은 더 넓게)
function weekFrac(w: WeekRecord) {
  return (Number(w.week.split('-W')[1]) - 1) / 52;
}
const xAt = (f: number) => `calc(var(--mf-x0) + var(--mf-xw) * ${f.toFixed(4)})`;

function Ore({ w, i, onMined, picked = false, top }: { w: WeekRecord; i: number; onMined: (w: WeekRecord, x: number, y: number) => void; picked?: boolean; top?: number }) {
  const { settings } = useStore();
  const [hits, setHits] = useState(0);
  const [hit, setHit] = useState(0);
  const m = (oreMineral(w) ?? '형석') as Mineral;
  const y = top ?? 30 + (ROW[m] ?? 1.5) * 13;
  const size = picked ? 44 : 40 + Math.min(3, w.evidence.independent ?? 1) * 8;
  const click = (e: React.MouseEvent) => {
    if (hits >= 3) return;
    const n = hits + 1;
    setHits(n); setHit((k) => k + 1);
    sfx(n === 1 ? 'hit1' : n === 2 ? 'hit2' : 'hit3');
    if (n === 3) {
      if (settings.sound) playCue('mined');
      collect(w);
      sfx('keep');
      const r = (e.currentTarget as HTMLElement).closest('.mf-content')!.getBoundingClientRect();
      setTimeout(() => { onMined(w, e.clientX - r.left, e.clientY - r.top); setHits(0); }, 260);
    }
  };
  return (
    <button
      className={`mf-ore${picked ? ' picked' : ''}${hits === 1 ? ' crack-1' : ''}${hits === 2 ? ' crack-2' : ''}${hits >= 3 ? ' breaking' : ''}${picked || w.evidence.cross_validated ? '' : ' thin'}`}
      key={hit} data-mine-week={w.week} data-mineral={picked ? undefined : m} data-picked={picked ? 'true' : undefined}
      style={{ left: xAt(weekFrac(w)), top: `${y}%`, width: size, animationDelay: `${i * 0.05}s` }}
      onClick={click} aria-label={`${rangeLabel(w)} · ${picked ? '고른 주 캐기' : '광석 캐기'} (${hits}/3)`} title={rangeLabel(w)}
    >
      {!picked && <span className="mf-glow" style={{ background: `radial-gradient(circle, ${MINERAL_HEX[m]}88, transparent 70%)` }} />}
      <img className="mf-core" src={MINERAL_IMG[m]} alt="" />
      <svg className="mf-crack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path className="c1" d={CRACK_C1} /><path className="c2" d={CRACK_C2} /></svg>
    </button>
  );
}

/** 광석 세로 자리(%): 축 줄을 기본으로 하되, 4주 안의 앞선 광석과 세로로 11% 안이면 위아래로 번갈아 비켜 놓는다 */
function placeOres(ores: WeekRecord[]): number[] {
  const out: number[] = [];
  ores.forEach((w, n) => {
    const base = 30 + (ROW[oreMineral(w) ?? '형석'] ?? 1.5) * 13;
    const near = ores.slice(0, n).map((o, k) => ({ o, y: out[k] })).filter(({ o }) => Math.abs(weekFrac(o) - weekFrac(w)) * 52 < 4);
    let y = base;
    for (let step = 1; near.some((p) => Math.abs(p.y - y) < 11) && step < 8; step++) y = base + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * 11;
    out.push(Math.max(12, Math.min(76, y)));
  });
  return out;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** 월 타임라인: 그해의 모든 주를 결 무늬 눈금으로. 눈금을 누르면 그 주를 골라 캘 수 있다 */
function Timeline({ year, weeks, picking, onPick }: { year: number; weeks: WeekRecord[]; picking?: string; onPick: (w: WeekRecord) => void }) {
  return (
    <div className="mf-timeline" role="group" aria-label={`${year}년 월 타임라인 · 주를 골라 캐기`}>
      {MONTHS.map((m) => <span key={m} className="mf-month" style={{ left: xAt((m - 1) / 12) }}>{m}월</span>)}
      {weeks.map((w) => (
        <button key={w.week} type="button" data-week={w.week}
          className={`mf-tick g-${w.gyeol ?? 'none'}${w.candidate ? ' has-ore' : ''}${picking === w.week ? ' on' : ''}`}
          style={{ left: xAt(weekFrac(w)) }} onClick={() => onPick(w)}
          aria-label={`${rangeLabel(w)}${w.gyeol ? ` · ${GYEOL_TEXT[w.gyeol].name}` : ''}${w.candidate ? ' · 광석이 박힌 주' : ''}`} title={rangeLabel(w)} />
      ))}
    </div>
  );
}

/** ③ 내려가기의 엘리베이터: 지상에서 가장 최근 해까지 한 번 내려간다. 누르는 것은 막지 않는다 */
function Elevator({ top }: { top: number | undefined }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const release = sceneOverlay('elevator');
    const t = setTimeout(() => { setGone(true); release(); }, 1400);
    return () => { clearTimeout(t); release(); };
  }, []);
  if (gone) return null;
  return (
    <div className="mf-elevator" aria-hidden="true">
      <div className="mf-elev-cab"><span className="mf-elev-floor">지상</span><span className="mf-elev-floor">{top ?? ''}</span></div>
    </div>
  );
}

function monthOf(w: WeekRecord) {
  const [y, m] = w.date_start.split('-').map(Number);
  return `${y}년 ${m}월이네요.`;
}

// 같은 내려가기(관측소에서 한 번 누름)로는 엘리베이터와 오늘 보기의 주 맞추기를 한 번만 한다(상세에서 돌아올 때는 다시 안 함)
let shownDescent = 0;

export function MineField({ descent = 0, focusWeek: focusIn, focusYear, onMine }: { descent?: number; focusWeek?: string; focusYear?: number; onMine?: (week: string) => void } = {}) {
  void focusYear; void onMine;
  const [fresh] = useState(() => { if (descent > shownDescent) { shownDescent = descent; return true; } return false; });
  const descend = fresh;
  const focusWeek = fresh ? focusIn : undefined;
  const { weeks, byKey, select } = useStore();
  const { byYear, allByYear } = useMemo(() => {
    const m = new Map<number, WeekRecord[]>();
    const all = new Map<number, WeekRecord[]>();
    for (const w of weeks) {
      const y = Number(w.week.split('-W')[0]);
      if (!m.has(y)) { m.set(y, []); all.set(y, []); }
      all.get(y)!.push(w);
      if (w.candidate && w.mineral && w.mineral in MINERAL_IMG) m.get(y)!.push(w);
    }
    return { byYear: m, allByYear: all };
  }, [weeks]);
  const [picking, setPicking] = useState<string | undefined>(focusWeek);
  const [called, setCalled] = useState<string>();
  const years = useMemo(() => [...byYear.keys()].sort((a, b) => b - a), [byYear]); // 위가 최근, 아래로 오래됨
  const [year, setYear] = useState<number>();
  const [card, setCard] = useState<{ w: WeekRecord; x: number; y: number }>();
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  // 화면 한가운데 걸친 지층의 해를 큰 연도로 보여 준다
  const sync = () => {
    const sc = scroller.current; if (!sc) return;
    const mid = sc.getBoundingClientRect().top + sc.clientHeight * 0.55;
    let cur = years[0];
    sc.querySelectorAll<HTMLElement>('.mf-layer').forEach((el) => { if (el.getBoundingClientRect().top <= mid) cur = Number(el.dataset.year); });
    setYear(cur);
    fieldDepth(years.indexOf(cur), years.length);
  };
  useEffect(() => { sync(); }, [years]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (y: number | undefined) => {
    if (y === undefined) return;
    const el = scroller.current?.querySelector<HTMLElement>(`.mf-layer[data-year="${y}"]`);
    if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop - scroller.current.clientHeight * 0.3, behavior: 'smooth' });
    setCard(undefined);
  };
  // 오늘 보기에서 고른 주로 내려오면 그 해로 스크롤하고 그 주를 캘 준비를 한다
  useEffect(() => {
    const w = focusWeek ? byKey.get(focusWeek) : undefined;
    if (!w) return;
    const t = setTimeout(() => { go(Number(w.week.split('-W')[0])); pick(w); }, descend ? 900 : 50);
    return () => clearTimeout(t);
  }, [focusWeek]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (w: WeekRecord) => {
    setCalled(monthOf(w));
    if (w.candidate && w.mineral && w.mineral in MINERAL_IMG) {
      setPicking(undefined);
      scroller.current?.querySelector<HTMLElement>(`.mf-ore[data-mine-week="${w.week}"]`)?.focus();
      return;
    }
    setPicking(w.week);
    setTimeout(() => scroller.current?.querySelector<HTMLElement>(`.mf-ore[data-mine-week="${w.week}"]`)?.focus(), 30);
  };
  const cur = year ?? years[0];
  const i = years.indexOf(cur);
  const W = content.current?.clientWidth ?? 1200;
  // 카드는 광석 오른쪽에, 자리가 없으면 왼쪽에 둔다. 좁은 화면에서도 화면 밖으로 나가지 않게 가둔다
  const cardW = Math.min(300, W * 0.78);
  const cardLeft = card ? (card.x + 22 + cardW > W ? card.x - cardW - 22 : card.x + 22) : 0;
  const cardPos = card && { left: Math.max(8, Math.min(W - cardW - 8, cardLeft)), top: Math.max(10, card.y - 30) };
  return (
    <div className="minefield" role="region" aria-label="광물 지하">
      <div className="mf-scroll" ref={scroller} onScroll={sync}>
        <div className="mf-content" ref={content}>
          <div className="mf-sky">
            <svg className="mf-strata" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id="mfSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#cfe0e6" /><stop offset="55%" stopColor="#8a8f92" /><stop offset="100%" stopColor="#4b4a4d" /></linearGradient></defs>
              <rect x="0" y="0" width="1000" height="560" fill="url(#mfSky)" />
              {LAYERS.slice(0, 5).map((L) => <path key={L.y} d={`${wave(L.y * 2 + 120, L.amp, L.phase)} L1000,1000 L0,1000 Z`} fill={L.color} />)}
            </svg>
          </div>
          {years.map((y, k) => {
            const st = stratumFor(y);
            const ores = byYear.get(y) ?? [];
            return (
              <section key={y} className="mf-layer" data-year={y} aria-label={`${y}년 지층 · 광물 ${ores.length}개`} style={{ filter: `brightness(${Math.max(0.55, 1 - k * 0.04)})` }}>
                <img className="mf-band" src={st.src} alt="" />
                <span className="mf-layer-year" aria-hidden="true">{y}</span>
                {!st.own && <span className="mf-band-note">이 해의 지층 그림은 아직 없어 다른 해 그림을 씁니다</span>}
                {(() => { const tops = placeOres(ores); return ores.map((w, n) => <Ore key={w.week} w={w} i={n} top={tops[n]} onMined={(ww, x, yy) => { sfx('card'); setCard({ w: ww, x, y: yy }); }} />); })()}
                {(() => {
                  const pw = picking ? byKey.get(picking) : undefined;
                  return pw && Number(pw.week.split('-W')[0]) === y && !pw.candidate
                    ? <Ore key={`p-${pw.week}`} w={pw} i={0} picked onMined={(ww, x, yy) => { sfx('card'); setPicking(undefined); setCard({ w: ww, x, y: yy }); }} />
                    : null;
                })()}
                {!ores.length && <p className="mf-empty">{y}년에는 평소를 벗어난 주가 없습니다. 아래 타임라인에서 주를 골라 캘 수 있습니다.</p>}
                <Timeline year={y} weeks={allByYear.get(y) ?? []} picking={picking} onPick={pick} />
              </section>
            );
          })}
          <div className="mf-bedrock" aria-hidden="true" />
          {card && cardPos && (
            <div className="mf-card" style={cardPos} role="dialog" aria-label="기록 조각">
              <button className="mf-card-x" onClick={() => setCard(undefined)} aria-label="닫기">✕</button>
              <div className="mf-card-eyebrow">
                {(() => { const m = oreMineral(card.w); return m ? <i className="mf-card-dot" style={{ background: MINERAL_HEX[m] }} /> : null; })()}
                {rangeLabel(card.w)}{customOreName(card.w.week) ? ` · ${customOreName(card.w.week)}` : ''}
                {card.w.candidate ? (card.w.evidence.cross_validated ? ' · 교차 확인' : '') : ' · 직접 고른 광석'}
              </div>
              <p className="mf-card-line">{card.w.candidate ? (card.w.sentence_plain ?? card.w.sentence) : pickedLine(card.w)}</p>
              {(() => {
                const miss = missingUsual(card.w, weeks);
                return miss.length > 0 && <p className="mf-card-miss">그 주에 평소 있던 기록 중 {miss.length}종이 비어 있습니다({miss.map((c) => CHANNEL_LABEL[c]).join('·')}).</p>;
              })()}
              <button className="mf-card-next" onClick={() => select(card.w.week)}>상세 페이지에서 이어보기 →</button>
            </div>
          )}
        </div>
      </div>
      <div className="mf-scanner" aria-hidden="true"><i /><i /></div>
      {descend && <Elevator top={years[0]} />}
      {called && <p className="mf-called" role="status">{called}</p>}
      <div className="mf-picker">
        <button className="mf-chev" onClick={() => go(years[i - 1])} disabled={i <= 0} aria-label="다음 해(위로)">‹</button>
        <h2 className="mf-year" key={cur}>{cur}</h2>
        <button className="mf-chev" onClick={() => go(years[i + 1])} disabled={i >= years.length - 1} aria-label="이전 해(아래로)">›</button>
      </div>
      <nav className="mf-years" aria-label="연도">
        {years.map((y) => (
          <button key={y} className={`mf-yr${y === cur ? ' on' : ''}`} onClick={() => go(y)} aria-current={y === cur ? 'true' : undefined}>
            <span className="arrow">▶</span>{y}{(byYear.get(y)?.length ?? 0) > 0 && <small> · {byYear.get(y)!.length}</small>}
          </button>
        ))}
      </nav>
      <div className="mf-brand" aria-hidden="true">
        <img className="mindy" src={ART.mindiCharacter} alt="" />
        <img className="logo" src={ART.logoLight} alt="" />
        <div className="tagline">Your Mind In Your Mine D</div>
      </div>
      <p className="mf-hint">아래로 내려갈수록 오래된 해입니다. 광물을 곡괭이로 세 번 치면 그 주의 기록 조각이 나옵니다. 타임라인에서 아무 주나 골라 캘 수도 있습니다.</p>
    </div>
  );
}

/** 직접 고른 주의 기록 조각 문장: 판정하지 않고, 가장 크게 움직인 지표와 방향만 적는다 */
function pickedLine(w: WeekRecord): string {
  const p = pickedMineral(w);
  if (!p) return '이 주에는 지표를 견줄 기록이 남아 있지 않습니다. 남은 글과 사진은 상세에서 볼 수 있습니다.';
  return `평소 범위 안팎을 견주면, 이 주에 가장 크게 움직인 지표는 ${axisScreen(p.axis)}(평소보다 ${p.dir === 'up' ? '많은' : '적은'} 쪽)입니다.`;
}
