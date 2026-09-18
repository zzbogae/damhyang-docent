// "기록은 이 브라우저 밖으로 나가지 않습니다": 샘플 가져오기 → 판정 → 사진 거르기 동안 다른 출처로 나가는 요청이 0건인지 본다.
import { expect, test } from '@playwright/test';

test('가져오기·판정·사진 거르기 동안 외부 요청이 없다', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(origin) && !u.startsWith('blob:') && !u.startsWith('data:')) external.push(u);
  });
  // 외부로 나가는 요청은 막아서, 막혀도 앱이 도는지 함께 본다(오프라인 시연)
  await page.route((url) => !url.href.startsWith(origin), (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: '가짜 샘플 기록으로 먼저 보기' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다음에' }).click();
  const weeks = await page.locator('.strata .wk.hit').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.week));
  for (const wk of weeks.slice(-3)) {
    await page.locator(`[data-week="${wk}"]`).click();
    const gate = page.getByRole('button', { name: '그때 기록 열어 보기' });
    if (await gate.isVisible()) await gate.click();
    await page.waitForTimeout(1500);
  }
  expect(external).toEqual([]);
});
