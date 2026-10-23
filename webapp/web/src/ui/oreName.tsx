// 10/23 보경: 광물 이름은 「예시 이름」이다. 앱은 처음 이름(호박·청금석 …)만 제안하고, 이름은 사용자가 붙인다.
// 사용자가 붙인 이름은 이 기기의 브라우저에만 둔다(원문과 같이 기기 밖으로 나가지 않는다).
import { useState } from 'react';
import { MINERAL_COLOR } from './minerals';

const KEY = 'mined.oreNames.v1';

function readAll(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function customOreName(week: string): string | null {
  return readAll()[week] ?? null;
}

export function saveOreName(week: string, name: string): void {
  try {
    const all = readAll();
    const v = name.trim().slice(0, 20);
    if (v) all[week] = v;
    else delete all[week];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // 저장이 막힌 브라우저(사생활 보호 창 등)에서는 이번 화면에서만 보인다
  }
}

/** 화면에 보일 이름: 사용자가 붙인 이름이 있으면 그것, 없으면 예시 이름 */
export function oreLabel(w: { week: string; mineral: string | null }): string {
  if (!w.mineral) return '';
  return customOreName(w.week) ?? w.mineral;
}

/** 광석 이름 칩 + 「이름 붙이기」. 예시 이름이면 「예시」 표시를 붙인다 */
export function OreName({ w }: { w: { week: string; mineral: string | null } }) {
  const [name, setName] = useState(() => customOreName(w.week));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name ?? '');
  if (!w.mineral) return null;
  const color = MINERAL_COLOR[w.mineral];
  if (editing) {
    return (
      <form className="ore-name-edit" onSubmit={(e) => {
        e.preventDefault();
        saveOreName(w.week, draft);
        setName(draft.trim() ? draft.trim().slice(0, 20) : null);
        setEditing(false);
      }}>
        <input value={draft} maxLength={20} autoFocus placeholder={w.mineral}
          aria-label="이 광석의 이름" onChange={(e) => setDraft(e.target.value)} />
        <button className="btn" type="submit">붙이기</button>
        <button className="btn" type="button" onClick={() => { setDraft(name ?? ''); setEditing(false); }}>돌아가기</button>
      </form>
    );
  }
  return (
    <span className="ore-name">
      <span className="chip"><i style={{ background: color }} />{name ?? w.mineral}{!name && <small className="muted"> · 예시 이름</small>}</span>
      <button className="btn ore-name-btn" type="button" onClick={() => setEditing(true)}>{name ? '이름 바꾸기' : '이름 붙이기'}</button>
    </span>
  );
}
