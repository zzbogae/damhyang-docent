// 시기 페이지 v0(계획서 3-3): 여러 기록이 함께(또는 한 기록이 크게) 달라진 지점으로 나눈 시기마다
// 수준 변화·판정된 주·에피소드·붙인 이름·그때 쓴 글 한 줄을 모은다. 모든 줄은 원본 주로 이어진다. LLM 은 쓰지 않는다.
import { useMemo } from 'react';
import { useStore } from '../state/store';
import { rangeLabel } from '../mindi/templates';
import { selectRelic } from '../relic/select';
import { changeText, LABEL } from './format';
import type { Era, WeekRecord } from '../types';
import { Compare } from './Compare';

function dateText(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

function spanText(e: Era) {
  const years = e.n_weeks / 52;
  return years >= 1 ? `약 ${years.toFixed(1)}년` : `${e.n_weeks}주`;
}

function EraBlock({ e, weeks }: { e: Era; weeks: WeekRecord[] }) {
  const { select, memosByWeek, labels, result } = useStore();
  const inEra = weeks.slice(e.start_index, e.end_index);
  const cands = inEra.filter((w) => w.candidate);
  const eps = (result?.episodes ?? []).filter((ep) => ep.date_start >= e.start && ep.date_start <= e.end);
  const names = useMemo(() => {
    const set = new Set(inEra.map((w) => w.week));
    const m = new Map<string, number>();
    for (const l of labels) if (set.has(l.week)) m.set(l.name, (m.get(l.name) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [labels, inEra]);
  const quotes = useMemo(() => {
    const out: { w: WeekRecord; text: string }[] = [];
    for (const w of cands.slice().reverse()) {
      const all = memosByWeek.get(w.week) ?? [];
      const sel = selectRelic(w, all, [], { maxMemos: 1 });
      const id = sel.memo_ids.find((x) => !sel.gated_memo_ids.includes(x));
      const m = all.find((x) => x.id === id);
      if (m) out.push({ w, text: m.text });
      if (out.length >= 2) break;
    }
    return out;
  }, [cands, memosByWeek]);
  const changes = Object.entries(e.change_vs_prev ?? {});
  return (
    <section className="era-block" aria-labelledby={`era-${e.id}`}>
      <h3 id={`era-${e.id}`} className="h3">{dateText(e.start)} ~ {dateText(e.end)} <span className="muted small">· {spanText(e)}</span></h3>
      {changes.length > 0 ? (
        <ul className="era-list">
          {changes.slice(0, 4).map(([id, c]) => <li key={id}>{changeText(id, c)}</li>)}
        </ul>
      ) : <p className="muted small">기록이 시작된 시기입니다.</p>}
      {e.boundary_indicators.length > 0 && (
        <p className="small muted">시작 지점에서 달라진 지표: {e.boundary_indicators.map((i) => LABEL[i] ?? i).join('·')}</p>
      )}
      <p className="small" style={{ marginTop: 6 }}>평소와 달랐던 주 {cands.length}개{eps.length ? ` · 몇 주 이어진 변화 ${eps.length}번` : ''}</p>
      {cands.length > 0 && (
        <div className="labels">
          {cands.slice(-8).map((w) => (
            <button key={w.week} className="btn quiet small" onClick={() => select(w.week)}>{w.date_start.slice(0, 7).replace('-', '.')} {w.date_start.slice(8)}일 주</button>
          ))}
        </div>
      )}
      {names.length > 0 && <p className="small" style={{ marginTop: 6 }}>이 시기에 붙인 이름: {names.map(([n, c]) => `${n}(${c})`).join(', ')}</p>}
      {quotes.map((q) => (
        <blockquote className="era-quote" key={q.w.week}>
          <p>{q.text}</p>
          <button className="linkish small" onClick={() => select(q.w.week)}>{rangeLabel(q.w)} 에 쓴 글</button>
        </blockquote>
      ))}
    </section>
  );
}

export default function Eras() {
  const { result, weeks } = useStore();
  const eras = result?.eras ?? [];
  return (
    <div className="stack">
      <header>
        <h2 className="section-title">시기</h2>
        <p className="lede">여러 기록이 함께 달라졌거나, 한 기록이 반년 넘게 크게 달라진 지점으로 나눈 시기입니다. 계절 때문에 해마다 되풀이되는 변화는 빼고 찾았습니다.</p>
      </header>
      <Compare />
      {eras.length <= 1 && <p className="muted">아직 나눌 만큼 큰 변화가 없습니다. 기록이 2년 넘게 쌓이면 계절을 빼고 비교할 수 있습니다.</p>}
      {eras.slice().reverse().map((e) => <EraBlock key={e.id} e={e} weeks={weeks} />)}
    </div>
  );
}
