// 입장 인트로 · 민디 소개(드라이브 8/22 랜딩 1·2번 화면을 그대로 옮김). 한 화면씩 넘어가고 스크롤하지 않는다.
// 1) 안개 낀 채굴장 영상 → 2초 뒤 로고, 4초 뒤 「입장하기」  2) 민디 등장 · 대사 몇 장 · 다음/시작하기 · 건너뛰기
// 대사 중 「화분에 심어두세요」·「한 번 더 물어봅니다」는 이 앱에 없는 기능이라(이름 붙이기 / 9/12 회의로 다시 묻기 없앰) 맞게 바꿨다.
import { useEffect, useState } from 'react';
import { ART } from './design';

const TUTORIAL: { eyebrow: string; line: string[] }[] = [
  { eyebrow: '민디', line: ['안녕하세요, 저는 민디예요.', '당신의 기록에서 광물을 캡니다.'] },
  { eyebrow: '01', line: ['당신의 지난 10년이', '방금 관측소가 되었습니다.'] },
  { eyebrow: '02', line: ['언제든, 원하는 곳을', '파보실 수 있습니다.'] },
  { eyebrow: '03', line: ['마음에 남는 주에는', '이름을 붙여 두세요.'] },
];

export function Intro({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState<0 | 1>(0);
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
  const next = () => (step < TUTORIAL.length - 1 ? setStep(step + 1) : finish());
  const t = TUTORIAL[step];
  return (
    <div className={`intro${leaving ? ' leaving' : ''}`} role="dialog" aria-modal="true" aria-label="Mine D 입장">
      <section className={`intro-screen intro-entry${stage === 0 ? ' on' : ''}`} aria-hidden={stage !== 0}>
        {still
          ? <img className="intro-video" src={ART.introPoster} alt="" />
          : <video className="intro-video" src={ART.introFog} poster={ART.introPoster} autoPlay muted loop playsInline aria-hidden="true" />}
        <div className="intro-scrim" />
        <img className={`intro-logo${logo ? ' play' : ''}`} src={ART.logoDark} alt="Mine D" />
        <div className={`intro-enter${btn ? ' play' : ''}`}>
          <button className="intro-enter-btn" onClick={() => setStage(1)} tabIndex={stage === 0 ? 0 : -1}>
            <span className="dot" />입장하기
          </button>
        </div>
      </section>
      <section className={`intro-screen intro-mindi${stage === 1 ? ' on' : ''}`} aria-hidden={stage !== 1}>
        <div className="intro-glow" />
        <img className="intro-mindy" src={ART.mindiCharacter} alt="민디" />
        <button className="intro-skip" onClick={finish} tabIndex={stage === 1 ? 0 : -1}>건너뛰기</button>
        <div className="intro-tut">
          <div className="intro-dots">{TUTORIAL.map((_, i) => <span key={i} className={i === step ? 'on' : ''} />)}</div>
          <div className="intro-text" key={step}>
            <div className="intro-eyebrow">{t.eyebrow}</div>
            <p className="intro-line">{t.line[0]}<br />{t.line[1]}</p>
          </div>
          <button className="intro-next" onClick={next} tabIndex={stage === 1 ? 0 : -1}>{step === TUTORIAL.length - 1 ? '시작하기' : '다음'}</button>
        </div>
      </section>
    </div>
  );
}
