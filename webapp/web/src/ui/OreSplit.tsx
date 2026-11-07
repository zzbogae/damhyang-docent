// v2(11/03) 쪼개진 광석: 곡괭이로 세 번 치면 광석이 두 쪽으로 갈라지고, 안쪽 단면에 결(줄무늬)이 보인다.
// 읽는 규칙(결 색 범례 인계 v1 §3, 대본집 v1.1 7-3·8-2):
//  - 색 = 어떤 지표·어느 쪽(팀 9/23 확정 광물 색: 축 × 방향. 예 걸음이 많았던 쪽 = 호박색)
//  - 띠 두께 = 그 주에서 그 지표가 평소와 얼마나 떨어졌나(대표값 백분위가 가운데서 먼 정도). 두꺼울수록 그 주를 많이 차지
//  - 무늬 = 색 대신 읽는 표시(수면 물결 · 걸음 점 · 언어 평행선 · 소통 겹 고리) — 색만으로 정보를 주지 않는다(WCAG 1.4.1)
//  - 평소 범위 안의 지표는 회갈색 얇은 띠. 판정어(부족·저하·과다)는 쓰지 않는다.
import { useId } from 'react';
import { AXES, axisScreen, type Axis, type WeekRecord } from '../types';
import { MINERAL_BY_AXIS_DIR, type Mineral } from './minerals';
import { ART } from './design';

export interface Band { axis: Axis; dir: 'up' | 'down' | 'usual' | 'none'; weight: number }

const PATTERN: Record<Axis, string> = { rest: '물결', move: '점', lang: '평행선', talk: '겹 고리' };
const STONE = '#8c8580';

/**
 * 그 주의 네 지표 → 결 띠(두꺼운 것부터). 광석 겉색을 정한 지표는 축 대표값이 평소 범위 안이어도 그 방향으로 칠한다
 * (축 값은 지표 z 의 중앙값이라, 지표 하나만 크게 벗어난 주도 대표값은 평소일 수 있다 — Gyeol.tsx 주석과 같은 이유).
 * 형석(여러 지표)은 평소에서 가장 먼 두 지표를 그 방향으로 칠한다.
 */
export function bandsOf(w: WeekRecord, mineral?: Mineral | null): Band[] {
  const base: Band[] = AXES.map((axis) => {
    const a = w.axes[axis];
    if (!a) return { axis, dir: 'none' as const, weight: 0.06 };
    const far = Math.abs(a.pr - 0.5) * 2; // 0(한가운데) ~ 1(가장 멂)
    const dir = a.pr >= 0.9 ? 'up' as const : a.pr <= 0.1 ? 'down' as const : 'usual' as const;
    return { axis, dir, weight: dir === 'usual' ? 0.08 + far * 0.12 : 0.25 + far * 0.75 };
  });
  const lean = (b: Band): 'up' | 'down' => ((w.axes[b.axis]?.pr ?? 0.5) >= 0.5 ? 'up' : 'down');
  if (mineral && mineral !== '형석') {
    for (const ax of AXES) for (const d of ['up', 'down'] as const) {
      if (MINERAL_BY_AXIS_DIR[ax][d] !== mineral) continue;
      const b = base.find((x) => x.axis === ax)!;
      b.dir = d; b.weight = Math.max(b.weight, 0.7);
    }
  } else if (mineral === '형석' && base.filter((b) => b.dir === 'up' || b.dir === 'down').length < 2) {
    [...base].filter((b) => b.dir !== 'none').sort((x, y) => y.weight - x.weight).slice(0, 2)
      .forEach((b) => { if (b.dir === 'usual') { b.dir = lean(b); b.weight = Math.max(b.weight, 0.5); } });
  }
  return base.sort((x, y) => y.weight - x.weight);
}

/** 결 색 범례(튜토리얼 설명란디자인·결색범례 인계 v1 §3): 색 = 지표, 밝은 톤 = 평소보다 많음, 짙은 톤 = 적음, 회갈 = 평소 범위 */
export const AXIS_HEX: Record<Axis, string> = { rest: '#4A6FD1', move: '#E8894A', lang: '#9B6BD6', talk: '#3FB3A8' };
function mix(hex: string, to: number, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
export function bandColor(b: Band): string {
  if (b.dir === 'up') return mix(AXIS_HEX[b.axis], 255, 0.22);
  if (b.dir === 'down') return mix(AXIS_HEX[b.axis], 0, 0.32);
  return STONE;
}

/**
 * 11/06 보별: 단희 원 디자인(MIND Stone Insection Concept · StoneA_Cut)대로, 검은 돌을 깨면 안쪽 정동(빈 속)에서 색이 나온다.
 * 정동 결의 밝기·질감은 원 그림 그대로 두고, 색만 그 주의 결 띠(범례 색)로 바꿔 동심 고리로 칠한다(바깥 = 가장 두꺼운 띠).
 * 고리 너비 = 띠 두께(비율). 가운데 빛점 = 그 주에서 가장 크게 움직인 지표의 색.
 */
export function GeodeCore({ bands, label, className = '' }: { bands: Band[]; label: string; className?: string }) {
  const shown = bands.filter((b) => b.dir !== 'none');
  const total = shown.reduce((sum, b) => sum + b.weight, 0) || 1;
  // 바깥(100%)에서 안쪽(0%)으로: 두꺼운 띠부터 바깥에. 두 바퀴 돌려 마노 결처럼 겹친다
  const stops: string[] = [];
  const reps = 2;
  let at = 100;
  for (let r = 0; r < reps; r++) {
    for (const b of shown) {
      const w = (b.weight / total) * (100 / reps);
      const c = bandColor(b);
      const lo = Math.max(0, at - w);
      stops.push(`${c} ${at.toFixed(1)}%`, `${c} ${(lo + Math.min(1.6, w * 0.2)).toFixed(1)}%`, `rgba(255,248,236,.9) ${(lo + 0.5).toFixed(1)}%`, `${c} ${lo.toFixed(1)}%`);
      at = lo;
    }
  }
  const rings = `radial-gradient(ellipse 50% 56% at 60% 48%, ${stops.reverse().join(', ')})`;
  const lead = shown.find((b) => b.dir === 'up' || b.dir === 'down');
  const spark = lead ? bandColor(lead) : STONE;
  return (
    <figure className={`geode ${className}`} aria-label={label}>
      <img className="geode-shell" src={ART.stoneCut} alt="" />
      <div className="geode-tone" style={{ background: rings, WebkitMaskImage: `url(${ART.stoneCutCavity})`, maskImage: `url(${ART.stoneCutCavity})` }} aria-hidden="true" />
      <div className="geode-light" style={{ background: rings, WebkitMaskImage: `url(${ART.stoneCutCavity})`, maskImage: `url(${ART.stoneCutCavity})` }} aria-hidden="true" />
      <i className="geode-spark" style={{ background: `radial-gradient(circle, #fff 0, ${spark} 30%, transparent 70%)` }} aria-hidden="true" />
    </figure>
  );
}

export function bandWord(b: Band): string {
  const name = axisScreen(b.axis);
  if (b.dir === 'none') return `${name} · 기록 없음`;
  if (b.dir === 'usual') return `${name} · 평소 범위`;
  return `${name} · 평소보다 ${b.dir === 'up' ? '많았음' : '적었음'}`;
}

function Pattern({ id, axis }: { id: string; axis: Axis }) {
  const s = 'rgba(255,255,255,.55)';
  return (
    <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
      {axis === 'rest' && <path d="M0 6 Q3 2 6 6 T12 6" fill="none" stroke={s} strokeWidth="1.2" />}
      {axis === 'move' && <><circle cx="3" cy="4" r="1.3" fill={s} /><circle cx="9" cy="9" r="1.3" fill={s} /></>}
      {axis === 'lang' && <><path d="M0 3 H12 M0 7 H12" stroke={s} strokeWidth=".9" /></>}
      {axis === 'talk' && <><circle cx="6" cy="6" r="3.6" fill="none" stroke={s} strokeWidth=".9" /><circle cx="6" cy="6" r="1.6" fill="none" stroke={s} strokeWidth=".9" /></>}
    </pattern>
  );
}

/**
 * 갈라진 광석 그림. open=false 면 닫힌 덩어리, true 면 두 쪽이 벌어지며 단면이 보인다.
 * 겉은 광물 그림(img) 그대로 두 쪽으로 자르고(clip-path), 가운데 단면은 결 띠를 SVG 로 그린다.
 */
export function OreSplit({ img, bands, open = true, size = 160, label }: { img?: string; bands: Band[]; open?: boolean; size?: number; label: string }) {
  const uid = useId().replace(/:/g, '');
  const total = bands.reduce((s, b) => s + b.weight, 0) || 1;
  let y = 8;
  const H = 84;
  return (
    <figure className={`ore-split${open ? ' open' : ''}`} style={{ width: size, height: size }} aria-label={label}>
      {img && <img className="ore-half l" src={img} alt="" />}
      {img && <img className="ore-half r" src={img} alt="" />}
      <svg className="ore-core" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          {AXES.map((ax) => <Pattern key={ax} id={`${uid}-${ax}`} axis={ax} />)}
          <clipPath id={`${uid}-gem`}><path d="M50 4 L88 30 L80 82 L50 96 L20 82 L12 30 Z" /></clipPath>
        </defs>
        <g clipPath={`url(#${uid}-gem)`}>
          <rect width="100" height="100" fill="#241f2c" />
          {bands.map((b) => {
            const h = (b.weight / total) * H;
            const top = y; y += h;
            return (
              <g key={b.axis}>
                <rect x="0" y={top} width="100" height={h} fill={bandColor(b)} opacity={b.dir === 'down' ? 0.95 : b.dir === 'up' ? 0.85 : 0.55} />
                {b.dir !== 'none' && <rect x="0" y={top} width="100" height={h} fill={`url(#${uid}-${b.axis})`} />}
              </g>
            );
          })}
        </g>
        <path d="M50 4 L88 30 L80 82 L50 96 L20 82 L12 30 Z" fill="none" stroke="rgba(246,239,228,.35)" strokeWidth="1" />
      </svg>
    </figure>
  );
}

export const patternWord = (ax: Axis) => PATTERN[ax];
