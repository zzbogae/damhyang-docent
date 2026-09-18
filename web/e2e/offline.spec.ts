// 오프라인: 한 번 가짜 샘플로 전 과정을 돈 뒤, 인터넷을 끊고 다시 열어도 지층이 뜨고, 샘플을 처음부터 다시 가져와 판정할 수 있다.
import { expect, test } from '@playwright/test';

test('한 번 연 뒤에는 인터넷 없이도 열린다', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker?.ready.then(() => true));
  await page.reload(); // 서비스 워커가 이 페이지를 맡은 뒤 다시 받게 한다
  await page.getByRole('button', { name: '가짜 샘플 기록으로 먼저 보기' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await page.getByRole('button', { name: '다음에' }).click();
  // 사진 필터 모델도 한 번 받게 사진이 있는 주를 연다
  const weeks = await page.locator('.strata .wk.hit').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.week));
  for (const wk of weeks.reverse()) {
    await page.locator(`[data-week="${wk}"]`).click();
    const gate = page.getByRole('button', { name: '그때 기록 열어 보기' });
    if (await gate.isVisible()) await gate.click();
    if (await page.getByText('이 주에 찍은 사진이 없습니다.').isVisible()) continue;
    await expect(page.locator('.photos img').first()).toBeVisible({ timeout: 60000 });
    break;
  }
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 60000 });
  // 인터넷 없이 샘플을 처음부터 다시 가져와 판정한다(Python 런타임·샘플 파일이 캐시에서 나와야 함)
  await page.getByRole('button', { name: '설정' }).click();
  await page.getByRole('button', { name: '모두 지우기' }).click();
  await page.getByRole('button', { name: '정말 지웁니다' }).click();
  await page.getByRole('button', { name: '가짜 샘플 기록으로 먼저 보기' }).click();
  await expect(page.getByRole('heading', { name: '지층' })).toBeVisible({ timeout: 180000 });
  await context.setOffline(false);
});
