// 가져오기 워커. 화면이 멈추지 않도록 파일 읽기·집계를 여기서 한다.
// 사용: const api = Comlink.wrap<ImportWorkerApi>(new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' }))
import * as Comlink from 'comlink';
import { saveImport } from '../db';
import { type ImportInput, type ImportOptions, type ImportProgress, runImport } from './importer';

export interface ImportSummary {
  days: number;
  memos: number;
  photos: number;
  channels: Record<string, { first: string; last: string; records: number }>;
  kakaoParticipants: { name: string; messages: number; files: number }[];
  kakaoMe?: string;
  files: Record<string, number>;
  skipped: number;
  warnings: string[];
}

const api = {
  async run(inputs: ImportInput[], opts: ImportOptions = {}, onProgress?: (p: ImportProgress) => void): Promise<ImportSummary> {
    const r = await runImport(inputs, opts, onProgress);
    await saveImport(r.daily, r.meta, r.memos, r.photos);
    const channels: ImportSummary['channels'] = {};
    for (const [k, v] of Object.entries(r.meta.channels)) if (v) channels[k] = { first: v.first, last: v.last, records: v.records };
    return {
      days: r.daily.length,
      memos: r.memos.length,
      photos: r.photos.length,
      channels,
      kakaoParticipants: r.kakaoParticipants,
      kakaoMe: r.kakaoMe,
      files: r.files as Record<string, number>,
      skipped: r.skipped,
      warnings: r.warnings,
    };
  },
};

export type ImportWorkerApi = typeof api;
Comlink.expose(api);
