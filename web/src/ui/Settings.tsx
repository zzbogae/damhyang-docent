// 설정: 목소리, 말투 다듬기(외부 전송 범위를 그대로 적는다), 내 기록 모두 지우기.
import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { getKV, wipeAll } from '../db';
import { rerunKakaoMe } from '../pipeline';

interface ImportSummaryLite { kakaoParticipants?: { name: string; messages: number }[]; kakaoMe?: string }

function KakaoMe() {
  const { reload } = useStore();
  const [sum, setSum] = useState<ImportSummaryLite>();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { getKV<ImportSummaryLite>('import_summary').then(setSum); }, []);
  const people = sum?.kakaoParticipants ?? [];
  if (people.length < 2) return null;
  return (
    <div>
      <p className="h3">카카오톡에서 나는 누구인가요</p>
      <p className="small muted">내가 보낸 메시지로만 새벽 발화·답장 시간 같은 지표를 계산합니다. 처음에는 메시지를 가장 많이 보낸 사람으로 정했습니다.</p>
      <div className="label-row">
        <select className="select" value={sum?.kakaoMe ?? ''} disabled={!!busy} aria-label="카카오톡에서 나"
          onChange={async (e) => {
            setErr(''); setBusy('다시 가져오는 중');
            try {
              await rerunKakaoMe(e.target.value, (p) => setBusy(p.stage));
              setSum(await getKV<ImportSummaryLite>('import_summary'));
              await reload();
            } catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
            setBusy('');
          }}>
          {people.map((p) => <option key={p.name} value={p.name}>{p.name} · 메시지 {p.messages.toLocaleString()}개</option>)}
        </select>
      </div>
      {busy && <p className="small muted" aria-live="polite">{busy}</p>}
      {err && <p className="err" role="alert">{err === '파일을 다시 골라야 합니다' ? '바꾸려면 "다시 가져오기"에서 파일을 한 번 더 골라 주세요. 파일은 이 세션 동안만 기억합니다.' : err}</p>}
    </div>
  );
}
import { IconTrash } from './Icons';

function ExportV6() {
  const { result, memosByWeek } = useStore();
  if (!result) return null;
  async function download() {
    const [{ toV6 }, { selectRelic }] = await Promise.all([import('../bridge/v6'), import('../relic/select')]);
    const j = toV6(result!, (w) => {
      const all = memosByWeek.get(w.week) ?? [];
      const sel = selectRelic(w, all, []);
      return all.filter((m) => sel.memo_ids.includes(m.id) && !sel.gated_memo_ids.includes(m.id));
    }, { sample: !!(result!.config as any)?.sample });
    const blob = new Blob([JSON.stringify(j, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mined_v6_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  return (
    <div>
      <p className="h3">팀 뷰어용 v6 JSON 내려받기</p>
      <p className="small muted">판정된 주를 팀 원페이지 형식(sample_data.json 과 같은 모양)으로 내려받습니다. 그때 쓴 글 원문이 들어가므로 다른 사람에게 보내지 마세요. 비밀번호처럼 보이는 메모와 위기 표현이 담긴 메모는 넣지 않습니다.</p>
      <button className="btn" style={{ marginTop: 10 }} onClick={download}>v6 JSON 내려받기</button>
    </div>
  );
}

function LabelsBackup() {
  const { reload } = useStore();
  const [msg, setMsg] = useState('');
  return (
    <div>
      <p className="h3">붙인 이름 백업</p>
      <p className="small muted">주에 붙인 이름만 파일로 내보내고 다시 가져옵니다. 원문과 사진은 들어가지 않습니다. 다른 브라우저로 옮기거나 기록을 다시 가져온 뒤 방을 되살릴 때 씁니다.</p>
      <div className="label-row">
        <button className="btn" onClick={async () => {
          const { exportLabels } = await import('../backup/labels');
          const j = await exportLabels();
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([JSON.stringify(j, null, 1)], { type: 'application/json' }));
          a.download = `mined_labels_${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          setMsg(`이름 ${j.labels.length}개를 내보냈습니다.`);
        }}>이름 내보내기</button>
        <label className="btn">
          이름 가져오기
          <input type="file" accept=".json,application/json" hidden aria-label="붙인 이름 백업 파일" onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const { importLabels } = await import('../backup/labels');
              const n = await importLabels(JSON.parse(await f.text()));
              await reload();
              setMsg(n ? `이름 ${n}개를 더했습니다.` : '새로 더할 이름이 없습니다.');
            } catch (x) { setMsg(x instanceof Error ? x.message : String(x)); }
          }} />
        </label>
      </div>
      {msg && <p className="small" aria-live="polite" style={{ marginTop: 6 }}>{msg}</p>}
    </div>
  );
}

export function Settings() {
  const { settings, setSettings, reload, select } = useStore();
  const [confirm, setConfirm] = useState(false);
  return (
    <section className="settings" aria-labelledby="set-title">
      <h2 id="set-title" className="section-title">설정</h2>
      <label className="toggle">
        <input type="checkbox" checked={!!settings.large} onChange={(e) => setSettings({ ...settings, large: e.target.checked })} />
        <span><span className="t">글자 크게</span><br /><span className="d">화면 전체의 글자와 버튼을 조금 더 크게 보여 줍니다.</span></span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={settings.voice} onChange={(e) => setSettings({ ...settings, voice: e.target.checked })} />
        <span><span className="t">민디가 소리 내어 읽기</span><br /><span className="d">이 기기에 들어 있는 한국어 음성으로 읽습니다. 소리는 밖으로 보내지 않습니다.</span></span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={settings.tone} onChange={(e) => setSettings({ ...settings, tone: e.target.checked })} />
        <span><span className="t">민디 말투 다듬기</span><br /><span className="d">판정 문장 한두 줄만 외부 언어 모델로 보내 말투를 다듬습니다. 메모 원문과 사진은 보내지 않습니다. 숫자나 날짜가 바뀌면 원래 문장을 씁니다.</span></span>
      </label>
      <KakaoMe />
      <LabelsBackup />
      <ExportV6 />
      <hr className="divider" />
      <div>
        <p className="h3">내 기록 모두 지우기</p>
        <p className="small muted">이 브라우저에 저장된 판정 결과, 메모, 사진 미리보기, 붙인 이름을 전부 지웁니다. 원래 파일은 그대로 남습니다.</p>
        {!confirm ? (
          <button className="btn danger" style={{ marginTop: 10 }} onClick={() => setConfirm(true)}><IconTrash />모두 지우기</button>
        ) : (
          <div className="label-row">
            <button className="btn danger" onClick={async () => { await wipeAll(); select(undefined); setConfirm(false); await reload(); }}>정말 지웁니다</button>
            <button className="btn quiet" onClick={() => setConfirm(false)}>그만두기</button>
          </div>
        )}
      </div>
    </section>
  );
}
