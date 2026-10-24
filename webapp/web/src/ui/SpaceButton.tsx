// 채팅 창(P9)의 「나만의 섬으로 가기」(10/24 하빈 결정 · 전체 대본집 v1.1 §13 「나만의 섬」).
// 광석 3개로 열린다(SPACE_NEED). 잠겨 있으면 `나만의 섬 · 🔒 N/3` 과, 누르면 대본집 §13 의 민디 한 줄.
// 기한·카운트다운·축하 연출은 두지 않는다(v6 §11, 대본집 §20).
// 열려 있으면 누를 때 나의 공간 화면을 「새 공간 짓기」부터 연다(onOpen + requestNewSpace). 대화 단어를 후보로 넘기는 것은 다음 작업.
import { useId, useState } from 'react';
import { SPACE_NEED } from '../ore/collection';
import './mindi-buttons.css';
import { islandLockedLine } from '../mindi/talk';
import type { Voice } from '../mindi/voices';

export type SpaceState = { open: true } | { open: false; have: number; need: number };

export function spaceState(count: number, need = SPACE_NEED): SpaceState {
  const have = Math.max(0, Math.floor(count));
  return have >= need ? { open: true } : { open: false, have, need };
}


// 채팅 창에서 누르면 나의 공간 화면을 「새 공간 짓기」부터 연다. 화면 사이에 한 번만 넘기는 표시(이 탭에서만)
const NEW_KEY = 'mined.space.new';
export function requestNewSpace(): void {
  try { sessionStorage.setItem(NEW_KEY, '1'); } catch { /* 없음 */ }
}
export function takeNewSpaceRequest(): boolean {
  try { const on = sessionStorage.getItem(NEW_KEY) === '1'; sessionStorage.removeItem(NEW_KEY); return on; } catch { return false; }
}

interface Props {
  /** 지금까지 캔 광석 수 */
  count: number;
  need?: number;
  onOpen: () => void;
  disabled?: boolean;
  /** 잠겼을 때 민디 한 줄의 말투 */
  voice?: Voice;
}

export function SpaceButton({ count, need = SPACE_NEED, onOpen, disabled, voice = 'quiet' }: Props) {
  const s = spaceState(count, need);
  const [tip, setTip] = useState(false);
  const tipId = useId();

  if (s.open) {
    return (
      <button type="button" className="space-btn open" onClick={onOpen} disabled={disabled}>
        나만의 섬으로 가기 <span aria-hidden="true">→</span>
      </button>
    );
  }
  // 잠김: 눌러도 이동하지 않고 이유만 보인다. 포커스는 받도록 disabled 대신 aria-disabled
  return (
    <span className="space-btn-wrap">
      <button
        type="button"
        className="space-btn locked"
        aria-disabled="true"
        aria-describedby={tipId}
        disabled={disabled}
        onClick={() => setTip(true)}
        onBlur={() => setTip(false)}
        onMouseLeave={() => setTip(false)}
      >
        나만의 섬 · <span aria-hidden="true">🔒</span> {s.have}/{s.need}
      </button>
      <span id={tipId} role="tooltip" className={`space-tip${tip ? ' show' : ''}`}>
        {islandLockedLine(s.have, voice)}
      </span>
    </span>
  );
}
