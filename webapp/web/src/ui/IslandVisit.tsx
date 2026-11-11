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
import { DEMO_SNAPSHOT } from '../demo/snapshot';
import qrDemo from '../assets/qr-demo.svg';
import { requestSpaceImage, spaceImageBody } from '../space/spaceImage';

// 11/06 전시: 시연판(가짜 샘플)·전시 모드에서는 섬 안 마지막에 「당신의 기록이라면」 안내와 시연판 주소 QR 을 둔다
const SHOWCASE = DEMO_SNAPSHOT || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('kiosk'));

export interface VisitRow { id: string; name: string; ores: string[]; words: string[]; opts?: IslandOpts; clip?: string }

const TINT: Record<string, string> = {
  새벽: 'rgba(100, 130, 205, .36)', 아침: 'rgba(255, 220, 170, .16)', 점심: 'rgba(255, 255, 255, 0)',
  해질녘: 'rgba(238, 128, 58, .40)', 밤: 'rgba(14, 18, 60, .66)',
};
// 11/06 전시: 고른 시간에 빛도 더한다(해질녘 노을, 밤 달빛) — 곱하기 색만으로는 화면에서 잘 안 보였다
const GLOW: Record<string, string> = {
  해질녘: 'radial-gradient(ellipse 90% 60% at 70% 30%, rgba(255, 170, 90, .45), rgba(255, 120, 60, 0) 70%)',
  밤: 'radial-gradient(circle at 80% 14%, rgba(200, 215, 255, .35), rgba(200, 215, 255, 0) 30%)',
  새벽: 'linear-gradient(180deg, rgba(190, 205, 240, .25), rgba(190, 205, 240, 0) 60%)',
};
/** 고른 시대 → 영상 색(필름 느낌). 「시대 없음」·「지금」은 그대로 */
export const ERA_FILTER: Record<string, string> = {
  '1970년대': 'sepia(.5) saturate(.75) contrast(1.06)', '1980년대': 'sepia(.3) saturate(1.15) contrast(1.04)',
  '1990년대': 'sepia(.18) saturate(.88) contrast(.96) brightness(1.03)', '2000년대': 'saturate(.92) contrast(1.02)',
  '먼 미래': 'hue-rotate(-18deg) saturate(1.25) contrast(1.05)',
};
const OLD_ERA = /19[0-9]0년대/;

/** 섬 위에 고른 것을 입힌다: 시간 색·빛, 시대 필름 결, 날씨·계절 입자 */
export function IslandMood({ o, inside = true }: { o: IslandOpts; inside?: boolean }) {
  return (
    <>
      {inside && o.time && TINT[o.time] && <div className="isl-tint" style={{ background: TINT[o.time] }} aria-hidden="true" />}
      {inside && o.time && GLOW[o.time] && <div className="isl-glow" style={{ background: GLOW[o.time] }} aria-hidden="true" />}
      {o.era && OLD_ERA.test(o.era) && <div className="isl-grain" aria-hidden="true" />}
      <Weather kinds={[...o.weather, ...(o.time === '새벽' ? ['안개'] : [])]} />
    </>
  );
}

/** 비·눈 입자(캔버스). 고른 날씨에만 반응한다 */
function Weather({ kinds }: { kinds: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rain = kinds.some((k) => /비|장마|소나기/.test(k));
  const snow = kinds.some((k) => /눈|겨울/.test(k));
  // 11/06 전시: 봄은 꽃잎, 가을은 낙엽이 천천히 날린다(비·눈이 함께면 비·눈이 먼저)
  const petal = !rain && !snow && kinds.some((k) => /봄|벚/.test(k));
  const leaf = !rain && !snow && !petal && kinds.some((k) => /가을|낙엽/.test(k));
  const drift = petal || leaf;
  useEffect(() => {
    const c = ref.current;
    if (!c || (!rain && !snow && !drift)) return;
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const fit = () => { c.width = c.clientWidth; c.height = c.clientHeight; };
    fit(); addEventListener('resize', fit);
    const N = rain ? 220 : drift ? 46 : 120;
    const ps = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 0.8, d: Math.random() * Math.PI * 2 }));
    const loop = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of ps) {
        if (drift) {
          p.y += 0.0016 * p.s; p.d += 0.025; p.x += Math.sin(p.d) * 0.0014 + 0.0004;
          const r = (petal ? 3 : 5) + p.s * (petal ? 2.5 : 4);
          ctx.save(); ctx.translate(p.x * c.width, p.y * c.height); ctx.rotate(p.d);
          ctx.fillStyle = petal ? 'rgba(255, 196, 214, .9)' : `rgba(${200 + Math.round(p.s * 40)}, ${110 + Math.round(p.s * 40)}, 40, .9)`;
          ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        } else if (rain) {
          p.y += 0.02 * p.s; p.x += 0.002;
          ctx.strokeStyle = 'rgba(215, 228, 242, .62)'; ctx.lineWidth = 1.4;
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
  }, [rain, snow, petal, leaf]);
  const fog = kinds.some((k) => /안개|흐림/.test(k));
  const sun = kinds.some((k) => /햇살|여름|맑/.test(k));
  return (
    <>
      {sun && <div className="isl-sun" aria-hidden="true" />}
      {fog && <div className="isl-mist" aria-hidden="true" />}
      {(rain || snow || drift) && <canvas ref={ref} className="isl-weather" aria-hidden="true" />}
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
  // 11/12 멘토진: 고른 여섯 가지와 사전 단어로 섬 그림을 그 자리에서 그린다. 안개가 걷히는 동안(약 5초) 받아 오고,
  // 실패하거나 늦으면(서버 없음·상한·23초) 따로 알리지 않고 지금처럼 예시 영상을 보여 준다. 그림에는 천천히 다가가는 카메라(Ken Burns)를 입힌다.
  const [gen, setGen] = useState<{ state: 'off' | 'loading' | 'ok' | 'fail'; src?: string }>({ state: row.opts ? 'loading' : 'off' });
  useEffect(() => {
    if (!row.opts) return;
    let on = true;
    void requestSpaceImage(row.id, spaceImageBody(row.opts, row.words, row.clip)).then((r) => {
      if (on) setGen(r ? { state: 'ok', src: r.image } : { state: 'fail' });
    });
    return () => { on = false; };
  }, [row.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const genImg = gen.state === 'ok' ? gen.src : undefined;
  const ores = row.ores.map((k) => byKey.get(k)).filter(Boolean) as WeekRecord[];
  const inside = phase === 'inside';
  return (
    <div className={`isl-visit-full ${phase}${inside ? ` view-${view}` : ''}`} data-gen={gen.state} role="dialog" aria-modal="true" aria-label={`${row.name}으로 가는 길`}>
      {!inside && (
        <div className="isl-reveal">
          <img className="isl-from" src={ART.introPoster} alt="" />
          {clip
            ? <video className="isl-to" src={clip.src} poster={clip.poster} muted loop playsInline autoPlay={!still} style={{ filter: (o.era && ERA_FILTER[o.era]) || undefined }} aria-label={`안개가 걷힌 자리에 ${clip.label}이 보입니다`} />
            : <img className="isl-to" src={art.reveal} alt={`안개가 걷힌 자리에 ${art.label}이 보입니다`} />}
          {genImg && phase !== 'fog' && <img className="isl-gen" src={genImg} style={{ filter: (o.era && ERA_FILTER[o.era]) || undefined }} alt={`안개가 걷힌 자리에 고른 것으로 그린 ${row.name}이 보입니다`} />}
          {phase !== 'fog' && <div className="isl-mood-in"><IslandMood o={o} /></div>}
          <div className="isl-fog f1" aria-hidden="true" /><div className="isl-fog f2" aria-hidden="true" />
          <p className="isl-cap">{phase === 'fog' ? '안개가 걷히고 있어요' : phase === 'clearing' ? '' : row.name}</p>
          {phase === 'revealed' && (
            <div className="isl-cta">
              <button className="btn primary" onClick={() => { sfx('door'); setPhase('inside'); }}>섬으로 들어가기</button>
              <button className="btn quiet" onClick={onExit}>관측소로 돌아가기</button>
            </div>
          )}
          {gen.state === 'loading' && <p className="isl-gen-wait small" role="status"><span aria-hidden="true" />고른 것으로 섬을 그리고 있어요</p>}
          <p className="isl-note small">{genImg ? '고른 것으로 방금 그린 섬' : clip ? `고른 영상 · ${clip.label}` : `가장 가까운 예시 그림으로 보여 드립니다 · ${art.label}`}</p>
        </div>
      )}
      {inside && (
        <div className="isl-inside">
          {genImg && view === 'inside'
            ? <img className="isl-room isl-gen" src={genImg} style={{ filter: (o.era && ERA_FILTER[o.era]) || undefined }} alt={`${row.name} 안`} />
            : clip && view === 'inside'
            ? <video className="isl-room" src={clip.src} poster={clip.poster} muted loop playsInline autoPlay={!still} style={{ filter: (o.era && ERA_FILTER[o.era]) || undefined }} aria-label={`${row.name} 안`} />
            : <img className="isl-room" src={view === 'inside' ? art.inside : art.reveal} alt={view === 'inside' ? `${row.name} 안` : `${row.name}을 내려다본 모습`} />}
          <IslandMood o={o} inside={view === 'inside'} />
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
            {SHOWCASE ? (
              <div className="isl-yours">
                <div>
                  <p><b>이 섬은 가상 인물의 기록 2년치로 지었어요.</b></p>
                  <p className="small">당신의 카톡·걸음·메모로 하면, 당신이 지나온 주들이 광석이 되고 섬이 됩니다. 기록은 당신의 기기 밖으로 나가지 않습니다.</p>
                </div>
                <figure><img src={qrDemo} alt="Mine D 시연판 주소 QR 코드" /><figcaption className="small">폰으로 다시 해 보기</figcaption></figure>
              </div>
            ) : <>
              <div className="label-row">
                {['화분', '앨범', '메모', '창문'].map((t) => <button key={t} className="chip" disabled title="광석이 더 모이면 기억을 둘 자리가 생겨요">{t}</button>)}
              </div>
              <p className="small muted">광석이 더 모이면 꾸밀 자리가 생겨요. 민디는 관측소에 남아 있습니다.</p>
            </>}
          </section>
        </div>
      )}
    </div>
  );
}
