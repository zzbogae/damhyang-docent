// 비슷한 사진 묶기 시험: 실제 Chromium 에서 시험셋 사진과 그 변형으로 묶기 재현율과 잘못 묶는 비율을 잰다.
// 실행: cd web && npx playwright test -c playwright.lab.config.ts similar
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const LAB = path.resolve(import.meta.dirname, '../lab');
const TS = path.join(LAB, 'testset');
const NEAR = 14; // 같은 날 60분 안(src/photos/similar.ts 기본값)
const SAME = 4; // 시각이 멀 때
const COLOR = 28;

test('변형은 원본과 묶이고, 서로 다른 사진은 거의 묶이지 않는다', async ({ page }) => {
  const files = fs.readdirSync(TS).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort().map((f) => path.join(TS, f));
  await page.goto('/lab/similar.html');
  await page.setInputFiles('#files', files);
  const { rows, pairs } = await page.evaluate(() => window.__similarRun());
  const kinds = Object.keys(rows[0].variants);
  const recall: Record<string, number> = {};
  for (const k of kinds) {
    recall[k] = rows.filter((r: any) => r.variants[k].ham <= NEAR && r.variants[k].color <= COLOR).length / rows.length;
  }
  const falseNear = pairs.filter((p: any) => p.ham <= NEAR && p.color <= COLOR);
  const falseSame = pairs.filter((p: any) => p.ham <= SAME && p.color <= COLOR);
  const hamDist = (xs: number[]) => ({ min: Math.min(...xs), p10: xs.sort((a, b) => a - b)[Math.floor(xs.length * 0.1)], median: xs[Math.floor(xs.length / 2)] });
  const report = {
    n_images: rows.length, n_pairs: pairs.length, thresholds: { near: NEAR, same: SAME, color: COLOR },
    recall_near: recall,
    variant_hamming_max: Object.fromEntries(kinds.map((k) => [k, Math.max(...rows.map((r: any) => r.variants[k].ham))])),
    distinct_pairs_hamming: hamDist(pairs.map((p: any) => p.ham)),
    false_merge_near: { n: falseNear.length, rate: falseNear.length / pairs.length, pairs: falseNear.map((p: any) => `${p.a} ~ ${p.b} (${p.ham}, 색 ${p.color})`) },
    false_merge_same: { n: falseSame.length, rate: falseSame.length / pairs.length },
  };
  // 기준값을 바꿔 가며: 변형 재현율(평균)과 서로 다른 사진이 묶이는 쌍 수
  (report as any).sweep = [8, 10, 12, 14, 16, 18].map((t) => ({
    near: t,
    recall_mean: kinds.reduce((a, k) => a + rows.filter((r: any) => r.variants[k].ham <= t && r.variants[k].color <= COLOR).length / rows.length, 0) / kinds.length,
    false_pairs: pairs.filter((p: any) => p.ham <= t && p.color <= COLOR).length,
    pairs: pairs.filter((p: any) => p.ham <= t && p.color <= COLOR && p.ham > NEAR).map((p: any) => `${p.a} ~ ${p.b} (${p.ham})`),
  }));
  fs.writeFileSync(path.join(LAB, 'similar_report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
  expect(rows.length).toBeGreaterThan(20);
});
