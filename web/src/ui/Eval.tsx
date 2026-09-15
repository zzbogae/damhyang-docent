// 실제 기록으로 평가하기: 결과를 보기 전에 사건을 적어 봉인하고, 가린 주를 기억해 본 뒤, 숫자만 담은 보고서를 내려받는다.
// 순서가 뜻을 가지므로(봉인 → 결과 → 계산) 단계에 번호를 붙인다.
import { useEffect, useMemo, useState } from 'react';
import { getKV, setKV } from '../db';
import { useStore } from '../state/store';
import {
  type Answer, buildReport, checkEvent, EMPTY_STATE, type EvalEvent, type EvalState, type EventKind, hashEvents,
  KIND_LABEL, KIND_SHORT, participantOk, ratingStats, resultKey, sampleForRating,
} from '../eval/field';
import { IconTrash } from './Icons';
import { CHANNEL_LABEL, type Channel, type WeekRecord } from '../types';

const WD = ['일', '월', '화', '수', '목', '금', '토'];

function dayText(iso: string, withYear = true) {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${withYear ? `${y}년 ` : ''}${m}월 ${d}일(${wd})`;
}

function spanText(start: string, end?: string) {
  if (!end || end === start) return dayText(start);
  return `${dayText(start)} ~ ${dayText(end, end.slice(0, 4) !== start.slice(0, 4))}`;
}

function stampText(iso: string) {
  const t = new Date(iso);
  const h = t.getHours();
  return `${t.getMonth() + 1}월 ${t.getDate()}일 ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(t.getMinutes()).padStart(2, '0')}`;
}

const today = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

function useEvalState() {
  const [st, setSt] = useState<EvalState>();
  useEffect(() => { getKV<EvalState>('eval').then((v) => setSt(v ?? EMPTY_STATE)); }, []);
  const save = (next: EvalState) => { setSt(next); setKV('eval', next); };
  return [st, save] as const;
}

function EventsStep({ st, save, hasResult }: { st: EvalState; save: (s: EvalState) => void; hasResult: boolean }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [kind, setKind] = useState<EventKind>('hard');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [unsealAsk, setUnsealAsk] = useState(false);
  const sealed = !!st.sealedHash;
  const events = [...st.events].sort((a, b) => a.start.localeCompare(b.start));

  function add() {
    const e = { start, end: kind === 'change' ? undefined : end || undefined, kind };
    const bad = checkEvent(e, today());
    if (bad) { setErr(bad); return; }
    const ev: EvalEvent = { id: `ev-${Date.now().toString(36)}`, ...e, ...(note.trim() ? { note: note.trim().slice(0, 60) } : {}) };
    save({ ...st, events: [...st.events, ev] });
    setStart(''); setEnd(''); setNote(''); setErr('');
  }

  async function seal() {
    const h = await hashEvents(st.events);
    save({ ...st, sealedHash: h, sealedAt: new Date().toISOString(), sealedBeforeResult: !hasResult, seals: st.seals + 1 });
  }

  return (
    <section className="eval-step" aria-labelledby="ev-s1">
      <h2 id="ev-s1" className="section-title">1. 결과를 보기 전에, 날짜가 확실한 일을 적습니다</h2>
      <p className="lede">아팠던 주, 시험이나 마감, 여행, 이사처럼 달력·사진·메일로 날짜를 확인할 수 있는 일을 5개에서 15개쯤 적어 주세요. 기억이 흐린 일은 빼는 편이 낫습니다. 다 적으면 봉인합니다. 봉인한 뒤에는 고칠 수 없고, 고치려면 봉인을 풀어야 하며 푼 횟수가 보고서에 남습니다.</p>

      {sealed ? (
        <p className="eval-seal" role="status">
          <b>봉인했습니다</b> · {stampText(st.sealedAt!)} · 사건 {st.events.length}개 ·{' '}
          {st.sealedBeforeResult ? '판정 결과를 보기 전에 봉인했습니다.' : '판정 결과가 이미 있을 때 봉인했습니다. 보고서에 그대로 적힙니다.'}
        </p>
      ) : hasResult && (
        <p className="help"><b>이미 판정 결과가 있습니다.</b> 지층 화면을 본 뒤에 적은 사건은 결과에 끌려갈 수 있어서, 보고서에 "결과를 본 뒤 봉인"으로 적힙니다.</p>
      )}

      {events.length > 0 && (
        <ul className="ev-list" aria-label="적은 사건">
          {events.map((e) => (
            <li key={e.id}>
              <span className="when">{spanText(e.start, e.end)}</span>
              <span className="kind">{KIND_SHORT[e.kind]}</span>
              <span className="note muted">{e.note ?? ''}</span>
              {!sealed && (
                <button className="btn quiet icon-only" aria-label={`${dayText(e.start)} 사건 지우기`}
                  onClick={() => save({ ...st, events: st.events.filter((x) => x.id !== e.id) })}><IconTrash /></button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!sealed && (
        <div className="ev-form">
          <label>시작한 날<input className="input" type="date" value={start} max={today()} onChange={(e) => setStart(e.target.value)} /></label>
          <label>끝난 날(하루면 비워 둠)
            <input className="input" type="date" value={end} min={start || undefined} max={today()} disabled={kind === 'change'} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <label>어떤 일
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
              {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="wide">메모(선택, 이 기기에만 남음)<input className="input" value={note} maxLength={60} placeholder="예: 독감, 제주 여행" onChange={(e) => setNote(e.target.value)} /></label>
          <div className="wide row">
            <button className="btn" onClick={add}>사건 더하기</button>
            {err && <p className="err" role="alert">{err}</p>}
          </div>
        </div>
      )}

      <div className="row">
        {!sealed ? (
          <>
            <button className="btn primary" disabled={st.events.length < 3} onClick={seal}>봉인하기</button>
            {st.events.length < 3 && <span className="small muted">사건을 3개 이상 적으면 봉인할 수 있습니다.</span>}
          </>
        ) : !unsealAsk ? (
          <button className="btn quiet" onClick={() => setUnsealAsk(true)}>봉인 풀고 고치기</button>
        ) : (
          <>
            <span className="small">봉인을 풀면 보고서에 푼 횟수가 남습니다.</span>
            <button className="btn danger" onClick={() => { save({ ...st, sealedHash: undefined, sealedAt: undefined }); setUnsealAsk(false); }}>봉인 풀기</button>
            <button className="btn quiet" onClick={() => setUnsealAsk(false)}>그만두기</button>
          </>
        )}
      </div>
    </section>
  );
}

const ANSWERS: [Answer, string][] = [['yes', '기억에 남는 주였습니다'], ['no', '평범한 주였습니다'], ['unsure', '잘 모르겠습니다']];

function RatingStep({ st, save, weeks }: { st: EvalState; save: (s: EvalState) => void; weeks: WeekRecord[] }) {
  const key = resultKey(weeks);
  const stale = !!st.ratings && st.ratingKey !== key;
  const items = !stale ? st.ratings ?? [] : [];
  const byWeek = useMemo(() => new Map(weeks.map((w) => [w.week, w])), [weeks]);
  const firstOpen = items.findIndex((x) => !x.answer);
  const [pos, setPos] = useState(firstOpen >= 0 ? firstOpen : 0);
  const done = items.length > 0 && firstOpen < 0;

  function start() {
    const seed = Math.floor(Math.random() * 2 ** 31);
    save({ ...st, ratings: sampleForRating(weeks, seed), ratingKey: key });
    setPos(0);
  }
  function answer(a: Answer) {
    const next = items.map((x, i) => (i === pos ? { ...x, answer: a } : x));
    save({ ...st, ratings: next, ratingKey: key });
    const nxt = next.findIndex((x, i) => i > pos && !x.answer);
    setPos(nxt >= 0 ? nxt : Math.min(pos + 1, next.length - 1));
  }

  const cur = items[pos];
  const w = cur ? byWeek.get(cur.week) : undefined;
  const answered = items.filter((x) => x.answer).length;

  return (
    <section className="eval-step" aria-labelledby="ev-s2">
      <h2 id="ev-s2" className="section-title">2. 가려 놓은 주를 기억해 봅니다</h2>
      <p className="lede">판정된 주와 평범한 주를 같은 수만큼 섞어 골랐습니다. 어느 쪽인지는 알려 드리지 않습니다. 달력이나 사진첩을 봐도 되지만, 지층 화면은 보지 말아 주세요.</p>
      {stale && <p className="help"><b>기록을 다시 가져와 판정이 바뀌었습니다.</b> 가린 주를 새로 골라 주세요.</p>}
      {!items.length ? (
        <div className="row"><button className="btn primary" onClick={start} disabled={weeks.filter((x) => x.candidate).length < 3}>가린 주 고르기</button></div>
      ) : (
        <div className="rate-card">
          <p className="small muted" aria-live="polite">{pos + 1} / {items.length}주 · {done ? '모두 답했습니다' : `${answered}주 답함`}</p>
          {w && <p className="rate-when">{dayText(w.date_start)} ~ {dayText(w.date_end, w.date_end.slice(0, 4) !== w.date_start.slice(0, 4))}</p>}
          <div className="rate-answers" role="group" aria-label="이 주에 대한 답">
            {ANSWERS.map(([a, t]) => (
              <button key={a} className={`btn${cur?.answer === a ? ' on' : ''}`} aria-pressed={cur?.answer === a} onClick={() => answer(a)}>{t}</button>
            ))}
          </div>
          <div className="row">
            <button className="btn quiet" disabled={pos === 0} onClick={() => setPos(pos - 1)}>앞 주로</button>
            <button className="btn quiet" disabled={pos >= items.length - 1} onClick={() => setPos(pos + 1)}>다음 주로</button>
            {done && <button className="btn quiet" onClick={start}>새로 골라 다시 하기</button>}
          </div>
        </div>
      )}
    </section>
  );
}

const pct = (x: unknown) => (typeof x === 'number' ? `${Math.round(x * 100)}%` : '계산 안 됨');
const num = (x: unknown, nd = 2) => (typeof x === 'number' ? x.toFixed(nd) : '계산 안 됨');

function ReportView({ rep }: { rep: Record<string, any> }) {
  const r = rep.result ?? {};
  const a = rep.anchors;
  const rt = rep.ratings;
  const hold = Object.entries(rep.holdout ?? {}).filter(([, v]: [string, any]) => v?.lift != null) as [string, any][];
  const rows: [string, string][] = [
    ['기록 기간', `약 ${rep.span?.years}년 · ${rep.span?.n_weeks}주 · 채널 ${Object.keys(rep.channels ?? {}).length}개`],
    ['판정된 주', `${r.n_candidates}주 (판정할 수 있었던 주의 ${pct(r.candidate_rate)})`],
    ['적은 사건 앞뒤 1주 안에 판정이 있었던 비율', a ? `${pct(a.event_recall_pm1)} (사건 ${a.n_events}개)` : '사건이 없어 계산 안 됨'],
    ['사건 앞뒤에 판정이 몰린 정도', a ? `우연의 ${num(a.enrichment)}배 (p=${num(a.p_value, 3)})` : '계산 안 됨'],
    ['사건에서 먼 주가 판정된 비율', pct(rep.chance_rate_far)],
    ['계속되는 변화 근처의 시기 경계', rep.persistent_boundaries ? `${pct(rep.persistent_boundaries.recall)} (${rep.persistent_boundaries.n}개 중)` : '적은 변화 없음'],
    ['가린 주: 기억에 남는다고 답한 비율', rt ? `판정된 주 ${pct(rt.rate_candidates)} · 평범한 주 ${pct(rt.rate_controls)} (p=${num(rt.p_one_sided, 3)})` : '답하지 않음'],
    ['한 채널을 빼고 판정해도 그 채널이 튀었던 정도', hold.length ? hold.map(([ch, v]) => `${CHANNEL_LABEL[ch as Channel] ?? ch} ${num(v.lift)}배`).join(' · ') : '계산 안 됨'],
    ['창 길이를 26주·104주로 바꿨을 때 겹침', `${num(rep.window?.['26']?.jaccard_vs_52)} · ${num(rep.window?.['104']?.jaccard_vs_52)}`],
    ['결측 가정을 바꿔도 남은 판정', pct(rep.missing?.kept_both)],
  ];
  return (
    <div className="report">
      <table className="cmp-table">
        <tbody>{rows.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody>
      </table>
      <details>
        <summary className="small">보고서 원문(JSON) 보기</summary>
        <pre className="report-json">{JSON.stringify(rep, null, 1)}</pre>
      </details>
    </div>
  );
}

function ReportStep({ st, save }: { st: EvalState; save: (s: EvalState) => void }) {
  const [quick, setQuick] = useState(false);
  const [stage, setStage] = useState('');
  const [err, setErr] = useState('');
  const [rep, setRep] = useState<Record<string, any>>();
  const [secs, setSecs] = useState(0);
  const codeOk = participantOk(st.participant);

  async function compute() {
    setErr(''); setRep(undefined); setStage('Python 런타임 준비 중');
    const t0 = Date.now();
    const tick = setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 1000);
    try {
      const { computeFieldReport } = await import('../pipeline');
      const { report } = await computeFieldReport(st.events, quick, setStage);
      setRep(buildReport(report, st));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      clearInterval(tick);
      setStage('');
    }
  }

  function download() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(rep, null, 1)], { type: 'application/json' }));
    a.download = `mined_eval_${st.participant}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const answered = ratingStats(st.ratings ?? []);
  return (
    <section className="eval-step" aria-labelledby="ev-s3">
      <h2 id="ev-s3" className="section-title">3. 숫자만 담은 보고서를 만듭니다</h2>
      <p className="lede">봉인한 사건과 가린 주에 답한 내용으로 판정이 얼마나 맞았는지 이 브라우저 안에서 계산합니다. 보고서에는 숫자, 채널과 출처 앱 이름, 봉인 확인값만 들어가고 날짜·사건 메모·기록 원문은 들어가지 않습니다. 보내기 전에 아래 표와 원문을 직접 확인해 주세요.</p>
      <label className="eval-code">참가 코드
        <input className="input" value={st.participant} maxLength={16} placeholder="예: P1" aria-invalid={!!st.participant && !codeOk}
          onChange={(e) => save({ ...st, participant: e.target.value.trim() })} />
        <span className="small muted">멘토가 알려 준 코드를 적습니다. 이름이나 생년월일은 적지 않습니다.</span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} />
        <span><span className="t">빠르게 계산</span><br /><span className="d">설정 비교와 "평소 주에 변화를 넣어 찾는지"를 건너뜁니다. 기록이 10년이 넘으면 전체 계산에 1~2분 걸립니다.</span></span>
      </label>
      {!answered.n_candidates && <p className="small muted">가린 주에 답하지 않았어도 계산할 수 있습니다. 그 칸은 비워 둡니다.</p>}
      <div className="row">
        <button className="btn primary" disabled={!!stage || !codeOk} onClick={compute}>{stage ? '계산하는 중' : '계산하기'}</button>
        {!codeOk && <span className="small muted">참가 코드를 적으면 계산할 수 있습니다(영문·숫자 16자 이내, 연도처럼 보이는 숫자 제외).</span>}
      </div>
      {stage && <p className="small" aria-live="polite">{stage} · {secs}초</p>}
      {err && <p className="err" role="alert">{err}</p>}
      {rep && (
        <>
          <ReportView rep={rep} />
          <div className="row"><button className="btn primary" onClick={download}>보고서 내려받기</button></div>
        </>
      )}
    </section>
  );
}

export default function Eval({ onClose, onImport }: { onClose: () => void; onImport: () => void }) {
  const { phase, weeks, result } = useStore();
  const [st, save] = useEvalState();
  const hasResult = phase === 'ready' && weeks.length > 0;
  const fromV6 = !!(result?.summary as any)?.imported_v6;
  if (!st) return null;
  return (
    <div className="eval">
      <div className="eval-head">
        <div>
          <h1>실제 기록으로 평가하기</h1>
          <p className="promise-big">판정이 실제 삶의 일과 맞는지 알아보는 평가입니다. 여기서 적은 날짜와 메모는 이 브라우저에만 남습니다.</p>
        </div>
        <button className="btn quiet" onClick={onClose}>{hasResult ? '지층으로 돌아가기' : '가져오기로 돌아가기'}</button>
      </div>
      <EventsStep st={st} save={save} hasResult={hasResult} />
      <hr className="divider" />
      {!hasResult ? (
        <section className="eval-step">
          <h2 className="section-title">2~3. 기록을 가져온 뒤에 이어서 합니다</h2>
          <p className="lede">사건을 봉인한 다음 기록을 가져오면, 가린 주 기억해 보기와 보고서 만들기를 이어서 할 수 있습니다.</p>
          <div className="row"><button className="btn" disabled={!st.sealedHash} onClick={onImport}>기록 가져오러 가기</button></div>
        </section>
      ) : fromV6 ? (
        <p className="help"><b>팀 v6 JSON 으로 불러온 결과입니다.</b> 일 단위 기록이 없어 평가를 계산할 수 없습니다. 원래 내보내기 파일로 다시 가져와 주세요.</p>
      ) : (
        <>
          <RatingStep st={st} save={save} weeks={weeks} />
          <hr className="divider" />
          <ReportStep st={st} save={save} />
        </>
      )}
    </div>
  );
}
