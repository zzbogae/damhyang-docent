// 처음부터 끝까지(10/23 장면 플로우 + 11/03 섬 만들기): 입장 → 민디 소개 → 가짜 샘플 가져오기 → 관측소 → 지층 → 고른 주 캐기 → 열린 광석 → 데이터 광석 둘 → 민디와 섬 만들기 → 섬으로 가기. 데스크톱과 휴대폰 폭, 강제 클릭 없이.
import { expect, test } from '@playwright/test';
import { buildIsland, visitIsland } from './island';
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
    await page.getByLabel('만 14세 이상입니다').check();
    await page.getByRole('button', { name: /내 기록으로 시작/ }).click();
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
    await buildIsland(page, '첫 공간'); await shot('5_space');
    await visitIsland(page, '첫 공간'); await shot('6_island');
    await page.getByRole('button', { name: '‹ 관측소로' }).click();
    // 첫 홈(로고)에서 「섬으로 들어가기」 → 같은 안개 그림에서 안개가 걷히고 섬
    await page.getByRole('button', { name: 'Mine D 처음 화면으로' }).click();
    const fromHome = page.locator('.intro').getByRole('button', { name: '섬으로 들어가기' });
    await expect(fromHome).toBeEnabled({ timeout: 8000 }); await page.waitForTimeout(4500); await shot('7_home'); await fromHome.click();
    await expect(page.locator('.intro')).toHaveCount(0);
    await expect(page.locator('.isl-visit-full')).toBeVisible();
    await page.getByRole('button', { name: '섬으로 들어가기' }).click({ timeout: 15000 });
    await page.getByRole('button', { name: '‹ 관측소로' }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    console.log(vp.name, 'overflow', overflow, 'errors', errors.length);
    expect(errors).toEqual([]);
  });
}
