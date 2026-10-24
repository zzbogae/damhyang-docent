// 민디 말투 고르기. 채팅 창(P9)에는 칩 하나(`말투 · 조용한 ▾`)를 두고, 누르면 다섯 가지 중 하나를 고르는 창이 열린다.
// 설정 › 민디(P13)에는 같은 목록을 예시 문장과 함께 펼쳐 둔다(VoicePicker). 둘 다 useVoice() 의 같은 값을 쓴다.
// 접근성: 목록은 radiogroup, 방향키로 옮기면 바로 고른다(라디오 버튼 관례), Esc·바깥 누르기로 닫힌다.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { VOICES, voiceDef, type Voice } from '../mindi/voices';
import './mindi-buttons.css';

export function nextVoice(cur: Voice, key: string): Voice | null {
  const i = VOICES.findIndex((v) => v.id === cur);
  const n = VOICES.length;
  if (key === 'ArrowDown' || key === 'ArrowRight') return VOICES[(i + 1) % n].id;
  if (key === 'ArrowUp' || key === 'ArrowLeft') return VOICES[(i - 1 + n) % n].id;
  if (key === 'Home') return VOICES[0].id;
  if (key === 'End') return VOICES[n - 1].id;
  return null;
}

interface PickerProps {
  value: Voice;
  onChange: (v: Voice) => void;
  /** 예시 문장까지 보여 줄지(설정 화면) */
  withSample?: boolean;
  disabled?: boolean;
  /** 고른 뒤 부르는 콜백(칩은 창을 닫는다) */
  onPicked?: () => void;
  autoFocus?: boolean;
}

/** 다섯 말투 라디오 목록 */
export function VoicePicker({ value, onChange, withSample, disabled, onPicked, autoFocus }: PickerProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => { if (autoFocus) refs.current[value]?.focus(); }, [autoFocus]);

  function onKey(e: KeyboardEvent) {
    const n = nextVoice(value, e.key);
    if (!n) return;
    e.preventDefault();
    onChange(n);
    refs.current[n]?.focus();
  }

  return (
    <div className={`voice-list${withSample ? ' with-sample' : ''}`} role="radiogroup" aria-label="민디 말투" onKeyDown={onKey}>
      {VOICES.map((v) => {
        const on = v.id === value;
        return (
          <button
            key={v.id}
            ref={(el) => { refs.current[v.id] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={disabled}
            className={`voice-opt${on ? ' on' : ''}`}
            onClick={() => { onChange(v.id); onPicked?.(); }}
          >
            <span className="voice-name">{v.label}{v.id === 'quiet' && <small> · 기본</small>}</span>
            <span className="voice-hint">{v.hint}</span>
            {withSample && <span className="voice-sample">「{v.sample}」</span>}
          </button>
        );
      })}
    </div>
  );
}

interface ChipProps {
  value: Voice;
  onChange: (v: Voice) => void;
  /** 외부 모델이 말투를 다듬는 중 */
  busy?: boolean;
  disabled?: boolean;
}

/** 채팅 창 왼쪽 위 칩 */
export function VoiceChip({ value, onChange, busy, disabled }: ChipProps) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const label = voiceDef(value).label;
  return (
    <div className="voice-chip" ref={box}>
      <button
        ref={btn}
        type="button"
        className={`chip-btn${open ? ' open' : ''}${busy ? ' busy' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        aria-label={`민디 말투: ${label}${busy ? ' (다듬는 중)' : ''}. 바꾸기`}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="chip-key">말투</span>
        <span className="chip-val">{label}</span>
        <span className="chip-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="voice-pop" id={popId} role="dialog" aria-label="민디 말투 고르기">
          <VoicePicker value={value} onChange={onChange} onPicked={() => { setOpen(false); btn.current?.focus(); }} autoFocus />
          <p className="voice-note">숫자와 날짜는 어떤 말투에서도 그대로예요. 설정 › 민디에서도 바꿀 수 있어요.</p>
        </div>
      )}
    </div>
  );
}
