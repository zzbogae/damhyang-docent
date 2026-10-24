// 채팅 창(P9)의 「나의 공간 만들기」. 섬과 방은 같은 「나의 공간」(화면설계 v6 §1).
// 광석 3개로 열린다(SPACE_NEED). 잠겨 있으면 관측소 Ⓔ 와 같은 표기 `나의 공간 · 🔒 N/3` 만 보인다.
// 기한·카운트다운·「다음까지 N개」·축하 연출은 두지 않는다(v6 §11).
// 열려 있으면 누를 때 나의 공간 화면을 「새 공간 짓기」부터 연다(onOpen + requestNewSpace). 대화 단어를 후보로 넘기는 것은 다음 작업.
import { useId, useState } from 'react';
import { SPACE_NEED } from '../ore/collection';
import './mindi-buttons.css';

export type SpaceState = { open: true } | { open: false; have: number; need: number };

export function spaceState(count: number, need = SPACE_NEED): SpaceState {
  const have = Math.max(0, Math.floor(count));
  return have >= need ? { open: true } : { open: false, have, need };
}

export const SPACE_LOCKED_TIP = '광석을 모으면 열려요';

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
}

export function SpaceButton({ count, need = SPACE_NEED, onOpen, disabled }: Props) {
  const s = spaceState(count, need);
  const [tip, setTip] = useState(false);
  const tipId = useId();

  if (s.open) {
    return (
      <button type="button" className="space-btn open" onClick={onOpen} disabled={disabled}>
        이 대화로 나의 공간 만들기 <span aria-hidden="true">→</span>
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
        나의 공간 · <span aria-hidden="true">🔒</span> {s.have}/{s.need}
      </button>
      <span id={tipId} role="tooltip" className={`space-tip${tip ? ' show' : ''}`}>
        {SPACE_LOCKED_TIP} (지금 {s.have}/{s.need})
      </span>
    </span>
  );
}
