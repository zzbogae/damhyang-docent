// v2(11/03) 섬으로 가기: 메인 첫 화면(안개 낀 관측소)에서 안개가 걷히며 섬이 드러나고, 「섬으로 들어가기」로 개인 공간에 들어간다.
// 나의 공간 규칙(10키워드 v3 · 1인칭·날씨·사운드): 섬은 자라거나 조립되지 않고 안개가 걷히며 드러난다. 섬 안에서는 관측소를 보이지 않고,
// 민디는 따라오지 않는다(경계에서 말없이 남는다). 곡은 안개가 걷힐 때 2~3초에 걸쳐 들어온다. 소리는 장소와 고른 환경에만 반응한다.
import { useEffect, useRef, useState } from 'react';
import { ART, ISLAND_ART, MINERAL_IMG } from './design';
import { setIslandTrack, sfx } from '../mindi/soundKit';
import { artFor, optsLine, trackFor, type IslandOpts } from './IslandMake';
import { MusicButton } from './MusicButton';
import { clipOf } from './islandClips';
import { oreMineral } from '../ore/collection';
import { MINERAL_HEX, type Mineral } from './minerals';
import { dateLabel } from '../mindi/templates';
import type { WeekRecord } from '../types';

export interface VisitRow { id: string; name: string; ores: string[]; words: string[]; opts?: IslandOpts; clip?: string }

const TINT: Record<string, string> = {
  새벽: 'rgba(90, 120, 190, .28)', 아침: 'rgba(255, 220, 170, .14)', 점심: 'rgba(255, 255, 255, 0)',
  해질녘: 'rgba(240, 140, 70, .26)', 밤: 'rgba(14, 18, 48, .55)',
};

/** 비·눈 입자(캔버스). 고른 날씨에만 반응한다 */
function Weather({ kinds }: { kinds: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rain = kinds.some((k) => /비|장마|소나기/.test(k));
  const snow = kinds.some((k) => /눈|겨울/.test(k));
  useEffect(() => {
    const c = ref.current;
    if (!c || (!rain && !snow)) return;
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const fit = () => { c.width = c.clientWidth; c.height = c.clientHeight; };
    fit(); addEventListener('resize', fit);
    const N = rain ? 160 : 110;
    const ps = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 0.8, d: Math.random() * Math.PI * 2 }));
    const loop = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of ps) {
        if (rain) {
          p.y += 0.018 * p.s; p.x += 0.002;
          ctx.strokeStyle = 'rgba(210, 225, 240, .45)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.x * c.width, p.y * c.height); ctx.lineTo(p.x * c.width - 3, p.y * c.height - 16 * p.s); ctx.stroke();
        } else {
          p.y += 0.0022 * p.s; p.d += 0.02; p.x += Math.sin(p.d) * 0.0006;
          ctx.fillStyle = 'rgba(255, 255, 255, .8)';
          ctx.beginPath(); ctx.arc(p.x * c.width, p.y * c.height, 1.4 + p.s * 1.6, 0, Math.PI * 2); ctx.fill();
        }
        if (p.y > 1.05) { p.y = -0.05; p.x = Math.random(); }
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', fit); };
  }, [rain, snow]);
  const fog = kinds.some((k) => /안개|흐림/.test(k));
  const sun = kinds.some((k) => /햇살|여름|맑/.test(k));
  return (
    <>
      {sun && <div className="isl-sun" aria-hidden="true" />}
      {fog && <div className="isl-mist" aria-hidden="true" />}
      {(rain || snow) && <canvas ref={ref} className="isl-weather" aria-hidden="true" />}
    </>
  );
}

export function IslandVisit({ row, byKey, onExit }: { row: VisitRow; byKey: Map<string, WeekRecord>; onExit: () => void }) {
  const o: IslandOpts = row.opts ?? { weather: [], excluded: [] };
  const art = ISLAND_ART[artFor(o.place)];
  const clip = clipOf(row.clip);
  const track = clip && !o.music ? clip.track : trackFor(o);
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState<'fog' | 'clearing' | 'revealed' | 'inside'>(still ? 'revealed' : 'fog');
  const [view, setView] = useState<'inside' | 'above'>('inside');
  useEffect(() => {
    if (still) { setIslandTrack(track); return () => setIslandTrack(undefined); }
    const a = setTimeout(() => { setPhase('clearing'); sfx('fogClear'); setIslandTrack(track); }, 1400);
    const b = setTimeout(() => setPhase('revealed'), 5200);
    return () => { clearTimeout(a); clearTimeout(b); setIslandTrack(undefined); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit(); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onExit]);
  const ores = row.ores.map((k) => byKey.get(k)).filter(Boolean) as WeekRecord[];
  const inside = phase === 'inside';
  return (
    <div className={`isl-visit-full ${phase}${inside ? ` view-${view}` : ''}`} role="dialog" aria-modal="true" aria-label={`${row.name}으로 가는 길`}>
      {!inside && (
        <div className="isl-reveal">
          <img className="isl-from" src={ART.introPoster} alt="" />
          {clip
            ? <video className="isl-to" src={clip.src} poster={clip.poster} muted loop playsInline autoPlay={!still} aria-label={`안개가 걷힌 자리에 ${clip.label}이 보입니다`} />
            : <img className="isl-to" src={art.reveal} alt={`안개가 걷힌 자리에 ${art.label}이 보입니다`} />}
          <div className="isl-fog f1" aria-hidden="true" /><div className="isl-fog f2" aria-hidden="true" />
          <p className="isl-cap">{phase === 'fog' ? '안개가 걷히고 있어요' : phase === 'clearing' ? '' : row.name}</p>
          {phase === 'revealed' && (
            <div className="isl-cta">
              <button className="btn primary" onClick={() => { sfx('door'); setPhase('inside'); }}>섬으로 들어가기</button>
              <button className="btn quiet" onClick={onExit}>관측소로 돌아가기</button>
            </div>
          )}
          <p className="isl-note small">{clip ? `고른 영상 · ${clip.label}` : `가장 가까운 예시 그림으로 보여 드립니다 · ${art.label}`}</p>
        </div>
      )}
      {inside && (
        <div className="isl-inside">
          {clip && view === 'inside'
            ? <video className="isl-room" src={clip.src} poster={clip.poster} muted loop playsInline autoPlay={!still} aria-label={`${row.name} 안`} />
            : <img className="isl-room" src={view === 'inside' ? art.inside : art.reveal} alt={view === 'inside' ? `${row.name} 안` : `${row.name}을 내려다본 모습`} />}
          {view === 'inside' && o.time && <div className="isl-tint" style={{ background: TINT[o.time] ?? 'transparent' }} aria-hidden="true" />}
          <Weather kinds={[...o.weather, ...(o.time === '새벽' ? ['안개'] : [])]} />
          <header className="isl-hud">
            <button className="btn quiet" onClick={onExit}>‹ 관측소로</button>
            <div className="label-row" role="tablist" aria-label="보는 방법">
              <button role="tab" aria-selected={view === 'inside'} className={`btn${view === 'inside' ? ' primary' : ' quiet'}`} onClick={() => setView('inside')}>걸어 보기</button>
              <button role="tab" aria-selected={view === 'above'} className={`btn${view === 'above' ? ' primary' : ' quiet'}`} onClick={() => setView('above')}>내려다보기</button>
            </div>
            <MusicButton />
          </header>
          <section className="isl-panel" aria-label="이 섬">
            <h2 className="isl-name">{row.name}</h2>
            {optsLine(o) && <p className="small">{optsLine(o)}</p>}
            {row.words.length > 0 && <div className="label-row">{row.words.map((w) => <span key={w} className="chip">{w}</span>)}</div>}
            <ul className="isl-ores" aria-label="섬에 둔 광석">
              {ores.map((w) => {
                const m = oreMineral(w) as Mineral | null;
                return (
                  <li key={w.week}>
                    {m ? <img src={MINERAL_IMG[m]} alt="" style={{ filter: `drop-shadow(0 0 8px ${MINERAL_HEX[m]})` }} /> : <span className="archive-blank" aria-hidden="true" />}
                    <small>{dateLabel(w.date_start)}</small>
                  </li>
                );
              })}
            </ul>
            <div className="label-row">
              {['화분', '앨범', '메모', '창문'].map((t) => <button key={t} className="chip" disabled title="광석이 더 모이면 기억을 둘 자리가 생겨요">{t}</button>)}
            </div>
            <p className="small muted">광석이 더 모이면 꾸밀 자리가 생겨요. 민디는 관측소에 남아 있습니다.</p>
          </section>
        </div>
      )}
    </div>
  );
}
