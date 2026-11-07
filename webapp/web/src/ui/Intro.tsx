// 입장 인트로 · 민디 소개(드라이브 8/22 랜딩 1·2번 화면을 그대로 옮김). 한 화면씩 넘어가고 스크롤하지 않는다.
// 1) 안개 낀 채굴장 영상 → 2초 뒤 로고, 4초 뒤 「입장하기」  2) 민디 등장 · 대사 몇 장 · 다음/시작하기 · 건너뛰기
// 3) 입장 카드(11/03 보별 결정 「입장 카드만」): 「내 기록으로 시작」 / 「샘플로 둘러보기」 같은 크기 두 장 + 만 14세 이상 확인.
//    계정은 만들지 않는다(기록은 이 브라우저 밖으로 나가지 않는다). 샘플을 고르면 가져오기 화면에서 가짜 샘플을 바로 연다.
// 대사 중 「화분에 심어두세요」·「한 번 더 물어봅니다」는 이 앱에 없는 기능이라(이름 붙이기 / 9/12 회의로 다시 묻기 없앰) 맞게 바꿨다.
// 첫 화면 「섬 둘러보기」(11/04 보별 요청)는 섬이 없어도 누를 수 있고, 나의 공간 예시 영상을 바로 이어서 튼다(SpaceTour.tsx).
import { useCallback, useEffect, useRef, useState } from 'react';
import { ART } from './design';
import { mindiSay, sceneOverlay, setSoundOn, sfx, soundOn } from '../mindi/soundKit';
import { loadSpaces } from './Space';
import { requestVisitLatest } from './SpaceButton';
import { SpaceTour, playTour } from './SpaceTour';

const TUTORIAL: { eyebrow: string; line: string[] }[] = [
  { eyebrow: '민디', line: ['안녕하세요, 저는 민디예요.', '당신의 기록에서 광물을 캡니다.'] },
  { eyebrow: '01', line: ['당신의 지난 10년이', '방금 관측소가 되었습니다.'] },
  { eyebrow: '02', line: ['언제든, 원하는 곳을', '파보실 수 있습니다.'] },
  { eyebrow: '03', line: ['마음에 남는 주에는', '이름을 붙여 두세요.'] },
];

const ENTRY_KEY = 'mined.entry.sample';
export const ENTRY_EVENT = 'mined:entry-sample';
/** 첫 홈의 「섬으로 들어가기」: 나의 공간을 열고 가장 최근 섬으로 간다(같은 안개 그림에서 안개가 걷힌다) */
export const GO_ISLAND_EVENT = 'mined:go-island';
/** 입장 카드에서 「샘플로 둘러보기」를 골랐으면 한 번만 true(가져오기 화면이 가짜 샘플을 바로 연다) */
export function takeSampleEntry(): boolean {
  try { const on = sessionStorage.getItem(ENTRY_KEY) === '1'; sessionStorage.removeItem(ENTRY_KEY); return on; } catch { return false; }
}

export function Intro({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [age, setAge] = useState(false);
  const [island] = useState(() => loadSpaces().slice(-1)[0]);
  const goIsland = () => { if (!island) return; requestVisitLatest(); dispatchEvent(new Event(GO_ISLAND_EVENT)); onDone(); };
  // 섬 둘러보기: 영상 소리와 겹치지 않게 민디 소리를 잠시 끄고, 닫으면 켜져 있던 그대로 되돌린다
  const tourVideo = useRef<HTMLVideoElement>(null);
  const [tour, setTour] = useState(false);
  const [tourIdx, setTourIdx] = useState(0);
  const soundWasOn = useRef(false);
  const openTour = () => {
    soundWasOn.current = soundOn();
    if (soundWasOn.current) setSoundOn(false);
    setTourIdx(0); playTour(tourVideo.current, 0); setTour(true);
  };
  const closeTour = useCallback(() => {
    tourVideo.current?.pause();
    setTour(false);
    if (soundWasOn.current) setSoundOn(true);
  }, []);
  const [logo, setLogo] = useState(false);
  const [btn, setBtn] = useState(false);
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    const a = setTimeout(() => setLogo(true), still ? 0 : 2000);
    const b = setTimeout(() => setBtn(true), still ? 0 : 4000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [still]);
  const finish = () => { setLeaving(true); setTimeout(onDone, 700); };
  const toCard = () => { sfx('tap'); setStage(2); };
  const next = () => (step < TUTORIAL.length - 1 ? setStep(step + 1) : toCard());
  const enter = (sample: boolean) => {
    if (!age) return;
    try { if (sample) sessionStorage.setItem(ENTRY_KEY, '1'); } catch { /* 이번 화면에서만 */ }
    // 가져오기 화면은 인트로 아래에 이미 떠 있으므로 알려 준다(새로 열리는 경우엔 저장해 둔 표시를 읽는다)
    if (sample) dispatchEvent(new Event(ENTRY_EVENT));
    sfx('confirm'); finish();
  };
  const t = TUTORIAL[step];
  useEffect(() => sceneOverlay('intro'), []);
  useEffect(() => { if (stage === 1) mindiSay(t.line.join(' '), step === 0 ? 'hello' : undefined); }, [stage, step]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`intro${leaving ? ' leaving' : ''}`} role="dialog" aria-modal="true" aria-label="Mine D 입장">
      <section className={`intro-screen intro-entry${stage === 0 ? ' on' : ''}`} aria-hidden={stage !== 0}>
        {still
          ? <img className="intro-video" src={ART.introPoster} alt="" />
          : <video className="intro-video" src={ART.introFog} poster={ART.introPoster} autoPlay muted loop playsInline aria-hidden="true" />}
        <div className="intro-scrim" />
        <img className={`intro-logo${logo ? ' play' : ''}`} src={ART.logoDark} alt="Mine D" />
        <div className={`intro-enter${btn ? ' play' : ''}`}>
          <button className="intro-enter-btn" onClick={() => { sfx('door'); setStage(1); }} tabIndex={stage === 0 ? 0 : -1}>
            <span className="dot" />입장하기
          </button>
          <button className="intro-enter-btn intro-tour-btn" onClick={openTour} tabIndex={stage === 0 && !tour ? 0 : -1}>
            섬 둘러보기
          </button>
          <button className="intro-enter-btn intro-island-btn" onClick={goIsland} disabled={!island} tabIndex={stage === 0 ? 0 : -1}
            title={island ? `${island.name}으로` : '광석 셋으로 섬을 지으면 열립니다'}>
            섬으로 들어가기
          </button>
          {!island && <span className="intro-island-note">광석 셋으로 섬을 지으면 열립니다</span>}
        </div>
        <SpaceTour videoRef={tourVideo} open={tour} index={tourIdx} onIndex={setTourIdx} onClose={closeTour} />
      </section>
      <section className={`intro-screen intro-mindi${stage === 1 ? ' on' : ''}`} aria-hidden={stage !== 1}>
        <div className="intro-glow" />
        <img className="intro-mindy" src={ART.mindiCharacter} alt="민디" />
        <button className="intro-skip" onClick={toCard} tabIndex={stage === 1 ? 0 : -1}>건너뛰기</button>
        <div className="intro-tut">
          <div className="intro-dots">{TUTORIAL.map((_, i) => <span key={i} className={i === step ? 'on' : ''} />)}</div>
          <div className="intro-text" key={step}>
            <div className="intro-eyebrow">{t.eyebrow}</div>
            <p className="intro-line">{t.line[0]}<br />{t.line[1]}</p>
          </div>
          <button className="intro-next" onClick={next} tabIndex={stage === 1 ? 0 : -1}>{step === TUTORIAL.length - 1 ? '시작하기' : '다음'}</button>
        </div>
      </section>
      <section className={`intro-screen intro-card${stage === 2 ? ' on' : ''}`} aria-hidden={stage !== 2} aria-labelledby="entry-title">
        <img className="intro-card-logo" src={ART.logoLight} alt="Mine D" />
        <h2 id="entry-title" className="intro-card-title">어떻게 들어갈까요?</h2>
        <label className="entry-age">
          <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} tabIndex={stage === 2 ? 0 : -1} />
          <span>만 14세 이상입니다</span>
        </label>
        <div className="entry-cards">
          <button className="entry-card" disabled={!age} onClick={() => enter(false)} tabIndex={stage === 2 ? 0 : -1}>
            <b>내 기록으로 시작</b><span>내보내기 파일과 사진 폴더를 이 기기 안에서 읽습니다</span>
          </button>
          <button className="entry-card" disabled={!age} onClick={() => enter(true)} tabIndex={stage === 2 ? 0 : -1}>
            <b>샘플로 둘러보기</b><span>가상 인물의 가짜 기록 2년치로 먼저 봅니다</span>
          </button>
        </div>
        <p className="entry-note">계정은 만들지 않습니다. 기록은 이 브라우저 밖으로 나가지 않습니다.</p>
      </section>
    </div>
  );
}
