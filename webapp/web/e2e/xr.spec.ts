// 나의 방 WebXR: 헤드셋이 없으면 버튼이 없고, ?xr-emulate 에서는 IWER 에뮬레이터로 VR 세션에 들어간다. 외부 요청 0건.
import { expect, test, type Page } from '@playwright/test';

async function openRoom(page: Page, query: string) {
  await page.goto('/?dev' + query);
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
  await expect(page.locator('.room-stage canvas')).toBeVisible();
}

test('헤드셋이 없으면 VR 버튼이 없다', async ({ page }) => {
  await openRoom(page, '');
  await page.waitForTimeout(1500);
  await expect(page.getByRole('button', { name: 'VR로 보기' })).toHaveCount(0);
});

test('에뮬레이터로 VR 세션에 들어가고 나온다', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('blob:') && !u.startsWith('data:')) external.push(u); });
  await openRoom(page, '&xr-emulate');
  const btn = page.getByRole('button', { name: 'VR로 보기' });
  await expect(btn).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: '다이어리 펼치기' }).click();
  await btn.click();
  await expect(page.getByRole('status').filter({ hasText: 'VR 화면으로 들어갔습니다' })).toHaveCount(1, { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '../out/shots/xr-emulated.png' });
  // 에뮬레이터의 몰입 화면이 페이지를 덮어 포인터를 가로채므로 클릭 이벤트를 직접 보낸다
  await page.getByRole('button', { name: 'VR에서 나오기' }).dispatchEvent('click');
  await expect(page.getByRole('button', { name: 'VR로 보기' })).toBeVisible({ timeout: 10000 });
  expect(external).toEqual([]);
});
