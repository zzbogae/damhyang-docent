// 처음부터 끝까지(10/23 장면 플로우): 입장 → 민디 소개 → 가짜 샘플 가져오기 → 관측소 → 지층 → 고른 주 캐기 → 열린 광석 → 데이터 광석 둘 → 나의 공간. 데스크톱과 휴대폰 폭, 강제 클릭 없이.
import { expect, test } from '@playwright/test';
test.use({ actionTimeout: 15000 });
for (const vp of [{ name: 'desktop', width: 1360, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
  test('처음부터 끝까지 ' + vp.name, async ({ page }) => {
    test.setTimeout(240000);
    const errors: string[] = []; page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const shot = (n: string) => page.screenshot({ path: 'test-results/journey-' + vp.name + '_' + n + '.png' });
    await page.goto('/?intro');
    await page.getByRole('button', { name: '입장하기' }).click();
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '다음' }).click();
    await page.getByRole('button', { name: '시작하기' }).click();
    await page.getByRole('button', { name: '가짜 샘플 기록으로 먼저 보기' }).click();
    await expect(page.getByRole('heading', { name: '관측소' })).toBeVisible({ timeout: 180000 });
    await shot('1_hub');
    await page.getByRole('button', { name: '다음에' }).click();
    await page.getByRole('button', { name: /지층으로 내려가기/ }).click();
    await page.waitForTimeout(1700);
    await shot('2_field');
    const tick = page.locator('.mf-tick:not(.has-ore)').nth(5);
    await tick.evaluate((el) => el.scrollIntoView({ block: 'center' })); await tick.click();
    const rock = page.locator('.mf-ore[data-picked="true"]');
    for (let i = 0; i < 3; i++) await rock.click();
    const card = page.getByRole('dialog', { name: '기록 조각' });
    await expect(card).toBeVisible(); await page.waitForTimeout(500); await shot('3_card');
    await card.getByRole('button', { name: '상세 페이지에서 이어보기 →' }).click();
    await expect(page.locator('.team-detail')).toBeVisible(); await shot('4_detail');
    await page.getByRole('button', { name: '← 지층으로' }).click();
    for (let k = 0; k < 2; k++) {
      const ore = page.locator('.mf-ore:not([data-picked])').nth(k);
      await ore.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      for (let i = 0; i < 3; i++) await ore.click();
      await expect(card).toBeVisible(); await card.getByRole('button', { name: '닫기' }).click();
    }
    await page.getByRole('button', { name: '관측소', exact: true }).click();
    await page.getByRole('button', { name: /나의 공간/ }).click();
    await page.getByRole('group', { name: '단어 고르기' }).getByRole('button').first().click();
    await page.getByLabel('공간 이름').fill('첫 공간');
    await page.getByRole('button', { name: '이름 붙이고 짓기' }).click();
    await expect(page.locator('.space-name')).toHaveText('첫 공간'); await shot('5_space');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    console.log(vp.name, 'overflow', overflow, 'errors', errors.length);
    expect(errors).toEqual([]);
  });
}
