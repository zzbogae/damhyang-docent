// 사진 2만 장 규모 가져오기 속도(BENCH=1 일 때만). EXIF 날짜 자리만 바꾼 작은 JPEG 로 EXIF 읽기·색인 비용을 잰다.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { runImport } from '../src/import/importer';

const bench = process.env.BENCH === '1';
const N = Number(process.env.N ?? 20000);

describe.skipIf(!bench)('사진 2만 장 가져오기', () => {
  it(`사진 ${N}장`, async () => {
    const tpl = fs.readFileSync(path.join(__dirname, 'helpers/exif_template.jpg'));
    const at = tpl.indexOf(Buffer.from('2000:01:01 00:00:00'));
    const inputs = [];
    const t0 = Date.UTC(2010, 0, 1);
    for (let i = 0; i < N; i++) {
      const d = new Date(t0 + i * 6.5 * 3600 * 1000);
      const s = `${d.getUTCFullYear()}:${String(d.getUTCMonth() + 1).padStart(2, '0')}:${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:00`;
      const b = Buffer.from(tpl);
      b.write(s, at, 'ascii');
      inputs.push({ file: new File([b], `IMG_${i}.jpg`, { type: 'image/jpeg' }), path: `사진/${Math.floor(i / 1000)}/IMG_${i}.jpg` });
    }
    const t = performance.now();
    const r = await runImport(inputs, {});
    const ms = performance.now() - t;
    console.log(`사진 ${N}장 가져오기 ${Math.round(ms)}ms (장당 ${(ms / N).toFixed(2)}ms), 색인 ${r.photos.length}장`);
    expect(r.photos.length).toBe(N);
  }, 600000);
});
