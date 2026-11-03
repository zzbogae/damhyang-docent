// v2(11/03) 머리줄 「♪ 음악」 버튼: 장소에 맞춤(기본) · 곡 하나 고르기 · 음악 없음.
// 소리가 꺼져 있으면 곡을 고르는 순간 설정의 「민디 소리」를 함께 켠다(사용자가 누른 것이 곧 동의). 끄기는 설정과 같은 값이다.
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { getMusicChoice, nowPlaying, onMusicChange, setMusicChoice, TRACKS, type MusicChoice, type TrackKey } from '../mindi/soundKit';

export function MusicButton() {
  const { settings, setSettings } = useStore();
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => onMusicChange(() => tick((n) => n + 1)), []);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const choice = getMusicChoice();
  const soundOn = !!settings.sound;
  const playing = nowPlaying();
  const pick = (c: MusicChoice) => {
    if (c !== 'off' && !soundOn) setSettings({ ...settings, sound: true });
    setMusicChoice(c);
  };
  const label = !soundOn || choice === 'off' ? '음악 꺼짐' : choice === 'auto' ? '장소에 맞춤' : TRACKS[choice].label;
  return (
    <div className="music" ref={box}>
      <button className={`btn quiet music-btn${soundOn && choice !== 'off' ? ' on' : ''}`} aria-haspopup="dialog" aria-expanded={open}
        onClick={() => setOpen((o) => !o)} aria-label={`음악 고르기 · 지금 ${label}`}>
        <span aria-hidden="true" className="music-note">♪</span>음악
      </button>
      {open && (
        <div className="music-pop" role="dialog" aria-label="음악 고르기">
          <p className="music-now small">{soundOn && playing ? `지금: ${TRACKS[playing].label}` : soundOn && choice === 'auto' ? '지금: 장소에 맞춘 곡' : '소리가 꺼져 있습니다'}</p>
          <div role="radiogroup" aria-label="곡" className="music-list">
            <button role="radio" aria-checked={soundOn && choice === 'auto'} className="music-opt" onClick={() => pick('auto')}>
              <b>장소에 맞춤</b><span>관측소·지층·나의 공간마다 정해진 곡</span>
            </button>
            {(Object.keys(TRACKS) as TrackKey[]).map((k) => (
              <button key={k} role="radio" aria-checked={soundOn && choice === k} className="music-opt" onClick={() => pick(k)}>
                <b>{TRACKS[k].label}</b><span>{TRACKS[k].note}</span>
              </button>
            ))}
            <button role="radio" aria-checked={!soundOn || choice === 'off'} className="music-opt" onClick={() => pick('off')}>
              <b>음악 없음</b><span>바탕 소리와 효과음만</span>
            </button>
          </div>
          {soundOn && <button className="btn quiet small" onClick={() => { setSettings({ ...settings, sound: false }); setOpen(false); }}>소리 모두 끄기</button>}
          <p className="small muted">곡은 지금 있는 곳과 고른 것에만 따릅니다. 기록 내용은 듣지 않습니다.</p>
        </div>
      )}
    </div>
  );
}
