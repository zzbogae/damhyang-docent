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
    // 10/23 버튼배치: Ⓑ 내려가기 → 엘리베이터 → 지층 → 고른 주 → 캐기(3번) → 여기서 바로 보기 → 상세
    const descend = async () => {
      await page.locator('.obs-btn.b').click();
      await page.locator('.lift-btn.primary').click();
      await expect(page.locator('.minefield')).toBeVisible({ timeout: 10000 });
    };
    const mine = async (carry: boolean) => {
      const rock = page.locator('.mine-ore');
      await expect(rock).toBeVisible();
      for (let i = 0; i < 3; i++) await rock.click();
      await page.getByRole('button', { name: carry ? '관측소로 가져가기' : '여기서 바로 보기' }).click();
    };
    await descend();
    await page.waitForTimeout(800);
    await shot('2_field');
    const tick = page.locator('.mf-tick:not(.has-ore)').nth(5);
    await tick.evaluate((el) => el.scrollIntoView({ block: 'center' })); await tick.click();
    await page.locator('.mf-ore[data-picked="true"]').click();
    if (vp.name === 'phone' && !(await page.locator('.mine-ore').isVisible())) await page.locator('.mf-ore[data-picked="true"]').click();
    await shot('3_mine');
    await mine(false);
    await expect(page.getByRole('group', { name: '★ VIBE 네 질문' })).toBeVisible(); await shot('4_detail');
    await page.getByRole('button', { name: '‹ 되돌아가기' }).click();
    await page.getByRole('menuitem', { name: '관측소' }).click();
    for (let k = 0; k < 2; k++) {
      await descend();
      const ore = page.locator('.mf-ore:not([data-picked])').nth(k);
      await ore.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await ore.click();
      if (!(await page.locator('.mine-ore').isVisible())) await ore.click(); // 터치: 첫 탭은 말풍선
      await mine(true);
      await expect(page.getByRole('heading', { name: '관측소' })).toBeVisible({ timeout: 10000 });
    }
    await page.locator('.obs-btn.e').click();
    await page.getByRole('button', { name: '다음' }).click();
    await page.getByRole('group', { name: '단어 고르기' }).getByRole('button').first().click();
    await page.getByRole('button', { name: '다음' }).click();
    await page.getByRole('button', { name: '다음' }).click();
    await page.getByLabel('공간 이름').fill('첫 공간');
    await page.getByRole('button', { name: '다음' }).click();
    await page.getByRole('button', { name: '안개 걷고 열기' }).click();
    await expect(page.getByText('첫 공간').first()).toBeVisible({ timeout: 10000 }); await shot('5_space');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    console.log(vp.name, 'overflow', overflow, 'errors', errors.length);
    expect(errors).toEqual([]);
  });
}
