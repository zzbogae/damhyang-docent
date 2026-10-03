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
      <p className="small muted">광물이 나온 주를 팀 원페이지 형식(sample_data.json 과 같은 모양)으로 내려받습니다. 그때 쓴 글 원문이 들어가므로 다른 사람에게 보내지 마세요. 비밀번호처럼 보이는 메모와 위기 표현이 담긴 메모는 넣지 않습니다.</p>
      <button className="btn" style={{ marginTop: 10 }} onClick={download}>v6 JSON 내려받기</button>
    </div>
  );
}

function LabelsBackup() {
  const { reload } = useStore();
  const [msg, setMsg] = useState('');
  return (
    <div>
      <p className="h3">이름·편지 백업</p>
      <p className="small muted">주에 붙인 이름, 받침대에 둔 편지, 더한 스크린타임·커밋 수를 파일로 내보내고 다시 가져옵니다. 기록 원문과 사진은 들어가지 않지만 <b>편지 내용은 들어갑니다</b>. 다른 브라우저로 옮기거나 「모두 지우기」 전에 씁니다.</p>
      <div className="label-row">
        <button className="btn" onClick={async () => {
          const { exportLabels } = await import('../backup/labels');
          const j = await exportLabels();
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([JSON.stringify(j, null, 1)], { type: 'application/json' }));
          a.download = `mined_labels_${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          setMsg(`이름 ${j.labels.length}개, 편지 ${j.letters?.length ?? 0}통을 내보냈습니다.`);
        }}>백업 내보내기</button>
        <label className="btn">
          백업 가져오기
          <input type="file" accept=".json,application/json" hidden aria-label="Mine D 백업 파일" onChange={async (e) => {
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
        <input type="checkbox" checked={!!settings.screenRead} onChange={(e) => setSettings({ ...settings, screenRead: e.target.checked })} />
        <span><span className="t">화면 읽기</span><br /><span className="d">주 화면의 문장 옆에 「화면 읽기」 버튼을 둡니다. 이 기기에 들어 있는 한국어 음성으로 읽고, 소리는 밖으로 보내지 않습니다.</span></span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={!!settings.subtitleEn} onChange={(e) => setSettings({ ...settings, subtitleEn: e.target.checked })} />
        <span><span className="t">영어 자막 (English subtitles)</span><br /><span className="d">주 문장과 민디의 답 아래에 영어 문장을 함께 보여 줍니다. 그때 쓴 글은 번역하지 않습니다.</span></span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={!!settings.sound} onChange={(e) => setSettings({ ...settings, sound: e.target.checked })} />
        <span><span className="t">민디 소리</span><br /><span className="d">민디가 찾았을 때·기다릴 때·기록을 열 때 짧은 소리를 냅니다. 말이 아니고, 그 주의 내용에 따라 달라지지 않습니다.</span></span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={settings.tone} onChange={(e) => setSettings({ ...settings, tone: e.target.checked })} />
        <span><span className="t">민디 말투 다듬기</span><br /><span className="d">주 문장 한두 줄만 외부 언어 모델로 보내 말투를 다듬습니다. 메모 원문과 사진은 보내지 않습니다. 숫자나 날짜가 바뀌면 원래 문장을 씁니다.</span></span>
      </label>
      <div>
        <p className="h3">연구 참여</p>
        <p className="small muted">팀이 Mine D 를 다듬으려고 하는 평가입니다. 날짜가 확실한 일을 먼저 적고, 기억에 남는 주였는지 답한 뒤, 숫자만 담긴 보고서를 멘토에게 보냅니다. 참여하지 않아도 앱을 쓰는 데는 아무 차이가 없습니다.</p>
        <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent('mined:open-eval'))}>연구 참여 화면 열기</button>
      </div>
      <KakaoMe />
      <LabelsBackup />
      <ExportV6 />
      <hr className="divider" />
      <div>
        <p className="h3">내 기록 모두 지우기</p>
        <p className="small muted">이 브라우저에 저장된 계산 결과, 메모, 사진 미리보기, 붙인 이름을 전부 지웁니다. 원래 파일은 그대로 남습니다.</p>
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
