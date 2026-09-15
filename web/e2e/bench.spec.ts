// 사진 2만 장 폴더를 브라우저에서 가져와 판정까지 걸리는 시간(BENCH=1 일 때만). 작은 JPEG 라 파일 읽기(I/O) 비용은 빠진다.
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test.skip(process.env.BENCH !== '1', 'BENCH=1 일 때만');

test('사진 2만 장 폴더 가져오기', async ({ page }) => {
  test.setTimeout(900000);
  const N = Number(process.env.N ?? 20000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mined-photos-'));
  const root = path.join(dir, '사진');
  const tpl = fs.readFileSync(path.join(import.meta.dirname, '../tests/helpers/exif_template.jpg'));
  const at = tpl.indexOf(Buffer.from('2000:01:01 00:00:00'));
  const t0 = Date.UTC(2010, 0, 1);
  for (let i = 0; i < N; i++) {
    const sub = path.join(root, String(Math.floor(i / 1000)));
    if (i % 1000 === 0) fs.mkdirSync(sub, { recursive: true });
    const d = new Date(t0 + i * 6.5 * 3600 * 1000);
    const s = `${d.getUTCFullYear()}:${String(d.getUTCMonth() + 1).padStart(2, '0')}:${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:00`;
    const b = Buffer.from(tpl); b.write(s, at, 'ascii');
    fs.writeFileSync(path.join(sub, `IMG_${i}.jpg`), b);
  }
  await page.goto('/');
  const input = page.locator('input[webkitdirectory]');
  const tSel = Date.now();
  await input.setInputFiles(root);
  const selMs = Date.now() - tSel;
  await expect(page.getByText(/사진 폴더: 파일/)).toBeVisible({ timeout: 120000 });
  const t = Date.now();
  await page.getByRole('button', { name: '가져와서 판정하기' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 600000 });
  const ms = Date.now() - t;
  console.log(`브라우저: 사진 ${N}장 폴더 선택 전달 ${selMs}ms, 가져오기+판정 ${ms}ms`);
  fs.rmSync(dir, { recursive: true, force: true });
});
