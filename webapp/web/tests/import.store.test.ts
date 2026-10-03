// 가져오기 결과 저장(db.saveImport)과 사진 레지스트리(getPhotoBlob)를 노드에서 확인한다.
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { db, getKV, saveImport } from '../src/db';
import { runImport } from '../src/import/importer';
import { clearRegistry, getPhotoBlob, hasPhotoSource, registerInputs } from '../src/import/photoRegistry';
import type { SampleManifest } from '../src/import/sample';
import type { ImportInput } from '../src/import/sources';
import { ensureSynth, exportInputs } from './helpers/synth';

const DIR = path.resolve(__dirname, '../public/sample');

function sampleInputs(): ImportInput[] {
  const manifest: SampleManifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  return manifest.files.map((f) => ({
    file: new File([fs.readFileSync(path.join(DIR, decodeURIComponent(f.url)))], f.name, { type: f.type }),
    path: f.path,
  }));
}

describe('저장과 사진 레지스트리', () => {
  it('saveImport 가 일 단위 표·메모·사진·메타를 IndexedDB 에 넣는다', async () => {
    const r = await runImport(sampleInputs());
    await saveImport(r.daily, r.meta, r.memos, r.photos);
    expect(await db.daily.count()).toBe(r.daily.length);
    expect(await db.memos.count()).toBe(r.memos.length);
    expect(await db.photos.count()).toBe(r.photos.length);
    expect(await db.memos.where('week').equals(r.memos[0].week).count()).toBeGreaterThan(0);
    expect((await getKV<any>('meta')).export_date).toBe('2026-09-01');
  }, 120000);

  it('zip 안 사진과 폴더 사진을 경로로 다시 찾는다', async () => {
    clearRegistry();
    const sample = sampleInputs();
    registerInputs(sample);
    const r = await runImport(sample);
    const p = r.photos[0];
    expect(hasPhotoSource(p.path)).toBe(true);
    const b = await getPhotoBlob(p.path);
    expect(b?.size).toBe(p.size);
    expect(b?.type).toBe(p.mime);

    ensureSynth('short');
    clearRegistry();
    const folder = exportInputs('short').filter((i) => i.path?.startsWith('photos/'));
    registerInputs(folder);
    const one = folder.find((i) => i.path!.endsWith('.JPG'))!;
    expect((await getPhotoBlob(one.path!))?.size).toBe(one.file.size);
    expect(await getPhotoBlob('없는/경로.jpg')).toBeUndefined();
  }, 120000);
});
