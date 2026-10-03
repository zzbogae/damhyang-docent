// 편지: 쓰기와 캐기. 아직 열 때가 안 된 편지는 받침대에 놓인 개수만 보여 주고, 언제 열리는지는 말하지 않는다.
import { useEffect, useState } from 'react';
import { HORIZONS, isDue, loadLetters, makeLetter, saveLetters, type Horizon, type Letter } from '../letters/letters';

function writtenText(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일에 쓴 편지`;
}

export function Letters({ onChange }: { onChange?: () => void }) {
  const [list, setList] = useState<Letter[]>([]);
  const [text, setText] = useState('');
  const [h, setH] = useState<Horizon>('month');
  const [msg, setMsg] = useState('');
  useEffect(() => { loadLetters().then(setList); }, []);

  async function save(next: Letter[]) {
    setList(next);
    await saveLetters(next);
    onChange?.();
  }
  const now = new Date();
  const due = list.filter((l) => isDue(l, now));
  const waiting = HORIZONS.map((x) => ({ ...x, n: list.filter((l) => l.horizon === x.id && !isDue(l, now)).length }));

  return (
    <section className="stack letters" aria-labelledby="letters-title">
      <h2 id="letters-title" className="section-title">편지</h2>
      <p className="muted">지금의 내가 앞으로의 나에게 편지를 둡니다. 열 때가 되어도 알림은 오지 않습니다. 다음에 들어왔을 때 여기서 찾을 수 있습니다.</p>

      <div className="stack">
        <textarea className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label="편지 내용" placeholder="앞으로의 나에게" />
        <div className="row" role="radiogroup" aria-label="받침대">
          {HORIZONS.map((x) => (
            <label key={x.id} className="toggle inline">
              <input type="radio" name="horizon" checked={h === x.id} onChange={() => setH(x.id)} /> {x.label}
            </label>
          ))}
        </div>
        <div className="row">
          <button className="btn primary" disabled={!text.trim()} onClick={async () => {
            await save([...list, makeLetter(text.trim(), h)]);
            setText('');
            setMsg(`${HORIZONS.find((x) => x.id === h)!.label} 받침대에 두었습니다.`);
          }}>받침대에 두기</button>
          {msg && <span className="small muted" role="status">{msg}</span>}
        </div>
      </div>

      <div>
        <h3 className="h3">받침대</h3>
        <ul className="plain">
          {waiting.map((x) => <li key={x.id}>{x.label} · {x.n ? `편지 ${x.n}통` : '비어 있음'}</li>)}
        </ul>
      </div>

      {due.length > 0 && (
        <div className="stack">
          <h3 className="h3">캘 수 있는 편지</h3>
          {due.map((l) => (
            <article key={l.id} className="memo">
              <p className="when">{writtenText(l.written_at)}</p>
              {l.opened_at
                ? <p className="text">{l.text}</p>
                : <button className="btn" onClick={() => save(list.map((x) => (x.id === l.id ? { ...x, opened_at: new Date().toISOString() } : x)))}>편지 열기</button>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
