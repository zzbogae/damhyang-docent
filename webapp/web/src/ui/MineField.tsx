// 광물 지하(드라이브 8/22 랜딩 3번 화면을 실제 판정값으로): 화면 전체가 지층이다.
// 맨 위가 하늘·지표이고, 아래로 스크롤할수록 한 해씩 더 오래된 지층(Team Art Assets 연도별 지층 그림)이 나온다.
// 가운데 위 민디 눈과 큰 연도는 지금 화면 한가운데 있는 지층의 해를 따라가고, ‹ ›·왼쪽 연도 목록은 그 지층으로 내려가거나 올라간다.
// 원본은 연도별 무작위 위치·무작위 광물이었지만, 여기서는 광물이 나온 주만 놓는다.
// 가로 = 그 주가 한 해 중 어디인지(1~53주), 세로 = 광물을 정한 축(걸음·쉼·화면·기록, 깊을수록 아래), 크기 = 서로 다른 근거 수. 난수는 쓰지 않는다.
// 10/23 버튼배치 확정(P6): 광석에 마우스를 올리거나 처음 누르면 광석 바로 위에 「2024년 4월 2주 · 캐기」 말풍선이 뜨고, 캐기는 P7 광석 캐기 화면에서 한다.
// 지층마다 월 타임라인이 있고 모든 주가 결 무늬 눈금으로 보인다. 광석 없는 주는 눈금을 고르면 그 자리에 「이 주 고르기」 점선 말풍선이 뜬다(10/23 D안).
// 연도 목록은 P5 층 표시기와 같은 오른쪽에 둔다. 엘리베이터는 P5 화면이 따로 맡는다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { rangeLabel } from '../mindi/templates';
import { fieldDepth, sfx } from '../mindi/soundKit';
import { MINERAL_IMG, ART, stratumFor } from './design';
import { MINERAL_BY_AXIS_DIR, MINERAL_HEX, type Mineral } from './minerals';
import { oreMineral } from '../ore/collection';
import type { WeekRecord } from '../types';
import './field.css';
import { GYEOL_TEXT } from './Gyeol';
import { openOreRead } from './OreReadGuide';

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
export const CRACK_C1 = 'M24,10 L40,32 L26,40 L46,62 L30,70 L48,90';
export const CRACK_C2 = 'M80,16 L58,30 L76,44 L52,58 L72,74 L54,92';

// 가로 자리: 한 해 안에서 몇 번째 주인지(0~1). 실제 위치는 CSS 변수 --mf-x0·--mf-xw 로 화면 폭에 맞춘다(좁은 화면은 더 넓게)
function weekFrac(w: WeekRecord) {
  return (Number(w.week.split('-W')[1]) - 1) / 52;
}
const xAt = (f: number) => `calc(var(--mf-x0) + var(--mf-xw) * ${f.toFixed(4)})`;

/** 「2024년 4월 2주」: 그 주 월요일이 그달 몇째 주인지 */
export function monthWeek(w: Pick<WeekRecord, 'date_start'>) {
  const [y, m, d] = w.date_start.split('-').map(Number);
  return `${y}년 ${m}월 ${Math.ceil(d / 7)}주`;
}

function Ore({ w, i, onMine, picked = false, top, left, open, onOpen }: { w: WeekRecord; i: number; onMine: (week: string) => void; picked?: boolean; top?: number; left?: number; open: boolean; onOpen: (week: string | undefined) => void }) {
  const touch = useRef(false);
  const wasOpen = useRef(false);
  const m = (oreMineral(w) ?? '형석') as Mineral;
  const y = top ?? 30 + (ROW[m] ?? 1.5) * 13;
  const size = picked ? 44 : 40 + Math.min(3, w.evidence.independent ?? 1) * 8;
  // 11/06 전시(멘토: 여러 색 = 지표 3개 이상): 세 지표 이상이 함께 움직인 광석은 그 지표 색들로 도는 빛을 두른다
  const multi = picked ? [] : [...new Map(w.badges.filter((b) => b.axis).map((b) => [b.axis!, MINERAL_HEX[MINERAL_BY_AXIS_DIR[b.axis!][b.direction === 'down' ? 'down' : 'up']]])).values()];
  const halo = multi.length >= 3 ? `conic-gradient(${[...multi, multi[0]].join(', ')})` : undefined;
  // 마우스는 올리면 말풍선이 이미 보이므로 한 번에 캐러 간다. 손가락은 첫 탭에 말풍선, 두 번째(또는 말풍선)에 캐러 간다
  const click = () => {
    if (touch.current && !wasOpen.current) { onOpen(w.week); return; }
    sfx('tap');
    onMine(w.week);
  };
  return (
    <div className={`mf-ore-wrap${open ? ' open' : ''}${halo ? ' multi' : ''}`} style={{ left: xAt(left ?? weekFrac(w)), top: `${y}%` }}
      onMouseEnter={() => onOpen(w.week)} onMouseLeave={() => onOpen(undefined)}>
      <button
        className={`mf-ore${picked ? ' picked' : ''}${picked || w.evidence.cross_validated ? '' : ' thin'}`}
        data-mine-week={w.week} data-mineral={picked ? undefined : m} data-picked={picked ? 'true' : undefined}
        style={{ width: Math.round(size * 0.78), animationDelay: `${i * 0.05}s` }}
        onPointerDown={(e) => { touch.current = e.pointerType === 'touch'; wasOpen.current = open; }}
        onFocus={() => onOpen(w.week)} onBlur={() => onOpen(undefined)}
        onClick={click} aria-label={`${monthWeek(w)} · ${picked ? '이 주 고르기' : '캐기'}`}
      >
        {halo && <span className="mf-halo" style={{ background: halo }} />}
        {!picked && <span className="mf-glow" style={{ background: `radial-gradient(circle, ${MINERAL_HEX[m]}88, transparent 70%)` }} />}
        {/* 11/06 보별: 원 디자인대로 캐기 전 광석은 검은 돌. 색은 깼을 때 안쪽에서 나온다(빛만 살짝 비친다) */}
        <img className="mf-core" src={ART.stoneBasic} alt="" />
      </button>
      <button type="button" tabIndex={-1} className={`mf-tip${picked ? ' pick' : ''}`} onClick={() => { sfx('tap'); onMine(w.week); }} aria-hidden="true">
        {picked ? '이 주 고르기' : `${monthWeek(w)}${halo ? ` · 여러 색 ${multi.length}가지` : ''} · 캐기`}
      </button>
    </div>
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

function monthOf(w: WeekRecord) {
  const [y, m] = w.date_start.split('-').map(Number);
  return `${y}년 ${m}월이네요.`;
}

// 11/06 보별 결정: 지층 맨 위는 최근 12주를 한 주씩 얇은 층으로, 그 아래로는 한 해씩 두꺼운 층이 이어진다
// (기록이 적을 땐 주가 쌓이는 게 보이고, 많이 쌓이면 해 단위로 읽는다)
const RECENT_WEEKS = 12;
const RECENT = 0; // 층 목록에서 「최근 12주」 묶음을 가리키는 표시
const floorName = (f: number) => (f === RECENT ? '최근 12주' : String(f));
const shortWeek = (w: WeekRecord) => monthWeek(w).replace(/^\d+년 /, '');
const hasOre = (w: WeekRecord) => !!(w.candidate && w.mineral && w.mineral in MINERAL_IMG);

// 같은 내려가기(엘리베이터·오늘 보기에서 한 번)로는 그 해·그 주 맞추기를 한 번만 한다(상세에서 돌아올 때는 다시 안 함)
let shownDescent = 0;

export function MineField({ descent = 0, focusWeek: focusIn, focusYear: yearIn, onMine }: { descent?: number; focusWeek?: string; focusYear?: number; onMine?: (week: string) => void } = {}) {
  const [fresh] = useState(() => { if (descent > shownDescent) { shownDescent = descent; return true; } return false; });
  const focusWeek = fresh ? focusIn : undefined;
  const focusYear = fresh ? yearIn : undefined;
  const { weeks, byKey } = useStore();
  const mine = (week: string) => onMine?.(week);
  const { byYear, allByYear, recent, recentSet } = useMemo(() => {
    const m = new Map<number, WeekRecord[]>();
    const all = new Map<number, WeekRecord[]>();
    for (const w of weeks) {
      const y = Number(w.week.split('-W')[0]);
      if (!m.has(y)) { m.set(y, []); all.set(y, []); }
      all.get(y)!.push(w);
      if (hasOre(w)) m.get(y)!.push(w);
    }
    // 맨 위 주 층: 가장 최근 12주(광석이 없는 주도 층은 쌓인다). 위가 가장 최근
    const recent = [...weeks].sort((a, b) => (a.date_start < b.date_start ? 1 : -1)).slice(0, RECENT_WEEKS);
    return { byYear: m, allByYear: all, recent, recentSet: new Set(recent.map((w) => w.week)) };
  }, [weeks]);
  const [picking, setPicking] = useState<string | undefined>(focusWeek && !byKey.get(focusWeek)?.candidate ? focusWeek : undefined);
  const [tip, setTip] = useState<string | undefined>(focusWeek);
  const [called, setCalled] = useState<string>();
  const years = useMemo(() => [...byYear.keys()].sort((a, b) => b - a), [byYear]); // 위가 최근, 아래로 오래됨
  const floors = useMemo(() => (recent.length ? [RECENT, ...years] : years), [recent, years]);
  // 해 층에 놓을 광석: 맨 위 주 층으로 올라간 최근 12주는 뺀다(같은 광석이 두 번 보이지 않게)
  const oresOf = (y: number) => (byYear.get(y) ?? []).filter((w) => !recentSet.has(w.week));
  const [year, setYear] = useState<number>();
  const scroller = useRef<HTMLDivElement>(null);
  // 화면 한가운데 걸친 지층의 해를 큰 연도로 보여 준다
  const sync = () => {
    const sc = scroller.current; if (!sc) return;
    const mid = sc.getBoundingClientRect().top + sc.clientHeight * 0.55;
    let cur = floors[0];
    sc.querySelectorAll<HTMLElement>('.mf-layer').forEach((el) => { if (el.getBoundingClientRect().top <= mid) cur = Number(el.dataset.year); });
    setYear(cur);
    fieldDepth(floors.indexOf(cur), floors.length);
  };
  useEffect(() => { sync(); }, [floors]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (y: number | undefined, smooth = true) => {
    if (y === undefined) return;
    const el = scroller.current?.querySelector<HTMLElement>(`.mf-layer[data-year="${y}"]`);
    if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop - scroller.current.clientHeight * 0.3, behavior: smooth ? 'smooth' : 'auto' });
  };
  // 엘리베이터에서 고른 해로 바로 내려와 있는다(하강 연출은 P5 가 이미 했다)
  useEffect(() => {
    if (focusYear === undefined) return;
    // 엘리베이터 「최근 12주」(0)는 맨 위 주 층으로. 광석을 모두 주 층에 올려 보낸 해로 오면(광석 캐고 「한 개 더 캐기」) 주 층부터 보여 준다
    const y = focusYear !== RECENT && recent.length && !oresOf(focusYear).length && (byYear.get(focusYear)?.length ?? 0) > 0 ? RECENT : focusYear;
    const t = setTimeout(() => go(y, false), 30);
    return () => clearTimeout(t);
  }, [focusYear]); // eslint-disable-line react-hooks/exhaustive-deps
  // 오늘 보기에서 고른 주로 내려오면 그 해로 스크롤하고 그 주 위에 말풍선을 띄운다
  useEffect(() => {
    const w = focusWeek ? byKey.get(focusWeek) : undefined;
    if (!w) return;
    const t = setTimeout(() => { go(recentSet.has(w.week) ? RECENT : Number(w.week.split('-W')[0]), false); pick(w); }, 50);
    return () => clearTimeout(t);
  }, [focusWeek]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (w: WeekRecord) => {
    setCalled(monthOf(w));
    if (hasOre(w)) {
      setPicking(undefined); setTip(w.week);
      scroller.current?.querySelector<HTMLElement>(`.mf-ore[data-mine-week="${w.week}"]`)?.focus();
      return;
    }
    sfx('tap');
    setPicking(w.week); setTip(w.week);
    setTimeout(() => scroller.current?.querySelector<HTMLElement>(`.mf-ore[data-mine-week="${w.week}"]`)?.focus(), 30);
  };
  const cur = year ?? floors[0];
  const i = floors.indexOf(cur);
  const pw = picking ? byKey.get(picking) : undefined;
  const hover = (k: string | undefined) => setTip((t) => (k ?? (t === picking ? t : undefined)));
  return (
    <div className="minefield" role="region" aria-label="연도 지층">
      <div className="mf-scroll" ref={scroller} onScroll={sync}>
        <div className="mf-content">
          <div className="mf-sky">
            <svg className="mf-strata" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id="mfSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#cfe0e6" /><stop offset="55%" stopColor="#8a8f92" /><stop offset="100%" stopColor="#4b4a4d" /></linearGradient></defs>
              <rect x="0" y="0" width="1000" height="560" fill="url(#mfSky)" />
              {LAYERS.slice(0, 5).map((L) => <path key={L.y} d={`${wave(L.y * 2 + 120, L.amp, L.phase)} L1000,1000 L0,1000 Z`} fill={L.color} />)}
            </svg>
          </div>
          {recent.length > 0 && (() => {
            const st = stratumFor(years[0] ?? new Date().getFullYear());
            return (
              <section className="mf-layer mf-weeks" data-year={RECENT} aria-label={`최근 ${recent.length}주 · 한 주가 한 층`}>
                <span className="mf-weeks-title" aria-hidden="true">최근 {recent.length}주 · 한 주가 한 층</span>
                {recent.map((w, k) => {
                  const own = hasOre(w);
                  const show = own ? w : pw?.week === w.week ? pw : undefined;
                  const lane = show ? 0.18 + ((ROW[oreMineral(show) ?? '형석'] ?? 1.5) / 3) * 0.62 : 0;
                  return (
                    <div key={w.week} className={`mf-wk${own ? ' has-ore' : ''}${picking === w.week ? ' on' : ''}`} data-week={w.week}>
                      <img className="mf-wk-band" src={st.src} alt="" style={{ objectPosition: `50% ${22 + ((k * 37) % 66)}%` }} />
                      <button type="button" className={`mf-wk-pick g-${w.gyeol ?? 'none'}`} onClick={() => pick(w)}
                        aria-label={`${rangeLabel(w)}${w.gyeol ? ` · ${GYEOL_TEXT[w.gyeol].name}` : ''}${own ? ' · 광석이 박힌 주' : ' · 이 주 고르기'}`}>
                        <span className="mf-wk-label">{shortWeek(w)}</span>
                      </button>
                      {show && <Ore w={show} i={k} picked={!own} top={50} left={lane} onMine={mine} open={tip === show.week} onOpen={hover} />}
                    </div>
                  );
                })}
                <span className="mf-weeks-foot" aria-hidden="true">여기서부터 아래는 한 해가 한 층</span>
              </section>
            );
          })()}
          {years.map((y, k) => {
            const st = stratumFor(y);
            const ores = oresOf(y);
            return (
              <section key={y} className="mf-layer" data-year={y} aria-label={`${y}년 지층 · 광물 ${ores.length}개`} style={{ filter: `brightness(${Math.max(0.55, 1 - k * 0.04)})` }}>
                <img className="mf-band" src={st.src} alt="" />
                <span className="mf-layer-year" aria-hidden="true">{y}</span>
                {!st.own && <span className="mf-band-note">이 해의 지층 그림은 아직 없어 다른 해 그림을 씁니다</span>}
                {(() => { const tops = placeOres(ores); return ores.map((w, n) => <Ore key={w.week} w={w} i={n} top={tops[n]} onMine={mine} open={tip === w.week} onOpen={hover} />); })()}
                {pw && Number(pw.week.split('-W')[0]) === y && !pw.candidate && !recentSet.has(pw.week) && (
                  <Ore key={`p-${pw.week}`} w={pw} i={0} picked top={62} onMine={mine} open={tip === pw.week} onOpen={hover} />
                )}
                {!ores.length && <p className="mf-empty">{(byYear.get(y)?.length ?? 0) > 0 ? `${y}년의 광석은 맨 위 「최근 12주」 층에 있습니다.` : `${y}년에는 평소를 벗어난 주가 없습니다.`} 아래 타임라인에서 주를 골라 캘 수 있습니다.</p>}
                <Timeline year={y} weeks={allByYear.get(y) ?? []} picking={picking} onPick={pick} />
              </section>
            );
          })}
          <div className="mf-bedrock" aria-hidden="true" />
        </div>
      </div>
      <div className="mf-scanner" aria-hidden="true"><i /><i /></div>
      {called && <p className="mf-called" role="status">{called}</p>}
      <div className="mf-picker">
        <button className="mf-chev" onClick={() => { sfx('floor'); go(floors[i - 1]); }} disabled={i <= 0} aria-label="위 층(최근)">◁</button>
        <h2 className={`mf-year${cur === RECENT ? ' weeks' : ''}`} key={cur}>{floorName(cur)}</h2>
        <button className="mf-chev" onClick={() => { sfx('floor'); go(floors[i + 1]); }} disabled={i >= floors.length - 1} aria-label="아래 층(오래됨)">▷</button>
      </div>
      <nav className="mf-years" aria-label="연도">
        {floors.map((y) => {
          const n = y === RECENT ? recent.filter(hasOre).length : oresOf(y).length;
          return (
            <button key={y} className={`mf-yr${y === cur ? ' on' : ''}`} onClick={() => { sfx('floor'); go(y); }} aria-current={y === cur ? 'true' : undefined}>
              <span className="arrow">▶</span>{floorName(y)}{n > 0 && <small> · {n}</small>}
            </button>
          );
        })}
      </nav>
      <div className="mf-brand" aria-hidden="true">
        <img className="mindy" src={ART.mindiCharacter} alt="" />
        <img className="logo" src={ART.logoLight} alt="" />
        <div className="tagline">Your Mind In Your Mine D</div>
      </div>
      <button className="mf-read-btn" onClick={() => openOreRead()}>광석 읽는 법</button>
      <p className="mf-hint">맨 위는 최근 12주(한 주가 한 층), 그 아래로 내려갈수록 오래된 해입니다. 광석을 누르면 캐러 갑니다. 타임라인에서 아무 주나 골라 캘 수도 있습니다.</p>
    </div>
  );
}
