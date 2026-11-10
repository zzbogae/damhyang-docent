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
import { smallTalk } from '../mindi/smalltalk';
import * as lifebot from '../mindi/lifebot';
import { MindiMark } from './Icons';
import { GO_ISLAND_EVENT } from './Intro';
import { VoiceChip } from './VoiceChip';
import type { Axis, WeekRecord } from '../types';

const EXAMPLES = ['이 주에 무엇이 달랐어?', '이 주와 닮은 주는 언제야?', '잠을 못 잔 주는 언제였어?'];
// 11/06 전시: 챗봇이 없어도 대화가 끊기지 않게, 답 뒤에도 이어 물을 말을 세 개 보여 준다(모두 기기 안 규칙으로 답하는 질문)
const FOLLOW = ['지난 1년 중 가장 달랐던 주는?', '많이 걸은 주는 언제였어?', '글을 많이 쓴 주는 언제야?', ...EXAMPLES];

/** voiceChip: 말투 칩을 이 머리에 둘지(민디와 이야기 화면은 위쪽 줄에 따로 둔다)
 *  chat: 민디와 이야기(P9) 배치 — 대화가 위로 쌓이고 「함께 보는 기록」 칩(chip)과 입력창이 아래에 붙는다
 *  initial: 열자마자 보낼 첫 질문(광석 상세의 입력창에서 넘어온 말)
 *  onAsk: 사용자가 먼저 물었을 때(민디와 이야기의 첫 한 마디를 거둔다) */
const SLOW_MS = 6000;
const TIMEOUT_MS = 30000;
const STOPPED_TEXT = '기다리기를 멈췄어요. 다른 걸 물어봐도 돼요.';

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
  // 라이프로그 챗봇(서버에 연결돼 있을 때만). 정해진 질문으로 못 잇는 말을 챗봇이 받는다
  const [bot, setBot] = useState(false);
  const turns = useRef<lifebot.Turn[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [slow, setSlow] = useState(false);
  const [err, setErr] = useState<{ q: string; fallback: Answer; kind: 'offline' | 'timeout'; again?: boolean } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const waitCtl = useRef<AbortController | null>(null);
  useEffect(() => () => waitCtl.current?.abort(), []);
  useEffect(() => { void lifebot.available().then(setBot); }, []);
  useEffect(() => {
    if (said) { const r = scriptedReply(said, voice); if (r) setA({ text: r, dontKnow: false }); }
    else if (base) voiced(base, voice);
  }, [voice]);
  // 답이 나올 때마다 같은 소리 하나(답의 내용과 상관없이)
  useEffect(() => { if (a && settings.sound && !mindiSay(a.text)) playCue('found'); }, [a]);
  // 대화 기록(chat 배치): 새 질문을 보내기 전의 문답을 위에 남긴다
  const [log, setLog] = useState<{ q: string; a: string }[]>([]);
  // 11/10: 「이 대화로 섬 만들기」(챗봇 연결 시에만). 챗봇이 대화에서 꺼낸 단어·한 줄을 보여 주고, 나의 공간 섬 만들기의 추천 단어로 넘긴다
  const [isl, setIsl] = useState<{ st: 'idle' | 'busy' | 'done' | 'error'; data?: lifebot.ChatIsland }>({ st: 'idle' });
  async function makeIsland() {
    sfx('tap');
    setIsl({ st: 'busy' });
    try { const r = await lifebot.island(turns.current, voice); setIsl({ st: 'done', data: lifebot.saveChatIsland(r) }); }
    catch { setIsl({ st: 'error' }); }
  }
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
    setErr(null);
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
    setFound([]);
    return voiced(b);
  }

  // 챗봇 답은 챗봇이 고른 말투 그대로(앱의 어미 규칙을 다시 입히지 않는다). 실패하면 기기 안 규칙 답으로.
  // v2(11/03) 상태 화면: 기다리는 중(6초가 넘으면 「조금 더」 + 그만 기다리기) · 연결 오류(30초 시간 초과 포함 → 다시 연결해 보기)
  async function askBot(q: string, fallback: Answer) {
    setBase(null);
    setSaid(null);
    setSrc(null);
    setA(null);
    setErr(null);
    setSlow(false);
    setBusy(true);
    const ctl = new AbortController();
    waitCtl.current = ctl;
    let timedOut = false;
    const slowT = setTimeout(() => setSlow(true), SLOW_MS);
    const stopT = setTimeout(() => { timedOut = true; ctl.abort(); }, TIMEOUT_MS);
    try {
      const r = await lifebot.chat(q, turns.current, voice, null, ctl.signal);
      turns.current = [...turns.current, { role: 'user', content: q }, { role: 'assistant', content: r.reply }];
      setFound(r.tools ?? []);
      setA({ text: r.reply, dontKnow: false, used: 'lifebot' });
    } catch {
      if (ctl.signal.aborted && !timedOut) {
        // 사용자가 「그만 기다리기」를 눌렀다: 오류가 아니다
        setA({ text: STOPPED_TEXT, dontKnow: false });
      } else {
        setErr({ q, fallback, kind: timedOut ? 'timeout' : 'offline' });
        setSrc({ kind: fallback.text === FEELING_TEXT ? 'feeling' : 'unknown' });
        await show(fallback);
      }
    } finally {
      clearTimeout(slowT);
      clearTimeout(stopT);
      waitCtl.current = null;
      setSlow(false);
      setBusy(false);
    }
  }

  async function retryBot() {
    if (!err) return;
    sfx('tap');
    setRetrying(true);
    const ok = await lifebot.recheck();
    setRetrying(false);
    if (!ok) { setErr({ ...err, kind: 'offline', again: true }); return; }
    setBot(true);
    return askBot(err.q, err.fallback);
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
    // 챗봇이 없을 때(공개 시연판·오프라인) 일상 대화·마음은 기기 안 규칙으로 받는다(11/10). 기록을 묻는 말은 아래로
    if (!bot) { const st = smallTalk(q, voice); if (st) { setQ(null); return sayScripted(st, q); } }
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
    const fallback = { text: it.kind === 'feeling' ? FEELING_TEXT : UNKNOWN_TEXT, dontKnow: false };
    if (bot) return askBot(q, fallback);
    setSrc({ kind: it.kind === 'feeling' ? 'feeling' : 'unknown' });
    return show(fallback);
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
      {a.used === 'lifebot' && (
        <p className="small muted" style={{ marginTop: 6 }}>
          이 답은 라이프로그 챗봇이 만들었습니다.{found.length > 0 && <> 찾아본 기록: {found.join(' · ')}</>}
        </p>
      )}
      {err && (
        <div className="chat-err" role="alert">
          <p className="small">
            <strong>{err.kind === 'timeout' ? '챗봇의 답이 30초 안에 오지 않았어요.' : '챗봇과 연결되지 않았어요.'}</strong>{' '}
            그래서 위 답은 이 기기 안의 기록으로만 만들었어요.
            {err.again && ' 방금 다시 확인했지만 아직 연결되지 않아요.'}
          </p>
          <button type="button" className="btn quiet" onClick={() => void retryBot()} disabled={retrying || busy}>
            {retrying ? '연결 확인 중…' : '다시 연결해 보기'}
          </button>
        </div>
      )}
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
          ) : null}
          {chat && bot && !busy && turns.current.length >= 2 && isl.st !== 'done' && (
            <div className="chat-island">
              <button type="button" className="chat-why" disabled={isl.st === 'busy'} onClick={() => void makeIsland()}>
                {isl.st === 'busy' ? '대화에서 단어를 꺼내는 중…' : '이 대화로 섬 만들기'}
              </button>
              {isl.st === 'error' && <span className="small muted"> 지금은 꺼내지 못했어요. 잠시 뒤 다시 눌러 주세요.</span>}
            </div>
          )}
          {isl.st === 'done' && isl.data && (
            <div className="chat-pair chat-island-result" role="status">
              <div className="bubble"><MindiMark size={30} /><div className="stack">
                <p>이 대화에서 꺼낸 단어예요. 섬 만들기에서 빼거나 더할 수 있어요.</p>
                <div className="label-row">{isl.data.keywords.map((k) => <span key={k} className="chip">{k}</span>)}</div>
                {isl.data.summary && <p className="small">{isl.data.summary}</p>}
                <p className="small muted">이 단어와 한 줄은 라이프로그 챗봇이 만들었습니다. 기록 원문은 저장하지 않아요.</p>
                <div className="label-row">
                  <button type="button" className="btn primary" onClick={() => { sfx('confirm'); dispatchEvent(new Event(GO_ISLAND_EVENT)); }}>나의 공간에서 이 단어로 섬 짓기</button>
                  <button type="button" className="btn quiet" onClick={() => { lifebot.clearChatIsland(); setIsl({ st: 'idle' }); }}>그냥 두기</button>
                </div>
              </div></div>
            </div>
          )}
          {a && !busy && (
            <p className="small muted chat-follow">
              이어서:{' '}
              {FOLLOW.filter((ex) => ex !== asked && !log.some((x) => x.q === ex)).slice(0, 3).map((ex, i) => (
                <span key={ex}>{i > 0 && ' · '}<button type="button" className="linkish" onClick={() => send(ex)}>{ex}</button></span>
              ))}
            </p>
          )}
          {a ? null : busy ? (
            <div className="chat-pair chat-wait" role="status" aria-live="polite">
              <div className="bubble">
                <MindiMark size={30} />
                <div>
                  <p><span className="typing" aria-hidden="true"><i /><i /><i /></span> 민디가 기록을 찾는 중이에요.</p>
                  {slow && <p className="small muted">조금 더 걸리고 있어요. 기록이 많으면 시간이 걸려요.</p>}
                  {waitCtl.current && <button type="button" className="linkish small" onClick={() => { sfx('tap'); waitCtl.current?.abort(); }}>그만 기다리기</button>}
                </div>
              </div>
            </div>
          ) : (
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
