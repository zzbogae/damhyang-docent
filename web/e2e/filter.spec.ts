// 사진 안전 필터 시험: 실제 Chromium 에서 시험셋 전체를 필터에 넣고, 이미지별 결과와 재현율·정밀도·장당 시간을 기록한다.
// 실행: cd web && npx playwright test -c playwright.lab.config.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const LAB = path.resolve(import.meta.dirname, '../lab');
const TS = path.join(LAB, 'testset');

interface Label { file: string; hide: boolean; reason: string; source: string; note: string; hard: boolean }
interface Row {
  name: string; status: 'ok' | 'hidden' | 'error'; reasons: string[]; faces: number;
  faceBoxes: { score: number; model: 'short' | 'full' | 'tile'; w: number; h: number }[];
  textRatio: number | null; screenshot: boolean; ms: number; error?: string;
}

// 기준값을 바꿔 가며 판정을 다시 계산한다(모델은 한 번만 돌리고, 원점수로 다시 판정)
function decide(r: Row, textThr: number, faceThr: number, faceModel: 'short' | 'full' | 'both', tileThr = Infinity) {
  if (r.status === 'error') return { hide: true, reasons: ['error'] }; // 닫힌 쪽 실패
  if (r.screenshot) return { hide: true, reasons: ['screenshot'] };
  const reasons: string[] = [];
  if (r.textRatio !== null && r.textRatio >= textThr) reasons.push('text');
  const faces = r.faceBoxes.filter((b) =>
    b.model === 'tile' ? b.score >= tileThr : b.score >= faceThr && (faceModel === 'both' || b.model === faceModel));
  if (faces.length) reasons.push('face');
  return { hide: reasons.length > 0, reasons };
}

function metrics(rows: Row[], labels: Map<string, Label>, textThr: number, faceThr: number, faceModel: 'short' | 'full' | 'both', tileThr = Infinity) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  const misses: string[] = [], falseAlarms: string[] = [];
  for (const r of rows) {
    const l = labels.get(r.name)!;
    const d = decide(r, textThr, faceThr, faceModel, tileThr);
    if (l.hide && d.hide) tp++;
    else if (l.hide && !d.hide) { fn++; misses.push(r.name); }
    else if (!l.hide && d.hide) { fp++; falseAlarms.push(`${r.name}(${d.reasons.join(',')})`); }
    else tn++;
  }
  return {
    textThr, faceThr, faceModel, tileThr: Number.isFinite(tileThr) ? tileThr : 'off', tp, fp, fn, tn,
    recall: tp / (tp + fn), precision: tp + fp ? tp / (tp + fp) : 1,
    misses, falseAlarms,
  };
}

test('사진 안전 필터: 시험셋 재현율·정밀도·장당 시간', async ({ page }) => {
  const labels: Label[] = JSON.parse(fs.readFileSync(path.join(TS, 'labels.json'), 'utf8'));
  const byName = new Map(labels.map((l) => [l.file, l]));
  const logs: string[] = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto('/lab/filter.html');
  await page.setInputFiles('#files', labels.map((l) => path.join(TS, l.file)));
  await page.waitForFunction(() => (window as any).__filter?.done === true, null, { timeout: 540000 });
  const out = await page.evaluate(() => (window as any).__filter);
  const rows: Row[] = out.rows;
  expect(rows.length).toBe(labels.length);
  await page.screenshot({ path: path.join(LAB, 'filter_grid_lab.jpg'), type: 'jpeg', quality: 80, fullPage: true });

  // 기준값 훑기
  const sweep: ReturnType<typeof metrics>[] = [];
  for (const faceModel of ['short', 'full', 'both'] as const)
    for (const faceThr of [0.3, 0.4, 0.5, 0.6, 0.7])
      for (const tileThr of [Infinity, 0.5, 0.6, 0.7, 0.8])
        for (const textThr of [0.005, 0.01, 0.015, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1])
          sweep.push(metrics(rows, byName, textThr, faceThr, faceModel, tileThr));

  const chosen = {
    textThr: Number(process.env.TEXT_THR ?? 0.015), faceThr: Number(process.env.FACE_THR ?? 0.5),
    faceModel: (process.env.FACE_MODEL ?? 'both') as 'both', tileThr: Number(process.env.TILE_THR ?? 0.6),
  };
  const atDefault = metrics(rows, byName, chosen.textThr, chosen.faceThr, chosen.faceModel, chosen.tileThr);
  const nonHard = new Map([...byName].filter(([, l]) => !l.hard));
  const atDefaultEasy = metrics(rows.filter((r) => nonHard.has(r.name)), nonHard, chosen.textThr, chosen.faceThr, chosen.faceModel, chosen.tileThr);
  const withoutTiles = metrics(rows, byName, chosen.textThr, chosen.faceThr, chosen.faceModel, Infinity);

  const ms = rows.filter((r) => r.status !== 'error' && !r.screenshot).map((r) => r.ms).sort((a, b) => a - b);
  const timing = {
    warmupMs: out.warmupMs,
    perImageMs: { median: ms[Math.floor(ms.length / 2)], p90: ms[Math.floor(ms.length * 0.9)], max: ms[ms.length - 1] },
    screenshotRuleMs: rows.filter((r) => r.screenshot).map((r) => r.ms),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    browser: 'Chromium (Playwright headless)',
    chosen, atDefault, atDefaultNonHard: atDefaultEasy, withoutTiles, timing,
    rows: rows.map((r) => ({ ...r, label: byName.get(r.name) })),
    sweep,
    errors: out.error ?? null,
    console: logs.filter((l) => /error|warn/i.test(l)).slice(0, 40),
  };
  fs.writeFileSync(path.join(LAB, 'filter_report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ atDefault, atDefaultEasy, withoutTiles, timing }, null, 1));
  expect(rows.every((r) => r.status !== 'error' || r.error)).toBeTruthy();
});

test('사진 안전 필터: 앱 기본값으로 판정(재현율 98% 이상)과 장당 시간', async ({ page }) => {
  const labels: Label[] = JSON.parse(fs.readFileSync(path.join(TS, 'labels.json'), 'utf8'));
  const byName = new Map(labels.map((l) => [l.file, l]));
  await page.goto('/lab/filter.html?prod');
  await page.setInputFiles('#files', labels.map((l) => path.join(TS, l.file)));
  await page.waitForFunction(() => (window as any).__filter?.done === true, null, { timeout: 540000 });
  const out = await page.evaluate(() => (window as any).__filter);
  const rows: Row[] = out.rows;
  await page.screenshot({ path: path.join(LAB, 'filter_grid.jpg'), type: 'jpeg', quality: 80, fullPage: true });
  let tp = 0, fn = 0, fp = 0, tn = 0;
  const misses: string[] = [];
  for (const r of rows) {
    const hide = r.status !== 'ok'; // error 도 보여 주지 않는다
    const l = byName.get(r.name)!;
    if (l.hide && hide) tp++; else if (l.hide) { fn++; misses.push(r.name); } else if (hide) fp++; else tn++;
  }
  const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
  const prod = {
    tp, fn, fp, tn, recall: tp / (tp + fn), precision: tp / (tp + fp), misses,
    warmupMs: out.warmupMs, perImageMs: { median: ms[Math.floor(ms.length / 2)], p90: ms[Math.floor(ms.length * 0.9)], max: ms[ms.length - 1] },
    totalMs: ms.reduce((a, b) => a + b, 0),
  };
  const reportPath = path.join(LAB, 'filter_report.json');
  const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : {};
  report.prodDefaults = prod;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ prod }, null, 1));
  expect(prod.recall).toBeGreaterThanOrEqual(0.98);
});
