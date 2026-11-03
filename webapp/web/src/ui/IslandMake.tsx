// v2(11/03) 섬 만들기: 광석 셋을 고른 뒤 민디와의 대화로 섬을 짓는다(보별 지정 흐름).
// 시간 → 날씨·계절 → 장소 → 시대 → 공간 → 소리(곡) 여섯 가지를 고르고, 기록에서 나온 추천 단어 넷 가운데 빼고 싶은 단어를 고른 뒤 섬 만들기를 시작한다.
// 지킬 것(나의 공간 키워드 v3·사운드 규칙): 고른 값과 사용자가 남긴 단어만 저장하고 원문은 쓰지 않는다. 「당신다운 섬」「어울려요」처럼 판정하는 말은 하지 않는다.
// 모든 단계에 「직접 쓰기」와 「아직 고르지 않음」이 있다. 곡은 장소와 고른 것에만 따른다.
import { useEffect, useRef, useState } from 'react';
import { MindiMark } from './Icons';
import { previewTrack, sfx, stopPreview, TRACKS, type TrackKey } from '../mindi/soundKit';
import type { IslandArt } from './design';

export interface IslandOpts {
  time?: string; weather: string[]; place?: string; era?: string; dwelling?: string;
  /** 곡. 'none' 은 소리 없음 */
  music?: TrackKey | 'none';
  /** 추천 단어 가운데 뺀 것(기록용) */
  excluded: string[];
}

type StepKey = 'time' | 'weather' | 'place' | 'era' | 'dwelling' | 'music';
interface Step { key: StepKey; ask: string; options: { v: string; t?: TrackKey | 'none' }[]; max?: number }

export const STEPS: Step[] = [
  { key: 'time', ask: '섬에는 언제의 빛이 들면 좋을까요?', options: ['새벽', '아침', '점심', '해질녘', '밤'].map((v) => ({ v })) },
  { key: 'weather', ask: '날씨와 계절은요? 두 개까지 고를 수 있어요.', max: 2, options: ['봄', '여름', '가을', '겨울', '비', '눈', '햇살', '흐림', '안개'].map((v) => ({ v })) },
  { key: 'place', ask: '어디에 놓을까요?', options: ['바다', '산', '호수', '들판', '숲', '사막', '도시'].map((v) => ({ v })) },
  { key: 'era', ask: '어느 시대의 풍경이면 좋을까요?', options: ['시대 없음', '1970년대', '1980년대', '1990년대', '2000년대', '지금', '먼 미래'].map((v) => ({ v })) },
  { key: 'dwelling', ask: '머물 곳은 어떤 모양일까요?', options: ['룸', '방갈로', '텐트', '하우스', '오두막', '열린 작업실'].map((v) => ({ v })) },
  {
    key: 'music', ask: '섬에 흐를 소리를 골라 주세요. 누르면 잠깐 들려 드려요.',
    options: [
      { v: '바다', t: 'sea' }, { v: '하늘산', t: 'sky' }, { v: '정글', t: 'jungle' }, { v: '음악방', t: 'music' }, { v: '소리 없음', t: 'none' },
    ],
  },
];

/** 장소 → 가장 가까운 예시 섬 그림 */
export function artFor(place?: string): IslandArt {
  if (!place) return 'sea';
  if (/산|사막|도시|언덕|절벽/.test(place)) return 'mountain';
  if (/숲|들판|정글|정원|습지/.test(place)) return 'jungle';
  return 'sea';
}
/** 장소 → 곡을 고르지 않았을 때 쓸 곡 */
export function trackFor(o: IslandOpts): TrackKey | undefined {
  if (o.music === 'none') return undefined;
  if (o.music) return o.music;
  const a = artFor(o.place);
  return a === 'mountain' ? 'sky' : a === 'jungle' ? 'jungle' : 'sea';
}

/** 고른 값들을 한 줄로(민디가 되읽어 줄 때와 섬 안 안내에 쓴다) */
export function optsLine(o: IslandOpts): string {
  const music = o.music === 'none' ? '소리 없음' : o.music ? `${TRACKS[o.music].label} 곡` : '';
  return [o.time, o.weather.join('·'), o.place, o.era && o.era !== '시대 없음' ? o.era : '', o.dwelling, music].filter(Boolean).join(' · ');
}

interface Props {
  /** 기록에서 나온 단어 후보(위에서부터 많이 나온 순). 앞의 넷을 추천으로 보여 준다 */
  suggestions: string[];
  onDone: (o: IslandOpts, words: string[], name: string) => void;
  defaultName: string;
}

export function IslandMake({ suggestions, onDone, defaultName }: Props) {
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [ans, setAns] = useState<Record<StepKey, string[] | null>>({ time: null, weather: null, place: null, era: null, dwelling: null, music: null });
  const [draft, setDraft] = useState<string[]>([]);
  const [own, setOwn] = useState('');
  const rec = suggestions.slice(0, 4);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [extra, setExtra] = useState<string[]>([]);
  const [ownWord, setOwnWord] = useState('');
  const [name, setName] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [step]);
  useEffect(() => () => stopPreview(), []);

  const cur = STEPS[step];
  const answer = (vals: string[] | null) => {
    if (!cur) return;
    sfx('tap');
    setAns((a) => ({ ...a, [cur.key]: vals }));
    setDraft([]); setOwn('');
    // 고치러 앞 단계로 돌아온 경우 이미 지나온 단계는 건너뛰고 하던 자리로 돌아간다
    const n = Math.max(step + 1, reached);
    setReached(n); setStep(n);
  };
  const pickOpt = (o: { v: string; t?: TrackKey | 'none' }) => {
    if (o.t && o.t !== 'none') previewTrack(o.t);
    if ((cur.max ?? 1) > 1) {
      setDraft((d) => d.includes(o.v) ? d.filter((x) => x !== o.v) : d.length < (cur.max ?? 1) ? [...d, o.v] : d);
      return;
    }
    answer([o.v]);
  };

  const opts = (): IslandOpts => {
    const one = (k: StepKey) => ans[k]?.[0];
    const mv = one('music');
    const m = STEPS[5].options.find((o) => o.v === mv)?.t;
    return { time: one('time'), weather: ans.weather ?? [], place: one('place'), era: one('era'), dwelling: one('dwelling'), music: m, excluded };
  };
  const kept = [...rec.filter((w) => !excluded.includes(w)), ...extra];

  return (
    <div className="isl-chat" aria-label="민디와 섬 만들기">
      <div className="isl-msg mindi"><MindiMark size={34} /><p>안개 옆에 섬을 놓을 자리가 생겼어요. 몇 가지만 같이 정해요. 언제든 바꿀 수 있어요.</p></div>
      {STEPS.map((s, i) => i === step ? <div key={s.key}>
        <div className="isl-pair">
          <div className="isl-msg mindi"><MindiMark size={34} /><p>{cur.ask}</p></div>
          <div className="isl-choices" role="group" aria-label={cur.ask}>
            {cur.options.map((o) => (
              <button key={o.v} className="chip" aria-pressed={draft.includes(o.v) || ans[cur.key]?.includes(o.v) || false} onClick={() => pickOpt(o)}>
                {o.t && o.t !== 'none' && <span aria-hidden="true">♪ </span>}{o.v}
              </button>
            ))}
          </div>
          <form className="label-row" onSubmit={(e) => { e.preventDefault(); const t = own.trim().slice(0, 12); if (t) answer([...draft, t].slice(0, cur.max ?? 1)); }}>
            <input className="input" value={own} maxLength={12} onChange={(e) => setOwn(e.target.value)} placeholder="직접 쓰기" aria-label={`${cur.ask} 직접 쓰기`} />
            <button className="btn" type="submit" disabled={!own.trim()}>쓰기</button>
            {(cur.max ?? 1) > 1 && <button type="button" className="btn primary" disabled={!draft.length} onClick={() => answer(draft)}>다음</button>}
            <button type="button" className="btn quiet" onClick={() => answer(null)}>아직 고르지 않음</button>
          </form>
        </div>
            </div> : i < reached ? (
        <div key={s.key} className="isl-pair">
          <div className="isl-msg mindi"><MindiMark size={34} /><p>{s.ask}</p></div>
          <button className="isl-msg me" onClick={() => setStep(i)} aria-label={`${s.ask} 답 고치기`}>
            {ans[s.key]?.length ? ans[s.key]!.join(' · ') : '아직 고르지 않음'}<small>고치기</small>
          </button>
        </div>
      ) : null)}
      {step >= STEPS.length && (
        <>
          <div className="isl-msg mindi"><MindiMark size={34} /><p>
            {rec.length ? `지난 기록에서 가장 많이 나온 단어 ${rec.length}개예요. 섬에 두고 싶지 않은 단어가 있으면 눌러서 빼 주세요.` : '기록에서 꺼낼 단어가 아직 없어요. 두고 싶은 단어를 직접 적어 주세요.'}
          </p></div>
          <div className="isl-choices words" role="group" aria-label="단어 고르기">
            {rec.map((w) => {
              const out = excluded.includes(w);
              return (
                <button key={w} className={`chip word${out ? ' out' : ''}`} aria-pressed={!out} onClick={() => setExcluded((x) => out ? x.filter((y) => y !== w) : [...x, w])}>
                  {w}<span aria-hidden="true">{out ? ' ＋' : ' ✕'}</span><span className="sr-only">{out ? ' (뺀 단어, 다시 넣기)' : ' (빼기)'}</span>
                </button>
              );
            })}
            {extra.map((w) => <button key={w} className="chip word" aria-pressed onClick={() => setExtra((x) => x.filter((y) => y !== w))}>{w}<span aria-hidden="true"> ✕</span></button>)}
          </div>
          <form className="label-row" onSubmit={(e) => { e.preventDefault(); const t = ownWord.trim().slice(0, 12); if (t && !kept.includes(t) && extra.length < 3) { setExtra((x) => [...x, t]); setOwnWord(''); } }}>
            <input className="input" value={ownWord} maxLength={12} onChange={(e) => setOwnWord(e.target.value)} placeholder="단어 직접 쓰기" aria-label="단어 직접 쓰기" />
            <button className="btn" type="submit" disabled={!ownWord.trim() || extra.length >= 3}>더하기</button>
          </form>
          <div className="isl-msg mindi"><MindiMark size={34} /><p>
            이렇게 지을게요. {optsLine(opts()) || '고른 것 없이'}{kept.length ? `, 곁에 둘 단어는 ${kept.join(' · ')}.` : '.'} 이름은 지금 붙여도 되고, 비워 두셔도 돼요.
          </p></div>
          <p className="small muted">고른 값과 남긴 단어만 이 브라우저에 저장합니다. 기록 원문은 쓰지도 보내지도 않습니다.</p>
          <form className="label-row" onSubmit={(e) => { e.preventDefault(); sfx('confirm'); onDone(opts(), kept, name.trim().slice(0, 20) || defaultName); }}>
            <input className="input" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder={`이름 (비우면 「${defaultName}」)`} aria-label="공간 이름" />
            <button className="btn primary" type="submit">섬 만들기 시작</button>
          </form>
          <div className="label-row small">
            <span className="muted">이름 예시</span>
            {[defaultName, '안개 옆의 섬', '이름 없는 섬'].map((n) => <button key={n} className="chip" onClick={() => setName(n)}>{n}</button>)}
          </div>
        </>
      )}
      <div ref={end} />
    </div>
  );
}
