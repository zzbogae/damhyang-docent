// 기록 가져오기: 파일·폴더를 고르면 이 브라우저 안에서만 읽고, 판정까지 이어서 한다.
import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { importAndJudge, importV6File, runFixture, runSample } from '../pipeline';
import { IconFile, IconFolder } from './Icons';
import { CHANNEL_LABEL, type Channel } from '../types';

const GUIDE: { title: string; steps: string[] }[] = [
  { title: '구글 기록(유튜브·메모·캘린더·사진)', steps: [
    'takeout.google.com 에 들어가 "모두 선택 해제"를 누릅니다.',
    'YouTube 및 YouTube Music, Keep, 캘린더, Google 포토를 고릅니다. 유튜브는 "여러 형식"에서 기록을 JSON 으로 바꿉니다.',
    '"다음 단계"에서 파일 크기를 정하고 "내보내기 생성"을 누릅니다. 준비에 몇 시간에서 며칠이 걸릴 수 있습니다.',
    '메일로 온 링크에서 zip 파일을 모두 내려받습니다. 여러 개로 나뉘어 있으면 전부 같이 고릅니다.',
  ] },
  { title: '건강(아이폰 건강 앱 또는 삼성 헬스)', steps: [
    '아이폰: 건강 앱 → 오른쪽 위 내 사진 → "모든 건강 데이터 내보내기" → 만들어진 zip 을 컴퓨터로 옮깁니다.',
    '삼성 헬스: 설정 → "개인 데이터 다운로드" → 폴더 안의 csv 파일들을 고릅니다.',
  ] },
  { title: '카카오톡', steps: [
    '대화방 → 오른쪽 위 메뉴 → 설정(톱니바퀴) → "대화 내용 내보내기" → 텍스트만 보내기.',
    'PC 카카오톡은 대화방 메뉴의 "대화 내용 → 대화 내보내기"로 txt 를 저장합니다.',
  ] },
  { title: '인스타그램', steps: [
    '인스타그램 앱 → 설정 → 계정 센터 → "내 정보 및 권한" → "내 정보 다운로드"를 누릅니다.',
    '형식을 JSON 으로, 기간을 "전체 기간"으로 고르고 요청합니다. 준비가 끝나면 받은 zip 파일을 고릅니다.',
    '올린 글·사진과 DM 원문은 저장하지 않고, 올린 날짜와 내가 보낸 DM 의 개수·시각만 셉니다.',
  ] },
  { title: 'AI 대화(ChatGPT·Claude)', steps: [
    'ChatGPT: 설정 → 데이터 제어 → "데이터 내보내기"를 누르고, 메일로 온 zip 파일을 고릅니다.',
    'Claude: 설정 → 개인정보 → "데이터 내보내기"를 누르고, 메일로 온 zip 파일을 고릅니다.',
    '대화 원문은 저장하지 않고, 내가 보낸 메시지의 개수·시각·글자 수만 셉니다.',
  ] },
  { title: '사진', steps: ['사진이 들어 있는 폴더를 "사진 폴더 고르기"로 고릅니다. 사진은 복사하지 않고, 찍은 날짜만 읽습니다.'] },
];

export function ImportPanel({ onDone, onEval }: { onDone?: () => void; onEval?: () => void }) {
  const { setPhase, progress, setProgress, reload, error, setError, phase } = useStore();
  const [files, setFiles] = useState<File[]>([]);
  const [folder, setFolder] = useState<(File | { file: File; path?: string })[]>([]);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);
  const v6Ref = useRef<HTMLInputElement>(null);
  const busy = phase === 'working';

  async function run(fn: () => Promise<unknown>) {
    setError(undefined);
    setPhase('working');
    try {
      await fn();
      setProgress(undefined);
      await reload();
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('empty');
    }
  }

  const stage = (s: string) => setProgress({ ...(progress ?? {}), stage: s });

  return (
    <div className="importer">
      <h1>기록을 가져옵니다</h1>
      <p className="promise-big">이미 있는 기록만 씁니다. 파일은 이 브라우저 안에서만 읽고, 어디에도 보내지 않습니다.</p>
      <div
        className={`drop${over ? ' over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); setFiles((f) => [...f, ...Array.from(e.dataTransfer.files)]); }}
      >
        <p>구글 Takeout zip, 건강 내보내기, 카카오톡 txt, 인스타그램·AI 대화 내보내기 zip 을 여기에 끌어다 놓거나 골라 주세요.</p>
        <div className="row">
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}><IconFile />파일 고르기</button>
          <button className="btn" disabled={busy} onClick={async () => {
            const { canPersistFolder, pickPhotoFolder } = await import('../importBridge');
            if (!canPersistFolder()) { dirRef.current?.click(); return; }
            try {
              const picked = await pickPhotoFolder();
              if (picked) setFolder(picked);
            } catch { /* 사용자가 고르기를 그만둠 */ }
          }}><IconFolder />사진 폴더 고르기</button>
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])])} />
          <input ref={dirRef} type="file" hidden multiple {...({ webkitdirectory: '' } as any)} onChange={(e) => setFolder(Array.from(e.target.files ?? []))} />
        </div>
        {(files.length > 0 || folder.length > 0) && (
          <ul className="filelist" aria-label="고른 파일">
            {files.map((f, i) => <li key={i}>{f.name} · {(f.size / 1048576).toFixed(1)}MB</li>)}
            {folder.length > 0 && <li>사진 폴더: 파일 {folder.length.toLocaleString()}개</li>}
          </ul>
        )}
        <div className="row">
          <button
            className="btn primary"
            disabled={busy || (!files.length && !folder.length)}
            onClick={() => run(() => importAndJudge(files, folder, (p) => setProgress(p)))}
          >
            {busy ? '가져오는 중' : '가져와서 판정하기'}
          </button>
          <button className="btn quiet" disabled={busy} onClick={() => run(() => runSample((p) => setProgress(p)))}>가짜 샘플 기록으로 먼저 보기</button>
          <button className="btn quiet" disabled={busy} onClick={() => v6Ref.current?.click()}>팀 v6 판정 JSON 불러오기</button>
          <input ref={v6Ref} type="file" accept=".json,application/json" hidden aria-label="팀 v6 판정 JSON"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) run(() => importV6File(f)); e.target.value = ''; }} />
          {(import.meta.env.DEV || location.search.includes('dev')) && <button className="btn quiet" disabled={busy} onClick={() => run(() => runFixture(stage))}>합성 판정 입력(개발용)</button>}
        </div>
        {busy && progress && (
          <div className="progress-rows" aria-live="polite">
            <p><b>{progress.stage}</b>{progress.detail ? ` · ${progress.detail}` : ''}</p>
            {progress.channels && Object.entries(progress.channels).map(([ch, v]) => (
              <div className="pr" key={ch}>
                <span>{CHANNEL_LABEL[ch as Channel] ?? ch}</span>
                <div className="bar"><i style={{ width: v.records ? '100%' : '15%' }} /></div>
                <span className="muted">파일 {v.files} · {v.records.toLocaleString()}건</span>
              </div>
            ))}
          </div>
        )}
        {error && <p className="err" role="alert">가져오지 못했습니다: {error}</p>}
      </div>
      {onEval && (
        <p className="eval-invite">평가에 참여하시나요? 판정 결과를 보기 전에 날짜가 확실한 일부터 적어 주세요. <button className="linkish" onClick={onEval}>사건 먼저 적기</button></p>
      )}
      <section className="guide" aria-label="내보내는 방법">
        <h2 className="section-title">기록을 내보내는 방법</h2>
        {GUIDE.map((g) => (
          <details key={g.title}>
            <summary>{g.title}</summary>
            <ol>{g.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </details>
        ))}
      </section>
    </div>
  );
}
