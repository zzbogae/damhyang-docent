// 화면 읽기: 스크린리더를 쓰지 않는 사람을 위한 접근성 기능. 기본은 꺼짐이고 설정에서 켠다.
// 민디의 목소리가 아니다(팀 9/23 §1-8: 억양이 감정을 실으면 그 억양이 판정이 된다). 그래서 민디 말풍선에는 붙이지 않는다.
import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { canSpeak, speak, stopSpeaking } from '../mindi/voice';
import { IconSpeaker, IconStop } from './Icons';

export function ScreenReadButton({ text }: { text: string }) {
  const { settings } = useStore();
  const [on, setOn] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  if (!settings.screenRead || !canSpeak()) return null;
  return (
    <button
      className="btn quiet"
      aria-label={on ? '화면 읽기 멈추기' : '화면 읽기'}
      onClick={() => {
        if (on) { stopSpeaking(); setOn(false); return; }
        if (speak(text, () => setOn(false))) setOn(true);
      }}
    >
      {on ? <IconStop /> : <IconSpeaker />}
      {on ? '멈추기' : '화면 읽기'}
    </button>
  );
}
