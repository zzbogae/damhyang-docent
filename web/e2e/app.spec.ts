// 앱 전 과정: 합성 판정 입력 → Pyodide 판정 → 지층 → 주 상세(확인 후 열람, 위기 메모 가림, 비밀 메모 숨김) → 라벨 → 모두 지우기.
import { expect, test } from '@playwright/test';
import fs from 'node:fs';

test('합성 입력으로 판정하고 주 상세를 연다', async ({ page }) => {
  fs.mkdirSync('../out/shots', { recursive: true });
  await page.goto('/?dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await expect(page.locator('.strata .wk.hit').first()).toBeVisible();
  const hits = await page.locator('.strata .wk.hit').count();
  expect(hits).toBeGreaterThan(5);
  await page.screenshot({ path: '../out/shots/app-overview.png' });

  // 민디 첫 인사 → 찾아가 보기
  await expect(page.getByText('이번 주의 당신과 가장 닮은 주를 찾아가볼까요?')).toBeVisible();
  await page.getByRole('button', { name: '찾아가 보기' }).click();
  await expect(page.getByText('이번은 저도 모릅니다.')).toBeVisible();
  await page.screenshot({ path: '../out/shots/app-mindi.png' });

  // 2024-W10(힘든 주, 가짜 비밀·위기 메모가 들어 있는 주)
  await page.locator('[data-week="2024-W10"]').click();
  await expect(page.locator('.sentence').first()).toContainText('2024년 3월 4일부터 한 주간');
  const gate = page.getByRole('button', { name: '그때 기록 열어 보기' });
  if (await gate.isVisible()) await gate.click();
  await expect(page.getByText(/비밀번호나 계좌번호처럼 보이는 메모 1개/)).toBeVisible();
  await expect(page.locator('.memo.veiled')).toHaveCount(1);
  await expect(page.getByText(/자살예방상담전화 109/)).toBeVisible();
  await page.screenshot({ path: '../out/shots/app-week.png', fullPage: false });

  // 라벨 붙이기
  await page.getByLabel('이 주에 붙일 이름').fill('긴 겨울');
  await page.getByRole('button', { name: '붙이기' }).click();
  await expect(page.locator('.label-pill', { hasText: '긴 겨울' })).toBeVisible();

  // 새로고침해도 남아 있다(IndexedDB)
  await page.reload();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible();
  await expect(page.locator('.wk .lab')).toHaveCount(1);

  // 모두 지우기
  await page.getByRole('button', { name: '설정' }).click();
  await page.getByRole('button', { name: '모두 지우기' }).click();
  await page.getByRole('button', { name: '정말 지웁니다' }).click();
  await expect(page.getByRole('heading', { name: '기록을 가져옵니다' })).toBeVisible();
});

test('좁은 화면에서도 지층과 상세가 세로로 이어진다', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto('/?dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.screenshot({ path: '../out/shots/app-narrow.png', fullPage: true });
  await page.locator('.strata .wk.hit').last().click();
  await expect(page.locator('.sentence').first()).toBeVisible();
  await page.screenshot({ path: '../out/shots/app-narrow-week.png' });
});

test('주 상세 윗부분(문장·게이지)', async ({ page }) => {
  await page.goto('/?dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다음에' }).click();
  await page.locator('[data-week="2025-W20"]').click();
  await expect(page.locator('.sentence').first()).toBeVisible();
  await page.screenshot({ path: '../out/shots/app-week-top.png' });
});

test('가짜 샘플 원천 파일을 가져와 판정하고 사진을 거른다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '가짜 샘플 기록으로 먼저 보기' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  const n = await page.locator('.strata .wk.hit').count();
  expect(n).toBeGreaterThan(3);
  await page.getByRole('button', { name: '다음에' }).click();
  // 사진이 있는 판정 주를 찾아 연다
  const weeks = await page.locator('.strata .wk.hit').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.week));
  let opened = false;
  for (const wk of weeks.reverse()) {
    await page.locator(`[data-week="${wk}"]`).click();
    const gate = page.getByRole('button', { name: '그때 기록 열어 보기' });
    if (await gate.isVisible()) await gate.click();
    if (await page.getByText('이 주에 찍은 사진이 없습니다.').isVisible()) continue;
    await expect(page.locator('.photos img').first()).toBeVisible({ timeout: 60000 });
    opened = true;
    break;
  }
  expect(opened).toBe(true);
  await page.screenshot({ path: '../out/shots/app-sample-week.png' });

  // 거의 같은 사진은 한 장만 보이고, 버튼으로 펼친다(합성 사진은 40장을 돌려 써서 같은 사진이 되풀이된다)
  let grouped = false;
  for (const wk of weeks) {
    await page.locator(`[data-week="${wk}"]`).click();
    const gate2 = page.getByRole('button', { name: '그때 기록 열어 보기' });
    if (await gate2.isVisible()) await gate2.click();
    if (await page.getByText('이 주에 찍은 사진이 없습니다.').isVisible()) continue;
    await expect(page.locator('.photos img').first().or(page.getByText('보여 드릴 수 있는 사진이 없습니다.'))).toBeVisible({ timeout: 60000 });
    const more = page.locator('.photos .more').first();
    if (!(await more.isVisible())) continue;
    const before = await page.locator('.photos img').count();
    await more.click();
    await expect(page.locator('.photos img')).not.toHaveCount(before);
    expect(await page.locator('.photos img').count()).toBeGreaterThan(before);
    await page.locator('.photos').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: '../out/shots/app-similar-photos.png' });
    grouped = true;
    break;
  }
  expect(grouped).toBe(true);
});

test('같은 이름을 다섯 주에 붙이면 나의 방이 열린다', async ({ page }) => {
  await page.goto('/?dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다음에' }).click();
  const weeks = (await page.locator('.strata .wk.hit').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.week))).slice(0, 5);
  for (const wk of weeks) {
    await page.locator(`[data-week="${wk}"]`).click();
    await page.getByLabel('이 주에 붙일 이름').fill('긴 겨울');
    await page.getByRole('button', { name: '붙이기' }).click();
    await expect(page.locator('.label-pill', { hasText: '긴 겨울' })).toBeVisible();
  }
  await page.getByRole('button', { name: '나의 방 열기' }).click();
  await expect(page.getByRole('heading', { name: /나의 방 · 긴 겨울/ })).toBeVisible();
  await expect(page.locator('.room-stage canvas')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '../out/shots/app-room.png' });
  await page.getByRole('button', { name: '다이어리 펼치기' }).click();
  await expect(page.locator('.room-page').first()).toBeVisible();
  await page.screenshot({ path: '../out/shots/app-room-diary.png' });
});

test('민디에게 묻기와 시기 페이지', async ({ page }) => {
  await page.goto('/?dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다음에' }).click();
  await page.locator('[data-week="2025-W20"]').click();
  await page.getByRole('button', { name: '왜 이 주를 골랐어?' }).click();
  await expect(page.locator('.ask .bubble')).toContainText('직전 1년');
  await page.getByRole('button', { name: '이 주와 닮은 주는 언제야?' }).click();
  await expect(page.locator('.ask .bubble')).toContainText('이번은 저도 모릅니다.');
  await page.locator('.ask').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '../out/shots/app-ask.png' });
  await page.getByRole('button', { name: '시기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '시기', exact: true })).toBeVisible();
  await page.screenshot({ path: '../out/shots/app-eras.png' });
});

test('팀 v6 판정 JSON 을 불러와 지층에 보여 주고 다시 내려받는다', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('팀 v6 판정 JSON').setInputFiles('e2e/fixtures_v6_sample.json');
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 60000 });
  await expect(page.getByText(/팀 v6 판정 JSON 에서 불러온 결과/)).toBeVisible();
  expect(await page.locator('.strata .wk.hit').count()).toBe(80);
  await page.getByRole('button', { name: '다음에' }).click();
  await page.locator('[data-week="2012-W10"]').click();
  await expect(page.locator('.sentence').first()).toContainText('2012년 3월 5일부터 한 주간');
  await expect(page.getByText('(팀 v6 표기)').first()).toBeVisible();
  await page.screenshot({ path: '../out/shots/app-v6-import.png' });
  await page.getByRole('button', { name: '설정' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'v6 JSON 내려받기' }).click()]);
  const j = JSON.parse(await (await dl.createReadStream()).toArray().then((b) => Buffer.concat(b).toString('utf8')));
  expect(j.weeks).toHaveLength(80);
});

test('두 기간 비교', async ({ page }) => {
  await page.goto('/?dev');
  await page.getByRole('button', { name: '합성 판정 입력(개발용)' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다음에' }).click();
  await page.getByRole('button', { name: '시기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '두 기간 비교' })).toBeVisible();
  await page.getByLabel('첫 번째 기간').selectOption({ label: '2022년 여름(6~8월)' });
  await page.getByLabel('두 번째 기간').selectOption({ label: '2025년 여름(6~8월)' });
  await expect(page.locator('.cmp-table tbody tr').first()).toContainText('걸음수');
  await expect(page.locator('.cmp-table')).toContainText('2022년 여름(6~8월)');
  await page.locator('.compare').screenshot({ path: '../out/shots/app-compare.png' });
});
