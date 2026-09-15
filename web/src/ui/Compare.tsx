// 두 기간 비교: 지표마다 관측된 주의 중앙값을 나란히 놓는다. 숫자는 주 레코드의 원래 값에서만 나온다.
import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { compare, periodOptions } from '../query/periods';
import { LABEL, valueText } from './format';

export function Compare() {
  const { result, labels, select } = useStore();
  const opts = useMemo(() => (result ? periodOptions(result, labels) : []), [result, labels]);
  const years = opts.filter((o) => o.spec.kind === 'year');
  const [ka, setKa] = useState(() => years[0]?.key ?? opts[0]?.key ?? '');
  const [kb, setKb] = useState(() => years[years.length - 1]?.key ?? opts[opts.length - 1]?.key ?? '');
  if (!result || !opts.length) return null;
  const A = opts.find((o) => o.key === ka) ?? opts[0];
  const B = opts.find((o) => o.key === kb) ?? opts[opts.length - 1];
  const c = compare(A.spec, B.spec, result, labels);
  const pick = (value: string, set: (v: string) => void, label: string) => (
    <select className="select" value={value} onChange={(e) => set(e.target.value)} aria-label={label}>
      {opts.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
    </select>
  );
  return (
    <section className="compare" aria-labelledby="cmp-title">
      <h2 id="cmp-title" className="section-title">두 기간 비교</h2>
      <p className="lede">기간마다 기록이 있는 주의 중앙값입니다. 관측된 주가 4주보다 적은 값은 비워 둡니다.</p>
      <div className="label-row" style={{ flexWrap: 'wrap' }}>
        {pick(ka, setKa, '첫 번째 기간')}
        <span className="muted" style={{ alignSelf: 'center' }}>와(과)</span>
        {pick(kb, setKb, '두 번째 기간')}
      </div>
      <table className="cmp-table">
        <thead>
          <tr><th scope="col">지표</th><th scope="col">{c.a.name}</th><th scope="col">{c.b.name}</th><th scope="col">변화</th></tr>
        </thead>
        <tbody>
          {c.rows.map((r) => (
            <tr key={r.metric}>
              <th scope="row">{LABEL[r.metric] ?? r.metric}</th>
              <td>{valueText(r.metric, r.a.value)}<span className="muted small"> · {r.a.n}주</span></td>
              <td>{valueText(r.metric, r.b.value)}<span className="muted small"> · {r.b.n}주</span></td>
              <td>{r.ratio === null ? <span className="muted">-</span> : Math.round(Math.abs(r.ratio) * 100) === 0 ? '거의 같음' : `${Math.round(Math.abs(r.ratio) * 100)}% ${r.ratio > 0 ? '늘어남' : '줄어듦'}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {[c.a, c.b].map((p, i) => (
        <p key={i} className="small" style={{ marginTop: 8 }}>
          {p.name}: {p.weeks}주 가운데 평소와 달랐던 주 {p.candidates.length}개{' '}
          {p.candidates.slice(-5).map((w) => (
            <button key={w.week} className="linkish small" style={{ marginRight: 6 }} onClick={() => select(w.week)}>{w.date_start.slice(2).replaceAll('-', '.')}</button>
          ))}
        </p>
      ))}
    </section>
  );
}
