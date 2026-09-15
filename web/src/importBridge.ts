// 가져오기 모듈(src/import/)과 앱 사이의 다리.
// 파일 읽기·집계는 가져오기 워커가 하고 결과를 IndexedDB 에 저장한다. 사진 원본 레지스트리는 메인 스레드에 둔다.
import * as Comlink from 'comlink';
import { db, getKV } from './db';
import { getPhotoBlob, loadSampleInputs, registerInputs, type ImportInput, type ImportProgress, type ImportWorkerApi } from './import';
export { canPersistFolder, pickPhotoFolder, hasPersistedPhotoFolder, reconnectPhotoFolder } from './import';
import type { Imported } from './pipeline';
import type { Progress } from './state/store';
import type { DailyMeta } from './types';

export { getPhotoBlob };

let worker: Comlink.Remote<ImportWorkerApi> | null = null;
function api() {
  if (!worker) worker = Comlink.wrap<ImportWorkerApi>(new Worker(new URL('./import/import.worker.ts', import.meta.url), { type: 'module' }));
  return worker;
}

const PHASE: Record<ImportProgress['phase'], string> = { scan: '파일 살펴보는 중', read: '기록 읽는 중', photos: '사진 날짜 읽는 중', done: '가져오기 끝' };

function toProgress(p: ImportProgress): Progress {
  const channels: Progress['channels'] = {};
  for (const [ch, n] of Object.entries(p.records)) channels[ch] = { files: 0, records: n ?? 0 };
  return { stage: PHASE[p.phase], detail: `파일 ${p.filesDone}/${p.filesTotal}${p.file ? ` · ${p.file.split('::').pop()}` : ''}`, channels };
}

let lastInputs: ImportInput[] | null = null;
/** 이 세션에서 고른 파일이 남아 있는지(카카오톡 "나"를 바꿔 다시 가져올 수 있는지) */
export function canReimport() { return !!lastInputs; }
export async function reimportWithKakaoMe(name: string, onProgress: (p: Progress) => void): Promise<Imported> {
  if (!lastInputs) throw new Error('파일을 다시 골라야 합니다');
  return runInputs(lastInputs, onProgress, name);
}

async function runInputs(inputs: ImportInput[], onProgress: (p: Progress) => void, kakaoMe?: string): Promise<Imported> {
  lastInputs = inputs;
  registerInputs(inputs);
  const summary = await api().run(inputs, { kakaoMe }, Comlink.proxy((p: ImportProgress) => onProgress(toProgress(p))));
  if (!summary.days) throw new Error('읽을 수 있는 기록을 찾지 못했습니다. 내보내는 방법을 확인해 주세요.');
  const [daily, meta, memos] = await Promise.all([db.daily.toArray(), getKV<DailyMeta>('meta'), db.memos.toArray()]);
  await db.kv.put({ key: 'import_summary', value: summary });
  return { daily, meta: meta!, memos, photos: [], saved: true };
}

export async function importViaWorker(files: File[], folder: (File | ImportInput)[], onProgress: (p: Progress) => void): Promise<Imported> {
  const inputs: ImportInput[] = [
    ...files.map((file) => ({ file })),
    ...folder.map((f) => (f instanceof File ? { file: f, path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name } : f)),
  ];
  return runInputs(inputs, onProgress);
}

export async function importSampleViaWorker(onProgress: (p: Progress) => void): Promise<Imported> {
  onProgress({ stage: '가짜 샘플 기록 받는 중' });
  const { inputs } = await loadSampleInputs();
  return runInputs(inputs, onProgress);
}
