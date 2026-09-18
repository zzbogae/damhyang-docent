// "샘플로 시작" 번들(web/public/sample)을 읽은 결과가 short 인물 정답과 같은지 본다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runImport } from '../src/import/importer';
import type { SampleManifest } from '../src/import/sample';
import { readJson } from './helpers/synth';

const DIR = path.resolve(__dirname, '../public/sample');

describe('샘플 번들', () => {
  it('5MB 이하이고, 읽은 일 단위 표가 정답과 같다', async () => {
    const manifest: SampleManifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
    const total = manifest.files.reduce((a, f) => a + f.size, 0);
    expect(total).toBeLessThanOrEqual(5 * 1024 * 1024);
    const inputs = manifest.files.map((f) => ({
      file: new File([fs.readFileSync(path.join(DIR, decodeURIComponent(f.url)))], f.name, { type: f.type }),
      path: f.path,
    }));
    const r = await runImport(inputs);
    const want = readJson(manifest.persona, 'truth_daily.json');
    expect(r.daily).toEqual(want);
    expect(r.meta.channels).toEqual(readJson(manifest.persona, 'truth_meta.json').channels);
    expect(r.photos.every((p) => p.path.startsWith('photos.zip::photos/'))).toBe(true);
  }, 120000);
});
