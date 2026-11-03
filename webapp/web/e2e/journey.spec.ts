// 처음부터 끝까지(10/23 버튼배치 확정 화면 + 11/03 v2): 입장 카드 → 가짜 샘플 → 관측소(P3) → Ⓑ 엘리베이터(P5, 민디 대사) → 지층 → 고른 주 →
// 캐기(P7, 칠 때마다 민디 대사 · 깨지면 결 단면) → 광석 읽는 법 → 상세 → 데이터 광석 둘 → 민디와 섬 만들기 → 섬 영상 넷 → 섬으로 가기 → 처음 화면의 섬으로 들어가기.
// 데스크톱과 휴대폰 폭, 강제 클릭 없이.
import { expect, test } from '@playwright/test';
import { buildIsland, visitIsland } from './island';
test.use({ actionTimeout: 15000 });
for (const vp of [{ name: 'desktop', width: 1360, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
  test('처음부터 끝까지 ' + vp.name, async ({ page }) => {
    test.setTimeout(300000);
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
    const descend = async (say = false) => {
      await page.locator('.obs-btn.b').click();
      if (say) await expect(page.locator('.lift-say')).toContainText('한 층이 한 해');
      await page.locator('.lift-btn.primary').click();
      if (say) await expect(page.locator('.lift-say')).toContainText('조금만 더 내려갈게요');
      await expect(page.locator('.minefield')).toBeVisible({ timeout: 10000 });
    };
    const mine = async (carry: boolean, check = false) => {
      const rock = page.locator('.mine-ore');
      await expect(rock).toBeVisible();
      if (check) await expect(page.locator('.mine-say')).toContainText('세 번 두드리면 열려요');
      await rock.click();
      if (check) await expect(page.locator('.mine-say')).toContainText('단단하네요');
      await rock.click(); await rock.click();
      if (check) {
        await expect(page.locator('.mine-open')).toContainText('안쪽 줄무늬가 결이에요');
        await expect(page.locator('.mine-bands li')).toHaveCount(4);
        await shot('3b_open');
        await page.getByRole('button', { name: '광석 읽는 법 ›' }).click();
        const guide = page.getByRole('dialog', { name: '광석 읽는 법' });
        await expect(guide.getByRole('option')).toHaveCount(9);
        await guide.getByRole('option', { name: /호박/ }).click();
        await expect(guide.locator('.ore-read-title')).toHaveText('걸음 · 평소보다 많음');
        await guide.getByRole('button', { name: '광석 읽는 법 닫기' }).click();
        await expect(guide).toHaveCount(0);
      }
      await page.getByRole('button', { name: carry ? '관측소로 가져가기' : '여기서 바로 보기' }).click();
    };
    await descend(true);
    await page.waitForTimeout(800);
    await shot('2_field');
    const tick = page.locator('.mf-tick:not(.has-ore)').nth(5);
    await tick.evaluate((el) => el.scrollIntoView({ block: 'center' })); await tick.click();
    await page.locator('.mf-ore[data-picked="true"]').click();
    if (vp.name === 'phone' && !(await page.locator('.mine-ore').isVisible())) await page.locator('.mf-ore[data-picked="true"]').click();
    await shot('3_mine');
    await mine(false, true);
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
    await buildIsland(page, '첫 공간'); await shot('5_space');
    await visitIsland(page, '첫 공간'); await shot('6_island');
    await page.getByRole('button', { name: '‹ 관측소로' }).click();
    // 처음 화면(로고)에서 「섬으로 들어가기」 → 안개가 걷히고 섬
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
