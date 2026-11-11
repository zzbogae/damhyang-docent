// 10/23 보경: 광석은 처음엔 이름 없이 날짜로만 보인다. 광물 이름(호박·청금석 …)은 예시이고,
// 사용자가 「이름 붙이기」에서 예시 중 하나를 고르거나 직접 적는다.
// 사용자가 붙인 이름은 이 기기의 브라우저에만 둔다(원문과 같이 기기 밖으로 나가지 않는다).
import { useState } from 'react';
import { MINERAL_COLOR, MINERALS } from './minerals';
import { dateLabel } from '../mindi/templates';
import { sfx } from '../mindi/soundKit';

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

type OreWeek = { week: string; date_start: string; mineral: string | null };

/** 화면에 보일 이름: 사용자가 붙인 이름이 있으면 그것, 없으면 날짜 */
export function oreLabel(w: OreWeek): string {
  if (!w.mineral) return '';
  return customOreName(w.week) ?? `${dateLabel(w.date_start)}의 광석`;
}

/** 예시 이름 목록: 이 광석의 색에 맞는 이름을 맨 앞에 */
export function exampleNames(mineral: string): string[] {
  return [mineral, ...MINERALS.filter((m) => m !== mineral)];
}

/** 광석 이름 칩 + 「이름 붙이기」. 이름이 없으면 날짜만 보이고, 예시 이름은 고를 때만 보인다 */
export function OreName({ w }: { w: OreWeek }) {
  const [name, setName] = useState(() => customOreName(w.week));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name ?? '');
  if (!w.mineral) return null;
  const color = MINERAL_COLOR[w.mineral];
  if (editing) {
    return (
      <form className="ore-name-edit" onSubmit={(e) => {
        e.preventDefault();
        saveOreName(w.week, draft); sfx('nameSave');
        setName(draft.trim() ? draft.trim().slice(0, 20) : null);
        setEditing(false);
      }}>
        <input value={draft} maxLength={20} autoFocus placeholder="이름을 적거나 아래 예시에서 고르기"
          aria-label="이 광석의 이름" onChange={(e) => setDraft(e.target.value)} />
        <div className="ore-name-examples" role="group" aria-label="예시 이름">
          {exampleNames(w.mineral).map((m) => (
            <button key={m} className="chip" type="button" aria-pressed={draft === m} onClick={() => setDraft(m)}>{m}</button>
          ))}
        </div>
        <button className="btn" type="submit">붙이기</button>
        <button className="btn" type="button" onClick={() => { setDraft(name ?? ''); setEditing(false); }}>돌아가기</button>
      </form>
    );
  }
  return (
    <span className="ore-name">
      <span className="chip"><i style={{ background: color }} />{name ?? `${dateLabel(w.date_start)}의 광석`}</span>
      <button className="btn ore-name-btn" type="button" onClick={() => setEditing(true)}>{name ? '이름 바꾸기' : '이름 붙이기'}</button>
    </span>
  );
}

/**
 * 11/11 보별: 캐기가 끝나면 이름 짓기 창이 바로 뜬다. 적거나 예시를 고르고 「붙이기」, 아니면 「나중에」.
 * 나중에 붙이고 싶으면 열린 광석 화면의 「이름 붙이기」가 그대로 있다.
 */
export function OreNameAsk({ week, mineral }: { week: string; mineral: string }) {
  const [saved, setSaved] = useState(() => customOreName(week));
  const [closed, setClosed] = useState(false);
  const [draft, setDraft] = useState(saved ?? '');
  if (closed) return null;
  if (saved) {
    return <p className="ore-name-ask done" aria-live="polite"><span className="chip"><i style={{ background: MINERAL_COLOR[mineral] }} />{saved}</span> 이름을 붙였어요.</p>;
  }
  return (
    <form className="ore-name-ask" aria-label="이 광석에 이름 붙이기" onSubmit={(e) => {
      e.preventDefault();
      const v = draft.trim().slice(0, 20);
      if (!v) return;
      saveOreName(week, v); sfx('nameSave'); setSaved(v);
    }}>
      <p className="ore-name-ask-q">이 광석에 이름을 붙여 볼까요?</p>
      <input value={draft} maxLength={20} placeholder="이름을 적거나 아래에서 고르기"
        aria-label="이 광석의 이름" onChange={(e) => setDraft(e.target.value)} />
      <div className="ore-name-examples" role="group" aria-label="예시 이름">
        {exampleNames(mineral).slice(0, 6).map((m) => (
          <button key={m} className="chip" type="button" aria-pressed={draft === m} onClick={() => setDraft(m)}>{m}</button>
        ))}
      </div>
      <div className="ore-name-ask-btns">
        <button className="btn" type="submit" disabled={!draft.trim()}>붙이기</button>
        <button className="btn" type="button" onClick={() => setClosed(true)}>나중에</button>
      </div>
    </form>
  );
}
