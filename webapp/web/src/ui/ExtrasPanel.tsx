// 기록 더하기: 스크린타임 캡처(기기 안 OCR)와 git log 커밋 수. 다시 가져오기를 해도 남고, 저장하면 저장된 기록으로 다시 판정한다.
import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { loadExtras, saveExtras, type Extras, type ScreenEntry } from '../extras/extras';
import { dateFromName, readScreenTime } from '../import/screentime';

const today = (ms: number) => { const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const shift = (iso: string, k: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`);

export function ExtrasPanel() {
  const { reload, setPhase, phase, result } = useStore();
  const [ex, setEx] = useState<Extras>({ screen: [], git: [] });
  const [draft, setDraft] = useState<ScreenEntry[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [reading, setReading] = useState(false);
  useEffect(() => { loadExtras().then(setEx); }, []);

  async function readShots(files: File[]) {
    setReading(true); setMsg(''); setFailed([]);
    const { readImageText } = await import('../ocr/ocr');
    const got: ScreenEntry[] = [], bad: string[] = [];
    for (const f of files) {
      try {
        const r = readScreenTime(await readImageText(f));
        if (!r) { bad.push(f.name); continue; }
        const date = shift(dateFromName(f.name) ?? today(f.lastModified), r.offsetDays);
        got.push({ id: `${f.name}-${f.lastModified}`, date, minutes: r.minutes, kind: r.kind, file: f.name });
      } catch { bad.push(f.name); }
    }
    setDraft(got); setFailed(bad); setReading(false);
  }

  async function readGit(f: File) {
    const { parseGitLog, commitsByDate } = await import('../import/parsers/git');
    const by = commitsByDate(parseGitLog(await f.text()));
    if (!by.size) { setMsg('커밋 날짜를 찾지 못했습니다. 안내의 명령으로 만든 파일인지 확인해 주세요.'); return; }
    const git = [...by.entries()].map(([date, n]) => ({ date, n })).sort((a, b) => a.date.localeCompare(b.date));
    await commit({ ...ex, git }, `커밋 ${git.reduce((a, g) => a + g.n, 0)}개(${git[0].date} ~ ${git[git.length - 1].date})를 더했습니다.`);
  }

  async function commit(next: Extras, done: string) {
    setEx(next);
    await saveExtras(next);
    setMsg(done);
    if (!result) return;
    setPhase('working');
    const { rejudgeStored } = await import('../pipeline');
    try { await rejudgeStored(() => undefined); } finally { await reload(); }
  }

  const edit = (id: string, p: Partial<ScreenEntry>) => setDraft(draft.map((d) => (d.id === id ? { ...d, ...p } : d)));
  return (
    <section className="extras stack" aria-labelledby="extras-title">
      <h2 id="extras-title" className="section-title">기록 더하기</h2>
      <div>
        <p className="h3">스크린타임 캡처</p>
        <p className="small muted">아이폰 「스크린 타임」이나 삼성 「디지털 웰빙」 화면을 캡처해 넣어 주세요. 이 기기 안에서 글자를 읽어 사용 시간만 남기고, 이미지는 저장하지 않습니다.</p>
        <label className="btn">
          캡처 고르기
          <input type="file" accept="image/*" multiple hidden aria-label="스크린타임 캡처" disabled={reading || phase === 'working'}
            onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) readShots(fs); e.target.value = ''; }} />
        </label>
        {reading && <p className="small" role="status">캡처에서 글자를 읽는 중입니다.</p>}
        {draft.length > 0 && (
          <div className="stack" style={{ marginTop: 8 }}>
            <p className="small muted">읽은 값을 확인해 주세요. 날짜와 시간은 고칠 수 있습니다.</p>
            {draft.map((d) => (
              <div className="label-row" key={d.id}>
                <span className="small">{d.file}</span>
                <input className="input" type="date" value={d.date} aria-label={`${d.file} 날짜`} onChange={(e) => edit(d.id, { date: e.target.value })} />
                <input className="input" type="number" min={0} max={1440} value={d.minutes} aria-label={`${d.file} 분`} onChange={(e) => edit(d.id, { minutes: Math.max(0, Math.min(1440, +e.target.value || 0)) })} />
                <span className="small">분({hm(d.minutes)})</span>
                <select className="select" value={d.kind} aria-label={`${d.file} 종류`} onChange={(e) => edit(d.id, { kind: e.target.value as ScreenEntry['kind'] })}>
                  <option value="day">그날 값</option>
                  <option value="week_avg">그 주 하루 평균</option>
                </select>
                <button className="btn quiet" onClick={() => setDraft(draft.filter((x) => x.id !== d.id))}>빼기</button>
              </div>
            ))}
            <div><button className="btn primary" disabled={phase === 'working'} onClick={async () => {
              const keep = ex.screen.filter((s) => !draft.some((d) => d.date === s.date && d.kind === s.kind));
              const n = draft.length;
              setDraft([]);
              await commit({ ...ex, screen: [...keep, ...draft] }, `스크린타임 ${n}개를 더했습니다.`);
            }}>저장하고 다시 계산</button></div>
          </div>
        )}
        {failed.length > 0 && <p className="small err">사용 시간을 찾지 못한 캡처: {failed.join(', ')}</p>}
        {ex.screen.length > 0 && <p className="small muted">저장된 스크린타임 {ex.screen.length}개 <button className="linkish" onClick={() => commit({ ...ex, screen: [] }, '스크린타임을 모두 지웠습니다.')}>모두 지우기</button></p>}
      </div>
      <div>
        <p className="h3">깃 커밋 기록</p>
        <p className="small muted">자기 저장소 폴더에서 아래 명령으로 만든 파일을 넣어 주세요. 커밋 메시지는 읽지 않고 날짜만 셉니다.</p>
        <code className="small">git log --author="$(git config user.email)" --date=iso-strict --pretty=format:%ad &gt; mined_git.txt</code>
        <div style={{ marginTop: 6 }}>
          <label className="btn">
            파일 고르기
            <input type="file" accept=".txt,text/plain" hidden aria-label="깃 커밋 기록" disabled={phase === 'working'}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) readGit(f); e.target.value = ''; }} />
          </label>
          {ex.git.length > 0 && <span className="small muted"> 저장된 커밋 {ex.git.reduce((a, g) => a + g.n, 0)}개 <button className="linkish" onClick={() => commit({ ...ex, git: [] }, '커밋 기록을 지웠습니다.')}>지우기</button></span>}
        </div>
      </div>
      {msg && <p className="small" role="status">{msg}</p>}
    </section>
  );
}
