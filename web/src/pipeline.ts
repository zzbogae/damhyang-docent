// 가져오기 → 메모 필터 → 저장 → 판정(Pyodide 워커) → 저장. 모든 단계가 이 브라우저 안에서 끝난다.
import * as Comlink from 'comlink';
import { saveImport, saveResult } from './db';
import { scanMemo, toMemoFlags } from './filter/memoFilter';
import type { JudgeAPI } from './judge/judge.worker';
import type { DailyMeta, DailyRow, MemoRecord, MinedResult, PhotoRecord } from './types';

let judgeWorker: Comlink.Remote<JudgeAPI> | null = null;
export function judgeApi(): Comlink.Remote<JudgeAPI> {
  if (!judgeWorker) {
    const w = new Worker(new URL('./judge/judge.worker.ts', import.meta.url), { type: 'module' });
    judgeWorker = Comlink.wrap<JudgeAPI>(w);
  }
  return judgeWorker;
}

export interface Imported { daily: DailyRow[]; meta: DailyMeta; memos: MemoRecord[]; photos: PhotoRecord[]; saved?: boolean }

export async function judgeAndSave(imp: Imported, onStage: (s: string) => void, config: Record<string, unknown> = {}): Promise<MinedResult> {
  onStage('메모에서 비밀번호·위기 표현 확인 중');
  const memos = imp.memos.map((m) => ({ ...m, flags: m.flags ?? toMemoFlags(scanMemo(m.text)) }));
  if (imp.saved) {
    // 가져오기 워커가 이미 저장했으면 메모 표시만 갱신한다(사진 색인 2만 건을 다시 쓰지 않음)
    const { db } = await import('./db');
    await db.memos.bulkPut(memos);
  } else {
    await saveImport(imp.daily, imp.meta, memos, imp.photos);
  }
  const api = judgeApi();
  const { json, ms } = await api.judge(JSON.stringify(imp.daily), JSON.stringify(imp.meta), JSON.stringify(config), Comlink.proxy(onStage));
  const result = JSON.parse(json) as MinedResult;
  (result.summary as any).judge_ms = ms;
  await saveResult(result);
  return result;
}

/** 개발용: 합성 판정 입력(public/dev/fixture.json)으로 전 과정을 돌린다. */
export async function runFixture(onStage: (s: string) => void) {
  onStage('합성 기록 불러오는 중');
  const r = await fetch(import.meta.env.BASE_URL + 'dev/fixture.json');
  const imp = (await r.json()) as Imported;
  return judgeAndSave(imp, onStage);
}

import type { Progress } from './state/store';

/** 사용자가 고른 파일·사진 폴더 → 가져오기 워커 → 판정. (가져오기 모듈 연결 지점) */
export async function importAndJudge(files: File[], folder: (File | { file: File; path?: string })[], onProgress: (p: Progress) => void): Promise<MinedResult> {
  // 가져오는 동안 Python 런타임을 미리 띄워 둔다(판정 대기 시간과 겹치게)
  judgeApi().warmup().catch(() => undefined);
  const { importViaWorker } = await import('./importBridge');
  const imp = await importViaWorker(files, folder, onProgress);
  return judgeAndSave(imp, (s) => onProgress({ stage: s }));
}

/** 가짜 샘플 원천 파일(public/sample)로 전 과정을 돌린다. */
export async function runSample(onProgress: (p: Progress) => void): Promise<MinedResult> {
  judgeApi().warmup().catch(() => undefined);
  const { importSampleViaWorker } = await import('./importBridge');
  const imp = await importSampleViaWorker(onProgress);
  return judgeAndSave(imp, (s) => onProgress({ stage: s }));
}

/** 카카오톡에서 "나"를 바꿔 같은 파일로 다시 가져오고 판정한다(같은 세션에서만). */
export async function rerunKakaoMe(name: string, onProgress: (p: Progress) => void): Promise<MinedResult> {
  const { reimportWithKakaoMe } = await import('./importBridge');
  const imp = await reimportWithKakaoMe(name, onProgress);
  return judgeAndSave(imp, (s) => onProgress({ stage: s }));
}

/** 실제 기록 평가: 저장된 일 단위 표와 봉인한 사건으로 숫자 보고서를 계산한다(Pyodide 워커). */
export async function computeFieldReport(events: { start: string; end?: string; kind: string }[], quick: boolean,
  onStage: (s: string) => void): Promise<{ report: Record<string, unknown>; ms: number }> {
  const { db, getKV } = await import('./db');
  const [daily, meta] = await Promise.all([db.daily.toArray(), getKV<DailyMeta>('meta')]);
  if (!daily.length || !meta) throw new Error('일 단위 기록이 없습니다. 팀 v6 JSON 으로 불러온 결과에서는 평가를 계산할 수 없습니다.');
  const { json, ms } = await judgeApi().fieldReport(
    JSON.stringify(daily), JSON.stringify(meta),
    JSON.stringify(events.map(({ start, end, kind }) => ({ start, end, kind }))),
    JSON.stringify({ quick }), Comlink.proxy(onStage),
  );
  return { report: JSON.parse(json), ms };
}

/** 팀 v6 판정 JSON(원페이지 sample_data.json 형식)을 판정 없이 그대로 불러온다. */
export async function importV6File(file: File): Promise<MinedResult> {
  const { fromV6, isV6 } = await import('./bridge/v6');
  const j = JSON.parse(await file.text());
  if (!isV6(j)) throw new Error('팀 v6 판정 JSON 이 아닙니다');
  const { result, memos } = fromV6(j);
  const { saveImport } = await import('./db');
  await saveImport([], { tz: 'Asia/Seoul', night_hours: [0, 5], channels: {} }, memos.map((m) => ({ ...m, flags: toMemoFlags(scanMemo(m.text)) })), []);
  await saveResult(result);
  return result;
}
