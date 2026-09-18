// 실제 기록 평가 전 과정: 가져오기 전에 사건 적기·봉인 → 샘플 가져오기 → 가린 주 답하기 → 숫자 보고서 계산·내려받기.
import { expect, test } from '@playwright/test';
import fs from 'node:fs';

const EVENTS = [
  { start: '2025-03-03', end: '2025-03-21', kind: 'hard', note: '독감으로 누워 있던 때' },
  { start: '2025-06-23', end: '2025-06-27', kind: 'good', note: '제주 여행' },
  { start: '2025-12-15', end: '2026-01-01', kind: 'hard', note: '' },
  { start: '2025-09-01', end: '', kind: 'change', note: '이직' },
];

test('사건을 봉인하고 샘플로 평가 보고서를 만든다', async ({ page }) => {
  fs.mkdirSync('../out/shots', { recursive: true });
  await page.goto('/');
  await page.getByRole('button', { name: '사건 먼저 적기' }).click();
  await expect(page.getByRole('heading', { name: '실제 기록으로 평가하기' })).toBeVisible();

  for (const e of EVENTS) {
    await page.getByLabel('어떤 일').selectOption(e.kind);
    await page.getByLabel('시작한 날').fill(e.start);
    if (e.end) await page.getByLabel('끝난 날(하루면 비워 둠)').fill(e.end);
    await page.getByLabel('메모(선택, 이 기기에만 남음)').fill(e.note);
    await page.getByRole('button', { name: '사건 더하기' }).click();
  }
  await expect(page.locator('.ev-list li')).toHaveCount(4);
  await page.screenshot({ path: '../out/shots/eval-events.png', fullPage: true });
  await page.getByRole('button', { name: '봉인하기' }).click();
  await expect(page.getByRole('status')).toContainText('판정 결과를 보기 전에 봉인했습니다');

  await page.getByRole('button', { name: '기록 가져오러 가기' }).click();
  await page.getByRole('button', { name: '가짜 샘플 기록으로 먼저 보기' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다음에' }).click();

  await page.getByRole('button', { name: '평가', exact: true }).click();
  await page.getByRole('button', { name: '가린 주 고르기' }).click();
  const answers = ['기억에 남는 주였습니다', '평범한 주였습니다', '잘 모르겠습니다'];
  for (let i = 0; i < 30; i++) {
    if (await page.getByText('모두 답했습니다').isVisible()) break;
    await page.getByRole('button', { name: answers[i % 3] }).click();
  }
  await expect(page.getByText('모두 답했습니다')).toBeVisible();
  await page.locator('.rate-card').screenshot({ path: '../out/shots/eval-rating.png' });

  await page.getByLabel('참가 코드').fill('P1');
  await page.getByRole('button', { name: '계산하기' }).click();
  await expect(page.getByRole('button', { name: '보고서 내려받기' })).toBeVisible({ timeout: 180000 });
  await page.locator('.report').screenshot({ path: '../out/shots/eval-report.png' });

  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '보고서 내려받기' }).click()]);
  expect(dl.suggestedFilename()).toBe('mined_eval_P1.json');
  const text = fs.readFileSync(await dl.path(), 'utf8');
  const rep = JSON.parse(text);
  expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}|\d{4}-W\d{2}/);
  expect(text).not.toContain('독감');
  expect(text).not.toContain('제주');
  expect(rep.schema).toBe('mined.fieldeval/1');
  expect(rep.participant).toBe('P1');
  expect(rep.seal).toMatchObject({ sealed: true, before_result: true, seals: 1 });
  expect(rep.events.by_kind).toEqual({ hard: 2, good: 1, change: 1 });
  expect(rep.anchors.n_events).toBe(3);
  expect(rep.ratings.n_candidates).toBeGreaterThan(0);
  expect(rep.configs).toBeTruthy();

  // 좁은 화면
  await page.setViewportSize({ width: 430, height: 900 });
  await page.locator('main').evaluate((m) => m.scrollTo(0, 0));
  await page.screenshot({ path: '../out/shots/eval-narrow.png' });
  await page.locator('.rate-card').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '../out/shots/eval-narrow-rating.png' });
});
