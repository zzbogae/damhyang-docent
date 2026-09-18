// 지층 아래 요약: 판정 수와 우연 기대치, 채널별 관측 범위.
import { useStore } from '../state/store';
import { CHANNEL_LABEL, CHANNELS, type DailyMeta } from '../types';
import { useEffect, useState } from 'react';
import { getKV } from '../db';
import { LABEL } from './format';

export function Summary() {
  const { result } = useStore();
  const [meta, setMeta] = useState<DailyMeta>();
  useEffect(() => { getKV<DailyMeta>('meta').then(setMeta); }, [result]);
  if (!result) return null;
  const s = result.summary as any;
  const nw = s.n_weeks as number;
  const nc = s.n_candidates as number;
  const nx = s.n_cross as number;
  const chance = s.cross_null as { observed: number; null_mean: number } | undefined;
  return (
    <section aria-labelledby="sum-title" style={{ marginTop: 28 }}>
      <h2 id="sum-title" className="section-title">판정 요약</h2>
      {s.imported_v6 && <p className="small muted">팀 v6 판정 JSON 에서 불러온 결과입니다. 판정된 주와 원문만 들어 있어서 4축 게이지·닮은 주·시기는 비어 있습니다.</p>}
      <div className="summary-line">
        <span>분석한 주 <b>{nw.toLocaleString()}</b></span>
        <span>평소와 달랐던 주 <b>{nc}</b></span>
        <span>서로 다른 기록이 함께 가리킨 주 <b>{nx}</b></span>
        <span>근거가 얇은 주 <b>{nc - nx}</b></span>
      </div>
      {chance && (
        <p className="small muted" style={{ marginTop: 8 }}>
          서로 다른 기록 두 종류 이상이 같은 주에 평소를 벗어난 주는 {chance.observed}주입니다. 기록끼리 아무 관계가 없어도
          우연히 약 {Math.round(chance.null_mean)}주는 겹칩니다.
        </p>
      )}
      {Array.isArray(s.linked_pairs) && s.linked_pairs.length > 0 && (
        <p className="small muted" style={{ marginTop: 8 }}>
          이 기록에서 늘 함께 움직이는 지표: {s.linked_pairs.slice(0, 4).map((l: any) => `${LABEL[l.a] ?? l.a}·${LABEL[l.b] ?? l.b}(상관 ${Number(l.rho).toFixed(2)})`).join(', ')}. 계열이 달라도 같은 주에 함께 벗어나면 근거 하나로 셉니다.
        </p>
      )}
      <table className="channels-table" aria-label="채널별 기록 범위">
        <tbody>
          {CHANNELS.map((ch) => {
            const cov = s.coverage?.[ch];
            const m = meta?.channels?.[ch];
            const share = cov ? Math.round(cov.share * 100) : 0;
            return (
              <tr key={ch}>
                <td style={{ width: 90 }}>{CHANNEL_LABEL[ch]}</td>
                <td>
                  <div className="bar" aria-hidden="true"><i style={{ width: `${share}%` }} /></div>
                </td>
                <td style={{ width: 210 }}>
                  {cov && cov.observed_weeks > 0 ? `${cov.observed_weeks}주 (${share}%)` : '가져오지 않음'}
                  {m?.records ? ` · ${m.records.toLocaleString()}건` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
