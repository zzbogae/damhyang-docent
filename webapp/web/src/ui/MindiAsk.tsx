// 민디에게 묻기: 민디는 먼저 말하지 않고, 사용자가 고른 질문에만 판정값으로 답한다.
import { useEffect, useState } from 'react';
import { playCue } from '../mindi/sound';
import { useStore } from '../state/store';
import { answer, AXIS_DIR_QUESTION, axisDirAnswer, QUESTIONS, type Answer, type QuestionId } from '../mindi/answers';
import { FEELING_TEXT, parseIntent, UNCLEAR_TEXT, UNKNOWN_TEXT } from '../mindi/intent';
import { useEn } from '../i18n/useEn';
import { answerEn, axisDirEn, DONT_KNOW_EN, FEELING_EN, UNCLEAR_EN, UNKNOWN_EN } from '../i18n/en';
import { DONT_KNOW } from '../mindi/templates';
import { polishTone } from '../mindi/tone';
import { MindiMark } from './Icons';
import type { Axis, WeekRecord } from '../types';

const EXAMPLES = ['이 주에 무엇이 달랐어?', '이 주와 닮은 주는 언제야?', '잠을 못 잔 주는 언제였어?'];

export function MindiAsk({ w }: { w: WeekRecord }) {
  const { result, byKey, memosByWeek, select, settings } = useStore();
  const [q, setQ] = useState<QuestionId | null>(null);
  const [a, setA] = useState<(Answer & { used?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [heard, setHeard] = useState<string | null>(null);
  const en = useEn();
  // 영어 자막을 만들 원천(어떤 질문에 답했는지). 답 문장이 아니라 판정값에서 다시 만든다
  const [src, setSrc] = useState<{ q?: QuestionId; axis?: Axis; dir?: 'up' | 'down'; kind?: 'feeling' | 'unknown' | 'unclear' } | null>(null);
  const [choices, setChoices] = useState<{ axis: Axis; dir: 'up' | 'down'; text: string }[]>([]);
  // 답이 나올 때마다 같은 소리 하나(답의 내용과 상관없이)
  useEffect(() => { if (a && settings.sound) playCue('found'); }, [a]);
  if (!result) return null;

  async function show(base: Answer) {
    if (!settings.tone) { setA(base); return; }
    setBusy(true);
    const r = await polishTone(base.text);
    setBusy(false);
    setA({ ...base, text: r.text, used: r.used });
  }

  function askAxis(axis: Axis, dir: 'up' | 'down') {
    setChoices([]);
    setSrc({ axis, dir });
    setHeard(AXIS_DIR_QUESTION[axis][dir]);
    return show(axisDirAnswer(axis, dir, w, { result: result!, memosByWeek }));
  }

  // 자유 질문: 기기 안 규칙으로 정해진 질문에 잇는다. 어떻게 알아들었는지 함께 보여 준다
  function askFree(q = text) {
    const it = parseIntent(q);
    setQ(null);
    setChoices([]);
    if (it.kind === 'axis') return askAxis(it.axis, it.dir);
    if (it.kind === 'question') { setHeard(QUESTIONS.find((x) => x.id === it.id)!.text); return ask(it.id, true); }
    setHeard(null);
    if (it.kind === 'axis_unclear') {
      setSrc({ kind: 'unclear' });
      setChoices((['up', 'down'] as const).map((dir) => ({ axis: it.axis, dir, text: AXIS_DIR_QUESTION[it.axis][dir] })));
      return setA({ text: UNCLEAR_TEXT, dontKnow: false });
    }
    setSrc({ kind: it.kind === 'feeling' ? 'feeling' : 'unknown' });
    return setA({ text: it.kind === 'feeling' ? FEELING_TEXT : UNKNOWN_TEXT, dontKnow: false });
  }

  async function ask(id: QuestionId, keepHeard = false) {
    const base = answer(id, w, { result: result!, byKey, memosByWeek });
    setQ(id);
    setSrc({ q: id });
    if (!keepHeard) setHeard(null);
    setChoices([]);
    if (!settings.tone) { setA(base); return; }
    setBusy(true);
    const r = await polishTone(base.text);
    setBusy(false);
    setA({ ...base, text: r.text, used: r.used });
  }

  return (
    <section className="ask" aria-labelledby="ask-title">
      <h3 id="ask-title" className="h3">민디에게 묻기</h3>
      {/* 9/12 회의: 정해진 질문 버튼 대신 문장으로 묻는다. 예시는 입력칸에 채워 묻기만 한다 */}
      <form className="label-row" onSubmit={(e) => { e.preventDefault(); if (text.trim()) askFree(); }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="예: 잠을 못 잔 주는 언제였어?" aria-label="민디에게 직접 묻기" />
        <button className="btn" type="submit" disabled={busy || !text.trim()}>묻기</button>
      </form>
      <p className="small muted" style={{ marginTop: 6 }}>
        예:{' '}
        {EXAMPLES.map((ex, i) => (
          <span key={ex}>{i > 0 && ' · '}<button type="button" className="linkish" onClick={() => { setText(ex); askFree(ex); }}>{ex}</button></span>
        ))}
      </p>
      {a && (
        <div className="bubble" role="status" aria-live="polite">
          <MindiMark size={36} />
          <div>
            {heard && <p className="small muted">「{heard}」로 알아들었습니다.</p>}
            <p>{a.text}{a.dontKnow && <> <span className="dk">{DONT_KNOW}</span></>}</p>
            {en && src && (
              <p className="sub-en" lang="en">
                {src.q ? answerEn(src.q, w, { result, byKey, memosByWeek })
                  : src.axis && src.dir ? axisDirEn(src.axis, src.dir, w, { result, memosByWeek })
                  : src.kind === 'feeling' ? FEELING_EN : src.kind === 'unclear' ? UNCLEAR_EN : UNKNOWN_EN}
                {a.dontKnow ? ` ${DONT_KNOW_EN}` : ''}
              </p>
            )}
            {choices.length > 0 && (
              <div className="label-row" style={{ marginTop: 8 }}>
                {choices.map((c) => <button key={c.dir} className="btn" onClick={() => askAxis(c.axis, c.dir)}>{c.text}</button>)}
              </div>
            )}
            <div className="label-row" style={{ marginTop: 8 }}>
              {a.goto && a.goto !== w.week && <button className="btn" onClick={() => select(a.goto)}>그 주 열어 보기</button>}
              {a.collect && <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent('mined:collect', { detail: a.collect }))}>그 주들 모아 보기</button>}
            </div>
            {a.used === 'llm' && <p className="small muted" style={{ marginTop: 6 }}>말투는 외부 모델이 다듬었습니다. 숫자와 날짜는 계산한 값 그대로입니다.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
