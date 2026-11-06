// v2(11/03) 「광석 읽는 법」 창: 광석 9종마다 닫힌 모습 · 쪼개진 모습 · 그 광석이 나타내는 지표를 한 장에 보여 준다(보별 요청).
// 근거: 광물 9종(팀 9/23 확정 · 축 × 방향 8종 + 여러 축 형석), 결 색 범례 인계 v1 §2-4 「광석 읽는 법」 카드, 대본집 v1.1 6-2·7-3·8-2.
// 원칙: 「좋은 광석, 나쁜 광석은 없어요.」 많았다·적었다만 쓰고 판정어는 쓰지 않는다. 완성률·개수 순위는 보여 주지 않는다(v6 §11).
import { useEffect, useRef, useState } from 'react';
import { ART, MINERAL_IMG } from './design';
import { MINERALS, MINERAL_BY_AXIS_DIR, MINERAL_HEX, type Mineral } from './minerals';
import { AXES, axisScreen, type Axis } from '../types';
import { GeodeCore, patternWord, type Band } from './OreSplit';
import { MindiMark } from './Icons';

const ABOUT: Record<Axis, { up: string; down: string }> = {
  rest: { up: '잠이 평소보다 길게 적힌 주', down: '잠이 평소보다 짧게 적힌 주' },
  move: { up: '걸음이 평소보다 많았던 주', down: '걸음이 평소보다 적었던 주' },
  lang: { up: '글을 평소보다 많이 남긴 주', down: '글을 평소보다 적게 남긴 주' },
  talk: { up: '주고받은 말이 평소보다 많았던 주', down: '주고받은 말이 평소보다 적었던 주' },
};

function meaning(m: Mineral): { axis?: Axis; dir?: 'up' | 'down'; title: string; text: string; bands: Band[] } {
  for (const ax of AXES) for (const dir of ['up', 'down'] as const) {
    if (MINERAL_BY_AXIS_DIR[ax][dir] === m) {
      const others = AXES.filter((a) => a !== ax).map((a, i) => ({ axis: a, dir: 'usual' as const, weight: 0.14 - i * 0.02 }));
      return { axis: ax, dir, title: `${axisScreen(ax)} · 평소보다 ${dir === 'up' ? '많음' : '적음'}`, text: ABOUT[ax][dir], bands: [{ axis: ax, dir, weight: 1 }, ...others] };
    }
  }
  // 형석: 두 가지 이상이 함께 평소와 달랐던 주(예시 띠는 걸음↑·언어↓)
  return {
    title: '여러 지표 · 함께 달랐음', text: '두 가지 이상이 함께 평소와 달랐던 주',
    bands: [{ axis: 'move', dir: 'up', weight: 0.7 }, { axis: 'lang', dir: 'down', weight: 0.6 }, { axis: 'rest', dir: 'usual', weight: 0.12 }, { axis: 'talk', dir: 'usual', weight: 0.1 }],
  };
}

export const ORE_READ_EVENT = 'mined:ore-read';
export const openOreRead = (m?: Mineral) => window.dispatchEvent(new CustomEvent(ORE_READ_EVENT, { detail: m }));

export function OreReadGuide() {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Mineral>('호박');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = (e: Event) => { const m = (e as CustomEvent<Mineral | undefined>).detail; if (m) setSel(m); setOpen(true); };
    addEventListener(ORE_READ_EVENT, on);
    return () => removeEventListener(ORE_READ_EVENT, on);
  }, []);
  useEffect(() => {
    if (!open) return;
    box.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [open]);
  if (!open) return null;
  const cur = meaning(sel);
  return (
    <div className="ore-read-back" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="ore-read" role="dialog" aria-modal="true" aria-label="광석 읽는 법" tabIndex={-1} ref={box}>
        <header className="ore-read-head">
          <h2 className="h2">광석 읽는 법</h2>
          <button className="btn quiet" onClick={() => setOpen(false)} aria-label="광석 읽는 법 닫기">닫기 ✕</button>
        </header>
        <div className="ore-read-main">
          <div className="ore-read-stage">
            <div className="ore-read-pair">
              <figure className="ore-whole"><img src={ART.stoneBasic} alt="" style={{ height: 150, width: 'auto', filter: `drop-shadow(0 0 14px ${MINERAL_HEX[sel]})` }} /><figcaption className="small">캐기 전</figcaption></figure>
              <div className="ore-read-arrow" aria-hidden="true">⛏ →</div>
              <div className="ore-whole"><GeodeCore bands={cur.bands} label={`${sel}을 쪼갠 단면`} className="ore-read-geode" /><span className="small">쪼갠 단면</span></div>
            </div>
            <h3 className="ore-read-name"><i style={{ background: MINERAL_HEX[sel] }} aria-hidden="true" />{sel}</h3>
            <p className="ore-read-title">{cur.title}</p>
            <p>{cur.text}에 생깁니다.{cur.axis && <> 결 무늬는 <b>{patternWord(cur.axis)}</b>입니다.</>}</p>
            <div className="isl-msg mindi"><MindiMark size={32} /><p>꺼냈습니다. 안쪽 줄무늬가 결이에요. 띠가 두꺼운 색일수록 그 주를 많이 차지한 거예요.</p></div>
          </div>
          <div className="ore-read-side">
            <table className="ore-read-rules">
              <caption className="sr-only">보이는 것과 뜻</caption>
              <tbody>
                <tr><th scope="row">겉색</th><td>그 주에 평소와 가장 많이 달랐던 지표와 방향</td></tr>
                <tr><th scope="row">단면 띠</th><td>네 지표(수면·걸음·언어·소통). 두꺼울수록 평소에서 멀었음</td></tr>
                <tr><th scope="row">무늬</th><td>수면 물결 · 걸음 점 · 언어 평행선 · 소통 겹 고리</td></tr>
                <tr><th scope="row">회갈색 얇은 띠</th><td>평소 범위 안이었던 지표</td></tr>
                <tr><th scope="row">평소</th><td>언제나 직전 1년의 나. 남과 견주지 않습니다</td></tr>
              </tbody>
            </table>
            <div className="ore-read-grid" role="listbox" aria-label="광석 9종">
              {MINERALS.map((m) => {
                const x = meaning(m);
                return (
                  <button key={m} role="option" aria-selected={m === sel} className={`ore-read-cell${m === sel ? ' on' : ''}`} onClick={() => setSel(m)}>
                    <img src={MINERAL_IMG[m]} alt="" />
                    <span>{m}</span>
                    <small>{x.title}</small>
                  </button>
                );
              })}
            </div>
            <p className="small muted">좋은 광석, 나쁜 광석은 없어요. 평소와 달랐던 주에 생길 뿐입니다. 의학적 평가나 진단이 아닙니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
