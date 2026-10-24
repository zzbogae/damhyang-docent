// 민디에게 묻기: 민디는 먼저 말하지 않고, 사용자가 고른 질문에만 판정값으로 답한다.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { sfx } from '../mindi/soundKit';
import { rangeLabel } from '../mindi/templates';
import { playCue } from '../mindi/sound';
import { mindiSay } from '../mindi/soundKit';
import { useStore } from '../state/store';
import { answer, AXIS_DIR_QUESTION, axisDirAnswer, QUESTIONS, type Answer, type QuestionId } from '../mindi/answers';
import { FEELING_TEXT, parseIntent, UNCLEAR_TEXT, UNKNOWN_TEXT } from '../mindi/intent';
import { useEn } from '../i18n/useEn';
import { answerEn, axisDirEn, DONT_KNOW_EN, FEELING_EN, UNCLEAR_EN, UNKNOWN_EN } from '../i18n/en';
import { DONT_KNOW } from '../mindi/templates';
import { applyVoice, speakAs, useVoice, type Voice } from '../mindi/voices';
import { fixedKind, fixedLine, scriptedReply } from '../mindi/talk';
import { MindiMark } from './Icons';
import { VoiceChip } from './VoiceChip';
import type { Axis, WeekRecord } from '../types';

const EXAMPLES = ['이 주에 무엇이 달랐어?', '이 주와 닮은 주는 언제야?', '잠을 못 잔 주는 언제였어?'];

/** voiceChip: 말투 칩을 이 머리에 둘지(민디와 이야기 화면은 위쪽 줄에 따로 둔다)
 *  chat: 민디와 이야기(P9) 배치 — 대화가 위로 쌓이고 「함께 보는 기록」 칩(chip)과 입력창이 아래에 붙는다
 *  initial: 열자마자 보낼 첫 질문(광석 상세의 입력창에서 넘어온 말)
 *  onAsk: 사용자가 먼저 물었을 때(민디와 이야기의 첫 한 마디를 거둔다) */
export function MindiAsk({ w, voiceChip = true, chat = false, initial, chip, onAsk }: { w: WeekRecord; voiceChip?: boolean; chat?: boolean; initial?: string; chip?: ReactNode; onAsk?: () => void }) {
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
  const [voice, setVoice] = useVoice();
  // 말투를 입히기 전의 답(판정값으로 만든 문장). 말투를 바꾸면 이것을 다시 말한다
  const [base, setBase] = useState<Answer | null>(null);
  // 대본집 문장으로 받은 말(공감·돌려 답하기). 말투를 바꾸면 같은 줄의 다른 결로
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => {
    if (said) { const r = scriptedReply(said, voice); if (r) setA({ text: r, dontKnow: false }); }
    else if (base) voiced(base, voice);
  }, [voice]);
  // 답이 나올 때마다 같은 소리 하나(답의 내용과 상관없이)
  useEffect(() => { if (a && settings.sound && !mindiSay(a.text)) playCue('found'); }, [a]);
  // 대화 기록(chat 배치): 새 질문을 보내기 전의 문답을 위에 남긴다
  const [log, setLog] = useState<{ q: string; a: string }[]>([]);
  const [asked, setAsked] = useState<string | null>(null);
  const [why, setWhy] = useState(false);
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !initial?.trim() || !result) return;
    sent.current = true;
    void send(initial.trim());
  }, [initial, result]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!result) return null;

  function send(q: string) {
    if (a && asked) setLog((l) => [...l, { q: asked, a: a.text }]);
    setAsked(q);
    setWhy(false);
    setText('');
    return askFree(q);
  }

  // 고른 말투로: 어미 규칙은 바로, 「말투 다듬기」가 켜져 있으면 외부 모델로 한 번 더(숫자·날짜가 바뀌면 규칙 결과)
  async function voiced(b: Answer, v: Voice = voice) {
    if (!settings.tone) { setA({ ...b, text: applyVoice(b.text, v) }); return; }
    setBusy(true);
    const r = await speakAs(b.text, v, { useLlm: true });
    setBusy(false);
    setA({ ...b, text: r.text, used: r.used });
  }

  function show(b: Answer) {
    setBase(b);
    setSaid(null);
    return voiced(b);
  }

  // 대본집 문장을 그대로(말투 규칙을 다시 입히지 않는다)
  function sayScripted(t: string, raw: string | null) {
    setBase(null);
    setSaid(raw);
    setSrc(null);
    setChoices([]);
    setHeard(null);
    setA({ text: t, dontKnow: false });
  }

  function askAxis(axis: Axis, dir: 'up' | 'down') {
    setChoices([]);
    setSrc({ axis, dir });
    setHeard(AXIS_DIR_QUESTION[axis][dir]);
    return show(axisDirAnswer(axis, dir, w, { result: result!, memosByWeek }));
  }

  // 자유 질문: 기기 안 규칙으로 정해진 질문에 잇는다. 어떻게 알아들었는지 함께 보여 준다
  function askFree(q = text) {
    // 진단·치료·위기는 고정형(대본집 §17): 다른 무엇보다 먼저, 어떤 말투에서도 같은 문장
    onAsk?.();
    const fk = fixedKind(q);
    if (fk) { setQ(null); return sayScripted(fixedLine(fk), null); }
    // 사용자가 먼저 꺼낸 마음·판정을 묻는 말(§11-5 · §11-6)
    const sr = scriptedReply(q, voice);
    if (sr) { setQ(null); return sayScripted(sr, q); }
    const it = parseIntent(q);
    setQ(null);
    setChoices([]);
    if (it.kind === 'axis') return askAxis(it.axis, it.dir);
    if (it.kind === 'question') { setHeard(QUESTIONS.find((x) => x.id === it.id)!.text); return ask(it.id, true); }
    setHeard(null);
    if (it.kind === 'axis_unclear') {
      setSrc({ kind: 'unclear' });
      setChoices((['up', 'down'] as const).map((dir) => ({ axis: it.axis, dir, text: AXIS_DIR_QUESTION[it.axis][dir] })));
      return show({ text: UNCLEAR_TEXT, dontKnow: false });
    }
    setSrc({ kind: it.kind === 'feeling' ? 'feeling' : 'unknown' });
    return show({ text: it.kind === 'feeling' ? FEELING_TEXT : UNKNOWN_TEXT, dontKnow: false });
  }

  async function ask(id: QuestionId, keepHeard = false) {
    const base = answer(id, w, { result: result!, byKey, memosByWeek });
    setQ(id);
    setSrc({ q: id });
    if (!keepHeard) setHeard(null);
    setChoices([]);
    return show(base);
  }

  const body = a && (
    <div>
      {heard && <p className="small muted">「{heard}」로 알아들었습니다.</p>}
      <p>{a.text}{a.dontKnow && <> <span className="dk">{applyVoice(DONT_KNOW, voice)}</span></>}</p>
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
  );

  if (chat) {
    return (
      <section className="ask chat" aria-label="민디와 이야기">
        <div className="talk-log">
          {log.map((x, i) => (
            <div key={i} className="chat-pair">
              <p className="chat-me">{x.q}</p>
              <div className="bubble"><MindiMark size={30} /><p>{x.a}</p></div>
            </div>
          ))}
          {asked && <p className="chat-me">{asked}</p>}
          {a ? (
            <div className="chat-pair" role="status" aria-live="polite">
              <div className="bubble"><MindiMark size={30} />{body}</div>
              {/* 근거 보기는 기록에서 계산한 답에만. 대본집 문장(공감·돌려 답하기·진단·위기 고정형)에는 붙이지 않는다 */}
              {base && <button type="button" className="chat-why" aria-expanded={why} onClick={() => { sfx(why ? 'panelClose' : 'panelOpen'); setWhy((x) => !x); }}>근거 보기 {why ? '▾' : '▸'}</button>}
              {base && why && (
                <div className="chat-evidence">
                  <p className="small">이 답은 {rangeLabel(w)}의 기록에서 계산한 값으로 만들었습니다. 출처: 이 기기에 가져온 기록.</p>
                  {a.goto && <p className="small">함께 짚은 주: {rangeLabel(byKey.get(a.goto) ?? w)}</p>}
                </div>
              )}
            </div>
          ) : busy ? <p className="small muted">민디가 기록을 찾는 중입니다.</p> : (
            <p className="small muted">
              예:{' '}
              {EXAMPLES.map((ex, i) => (
                <span key={ex}>{i > 0 && ' · '}<button type="button" className="linkish" onClick={() => send(ex)}>{ex}</button></span>
              ))}
            </p>
          )}
        </div>
        {chip}
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { sfx('send'); void send(text.trim()); } }}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="이야기하기…" aria-label="민디에게 직접 묻기" />
          <button className="btn primary" type="submit" disabled={busy || !text.trim()}>보내기</button>
        </form>
      </section>
    );
  }

  return (
    <section className="ask" aria-labelledby="ask-title">
      <div className="ask-head">
        <h3 id="ask-title" className="h3">민디에게 묻기</h3>
        {voiceChip && <VoiceChip value={voice} onChange={setVoice} busy={busy} />}
      </div>
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
            <p>{a.text}{a.dontKnow && <> <span className="dk">{applyVoice(DONT_KNOW, voice)}</span></>}</p>
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
