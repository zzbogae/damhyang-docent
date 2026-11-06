// 첫 화면 「섬 둘러보기」(11/04 보별 요청): 버튼을 누르면 나의 공간 예시 영상이 바로 이어서 재생된다.
// 영상은 모두 관측소 외부 안개가 걷히며 시작해서 첫 화면 안개에서 끊김 없이 이어진다. 소리는 팀이 −16 LUFS로 맞춘 원본 그대로다.
// 드라이브 「나의 공간 예시영상 완성본 v1」 다섯 안(바다·하늘산·정글·음악방·겨울 노천 온천)을 1280×720으로만 줄였다.
// 한 편이 끝나면 다음 섬으로 넘어가고, 아래 이름표로 골라 볼 수 있다. 닫기·Esc로 첫 화면으로 돌아간다.
import { useEffect, type RefObject } from 'react';
import sea from '../assets/design/space_video_sea.mp4';
import sky from '../assets/design/space_video_sky.mp4';
import jungle from '../assets/design/space_video_jungle.mp4';
import music from '../assets/design/space_video_music.mp4';
import onsen from '../assets/design/space_video_onsen.mp4';

export const TOUR: { key: string; label: string; src: string }[] = [
  { key: 'sea', label: '바다', src: sea },
  { key: 'sky', label: '하늘산', src: sky },
  { key: 'jungle', label: '정글', src: jungle },
  { key: 'music', label: '음악방', src: music },
  { key: 'onsen', label: '온천', src: onsen },
];

/** 브라우저 자동재생 규칙 때문에 첫 재생은 버튼을 누른 그 순간(클릭 안)에서 부른다. 소리가 막히면 소리 없이라도 튼다 */
export function playTour(v: HTMLVideoElement | null, i: number) {
  if (!v) return;
  v.src = TOUR[i].src;
  v.muted = false;
  void v.play().catch(() => { v.muted = true; void v.play().catch(() => undefined); });
}

export function SpaceTour({ videoRef, open, index, onIndex, onClose }: {
  videoRef: RefObject<HTMLVideoElement | null>; open: boolean; index: number; onIndex: (i: number) => void; onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [open, onClose]);
  const go = (i: number) => { onIndex(i); playTour(videoRef.current, i); };
  return (
    <div className={`space-tour${open ? ' on' : ''}`} role="dialog" aria-modal="true" aria-label="섬 둘러보기" aria-hidden={!open}>
      <video ref={videoRef} className="space-tour-video" playsInline preload="none"
        onEnded={() => go((index + 1) % TOUR.length)} />
      <button className="space-tour-close" onClick={onClose} tabIndex={open ? 0 : -1}>닫기</button>
      <div className="space-tour-tabs">
        {TOUR.map((t, i) => (
          <button key={t.key} className={i === index ? 'on' : ''} onClick={() => go(i)} tabIndex={open ? 0 : -1} aria-pressed={i === index}>{t.label}</button>
        ))}
      </div>
    </div>
  );
}
