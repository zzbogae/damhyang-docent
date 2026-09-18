// 민디에게 묻기: 민디는 먼저 말하지 않고, 사용자가 고른 질문에만 판정값으로 답한다.
import { useState } from 'react';
import { useStore } from '../state/store';
import { answer, QUESTIONS, type Answer, type QuestionId } from '../mindi/answers';
import { DONT_KNOW } from '../mindi/templates';
import { polishTone } from '../mindi/tone';
import { MindiMark } from './Icons';
import { SpeakButton } from './Mindi';
import type { WeekRecord } from '../types';

export function MindiAsk({ w }: { w: WeekRecord }) {
  const { result, byKey, memosByWeek, select, settings } = useStore();
  const [q, setQ] = useState<QuestionId | null>(null);
  const [a, setA] = useState<(Answer & { used?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  if (!result) return null;

  async function ask(id: QuestionId) {
    const base = answer(id, w, { result: result!, byKey, memosByWeek });
    setQ(id);
    if (!settings.tone) { setA(base); return; }
    setBusy(true);
    const r = await polishTone(base.text);
    setBusy(false);
    setA({ ...base, text: r.text, used: r.used });
  }

  const full = a ? `${a.text}${a.dontKnow ? ` ${DONT_KNOW}` : ''}` : '';
  return (
    <section className="ask" aria-labelledby="ask-title">
      <h3 id="ask-title" className="h3">민디에게 묻기</h3>
      <div className="chips" role="group" aria-label="질문">
        {QUESTIONS.map((x) => (
          <button key={x.id} className={`btn${q === x.id ? ' primary' : ''}`} onClick={() => ask(x.id)} disabled={busy} aria-pressed={q === x.id}>{x.text}</button>
        ))}
      </div>
      {a && (
        <div className="bubble" role="status" aria-live="polite">
          <MindiMark size={36} />
          <div>
            <p>{a.text}{a.dontKnow && <> <span className="dk">{DONT_KNOW}</span></>}</p>
            <div className="label-row" style={{ marginTop: 8 }}>
              {a.goto && a.goto !== w.week && <button className="btn" onClick={() => select(a.goto)}>그 주 열어 보기</button>}
              <SpeakButton text={full} />
            </div>
            {a.used === 'llm' && <p className="small muted" style={{ marginTop: 6 }}>말투는 외부 모델이 다듬었습니다. 숫자와 날짜는 판정값 그대로입니다.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
